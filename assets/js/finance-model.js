/* Pasko ng Angkan — finance totals; amounts shown here are PHP and are never a budget forecast. */
(function(root){
  "use strict";
  const RECEIPT_TYPES={"Registration Collected":"Registration","Solicitation Collected":"Solicitation","Donation":"Donation","Other Received":"Other","Opening Balance":"Other","Cash on Hand":"Other"};
  const SOURCES=["Registration","Solicitation","Donation","Other"];
  function validMoney(n){const v=Number(n);return Number.isFinite(v)&&v>0?v:0;}
  function isReceived(c){return c && c.status!=="Reversed" && c.status!=="Cancelled";}
  const REGISTRATION_RATES={Family:300,"Working Adult":100,"Non-Working Adult":50,Youth:50,Kids:0,Visitors:0};
  function registrationRate(type){return Object.prototype.hasOwnProperty.call(REGISTRATION_RATES,type)?REGISTRATION_RATES[type]:0;}
  function isActive(r){return r.active===undefined||r.active===true||r.active===1||String(r.active).toLowerCase()==="true";}
  function calculate(entries=[],collections=[],registrations=[],payments=[],payouts=[]){
    const collected=new Map();
    for(const c of collections)if(isReceived(c)&&c.receivableId&&!collected.has(String(c.receivableId)))
      collected.set(String(c.receivableId),c);
    const sources={Registration:0,Solicitation:0,Donation:0,Other:0};
    const payoutMap=new Map();
    for(const p of payouts)if(isReceived(p)&&p.payableId&&!payoutMap.has(String(p.payableId)))
      payoutMap.set(String(p.payableId),p);
    let outstanding=0,payables=0,expenses=0,legacyIncome=0,opening=0;
    for(const item of entries){
      const amount=validMoney(item.amount);
      if(item.type==="Expense")expenses+=amount;
      else if(item.type==="Payable"){
        const payout=payoutMap.get(String(item.id));
        if(payout && Number(payout.amount)===amount)expenses+=amount;
        else {payables+=amount;payoutMap.delete(String(item.id));}
      }
      else if(item.type==="Receivables"){
        if(!collected.has(String(item.id)))outstanding+=amount;
      }else if(item.type==="Income")legacyIncome+=amount;
      else if(RECEIPT_TYPES[item.type]){
        sources[RECEIPT_TYPES[item.type]]+=amount;
        if(item.type==="Opening Balance"||item.type==="Cash on Hand")opening+=amount;
      }
    }
    for(const [id,c] of collected){
      const original=entries.find(e=>String(e.id)===id&&e.type==="Receivables");
      if(!original)continue;
      const source=SOURCES.includes(c.source)?c.source:"Other";
      sources[source]+=validMoney(c.amount);
    }
    // Registration receivables are derived from ACTIVE registrations, not
    // manually duplicated in FinanceEntries. A Family pays once per record.
    // New, unconfirmed browser-only registrations are visible in the quick
    // registration list, but must not affect confirmed Finance balances yet.
    const activeRegs=registrations.filter(r=>isActive(r)&&!(r._syncState&&r._everConfirmed!==true));
    const paymentMap=new Map();
    for(const p of payments){
      if(!isReceived(p)||!p.registrationId||paymentMap.has(String(p.registrationId)))continue;
      paymentMap.set(String(p.registrationId),p);
    }
    let registrationOutstanding=0,registrationCollected=0,registrationExpected=0;
    const registrationsById=new Map(activeRegs.map(r=>[String(r.id),r]));
    for(const r of activeRegs){
      const amount=registrationRate(r.registrationType);
      registrationExpected+=amount;
      const payment=paymentMap.get(String(r.id));
      if(payment && amount>0 && Number(payment.amount)===amount){
        registrationCollected+=amount;
      }else if(amount>0){
        registrationOutstanding+=amount;
        // Ignore stale mismatched payments in the UI as well as orphan ones.
        paymentMap.delete(String(r.id));
      }
    }
    for(const id of [...paymentMap.keys()])if(!registrationsById.has(id))paymentMap.delete(id);
    for(const id of [...payoutMap.keys()]){
      if(!entries.some(e=>String(e.id)===id&&e.type==="Payable"))payoutMap.delete(id);
    }
    sources.Registration+=registrationCollected;
    outstanding+=registrationOutstanding;
    const totalFunds=SOURCES.reduce((n,k)=>n+sources[k],0);
    const collection=Math.max(0,totalFunds-opening);
    return {outstanding,payables,collection,registrationOutstanding,registrationCollected,registrationExpected,
      expenses,legacyIncome,opening,sources,totalFunds,availableCash:totalFunds-expenses,collected,
      payablePayments:payoutMap,registrationPayments:paymentMap};
  }
  root.FinanceModel={calculate,RECEIPT_TYPES,SOURCES,REGISTRATION_RATES,registrationRate};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.FinanceModel;
})(typeof globalThis!=="undefined"?globalThis:this);
