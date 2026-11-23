/* v2.10: local, deterministic fuzzy matching. No third-party AI/network calls. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MemberAutocomplete=api;
})(typeof window!=='undefined'?window:null,function(){
  "use strict";
  const normalize=s=>String(s||"").normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  function distance(a,b,max=2){
    if(Math.abs(a.length-b.length)>max)return max+1;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];for(let j=1;j<=b.length;j++)
        cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;if(Math.min(...prev)>max)return max+1;
    }
    return prev[b.length];
  }
  function score(name,input){
    const target=normalize(name),query=normalize(input);
    if(query.length<2)return -Infinity;
    const tokens=target.split(' '),parts=query.split(' ');
    let result=0;
    for(const part of parts){
      let best=-Infinity;
      for(const token of tokens){
        const s=token===part?140:token.startsWith(part)?115:
          token.includes(part)?75:
          part.length>=3&&distance(part,token.slice(0,part.length),1)<=1?45:
          part.length>=4&&distance(part,token,2)<=2?30:-Infinity;
        if(s>best)best=s;
      }
      if(best===-Infinity)return -Infinity;
      result+=best;
    }
    if(target.startsWith(query))result+=30;
    return result;
  }
  function search(catalog,input,limit=6){
    if(normalize(input).length<2)return [];
    return (Array.isArray(catalog)?catalog:[]).map(item=>({item,score:score(item.name,input)}))
      .filter(x=>x.score>-Infinity)
      .sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name))
      .slice(0,limit).map(x=>x.item);
  }
  return {normalize,score,search};
});
