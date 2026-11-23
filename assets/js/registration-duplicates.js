/* v2.11 — shared, offline-safe duplicate checks (display names only). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RegistrationDuplicates=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const tokens=s=>normalize(s).split(' ').filter(Boolean);
  const exactName=s=>tokens(s).sort().join(' ');
  const exactFamily=s=>tokens(s).map(t=>(t==='household'?'family':t)).sort().join(' ');
  function distance(a,b,limit=2){
    if(Math.abs(a.length-b.length)>limit)return limit+1;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
      if(Math.min(...prev)>limit)return limit+1;
    }
    return prev[b.length];
  }
  function similar(a,b){
    const left=normalize(a),right=normalize(b);
    if(!left||!right||Math.min(left.length,right.length)<7||exactName(a)===exactName(b))return false;
    if(distance(left,right,2)<=2)return true;
    const A=tokens(a),B=tokens(b);
    const short=A.length<=B.length?A:B,long=A.length<=B.length?B:A;
    if(short.length>=2&&long.length>short.length&&short[0]===long[0]&&short[short.length-1]===long[long.length-1])return true;
    if(A.length!==B.length)return false;
    let misses=0,remaining=[...B];
    for(const word of A){
      let i=remaining.indexOf(word);
      if(i>=0){remaining.splice(i,1);continue;}
      i=remaining.findIndex(x=>Math.abs(x.length-word.length)<=2&&distance(word,x,1)<=1);
      if(i<0||++misses>1)return false;
      remaining.splice(i,1);
    }
    return misses===1;
  }
  function find(name,registrationType,records,currentId=''){
    if(!normalize(name))return {kind:'none',record:null};
    const family=registrationType==='Family';
    const comparable=(Array.isArray(records)?records:[]).filter(r=>r&&String(r.id)!==String(currentId)&&
      r.active!==false&&String(r.active).toLowerCase()!=='false'&&
      (r.registrationType==='Family')===family);
    const target=family?exactFamily(name):exactName(name);
    const exact=comparable.find(r=>target===(family?exactFamily(r.name):exactName(r.name)));
    if(exact)return {kind:'duplicate',record:exact};
    const close=comparable.find(r=>similar(family?normalize(name).replace(/\bhousehold\b/g,'family'):name,
      family?normalize(r.name).replace(/\bhousehold\b/g,'family'):r.name));
    return close?{kind:'similar',record:close}:{kind:'none',record:null};
  }
  return {normalize,exactName,exactFamily,similar,find};
});
