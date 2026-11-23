/* Pasko ng Angkan API bridge.
   Uses JSONP GET for reads and form-encoded POST for writes, then polls the
   request receipt. This avoids the common GitHub Pages -> Apps Script CORS issue.
   Configure API_URL in this file after deploying the Apps Script web app. */
const API_URL = "https://script.google.com/macros/s/AKfycbwD1tZSbWjT92MPi57NXriMtgUxnH1nyyMgB4-muUEAOLI7UAhqt7nuTGbAbvNDDSo6/exec";

const Api = (() => {
  const readTimeoutMs = 55000;
  const writeConfirmTimeoutMs = 90000; // a busy spreadsheet may take longer than a normal GET

  function jsonp(params) {
    return new Promise((resolve,reject) => {
      if (!API_URL.startsWith("https://script.google.com/")) return reject(new Error("Apps Script URL is not configured."));
      const callback = "gas_cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("The server did not respond. Check deployment access and URL.")); }, readTimeoutMs);
      function cleanup(){clearTimeout(timer);delete window[callback];script.remove();}
      window[callback] = data => {cleanup();resolve(data);};
      const q = new URLSearchParams({...params,callback});
      script.src = API_URL + "?" + q.toString();
      script.onerror = () => {cleanup();reject(new Error("Could not reach the Apps Script API."));};
      document.body.appendChild(script);
    });
  }
  async function request(action, data={}, reuseRequestId=null) {
    if (["bootstrap","getData","getTaskUpdates","getMemberCatalog"].includes(action)) return jsonp({action,...data});
    const requestId = reuseRequestId || "req_" + Date.now() + "_" + Math.random().toString(36).slice(2,9);
    const body = new URLSearchParams({action,requestId,payload:JSON.stringify(data)});
    // no-cors POST is intentionally opaque; the operation receipt is retrieved via JSONP.
    await fetch(API_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:body.toString()});
    const start = Date.now();
    while(Date.now()-start < writeConfirmTimeoutMs){
      await new Promise(r=>setTimeout(r,900));
      let receipt;
      try { receipt = await jsonp({action:"receipt",requestId}); }
      catch(err) {
        // A transient failed receipt check does not mean the write failed.
        // Keep polling the original requestId to avoid accidental duplicate writes.
        if(Date.now()-start >= writeConfirmTimeoutMs) break;
        continue;
      }
      if(receipt && receipt.done){
        if(!receipt.ok) throw new Error(receipt.error || "The operation failed.");
        return receipt.result || {ok:true};
      }
    }
    throw new Error("Confirmation timed out. Use Sync & Refresh to retry the SAME request safely; do not reload until the change is confirmed.");
  }
  return {request};
})();
