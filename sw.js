/* Pasko ng Angkan v2.9.9: cache ONLY public app files, never Sheets data or passwords. */
const CACHE_NAME='pna-app-shell-v2.11';
const SHELL=[
  './','./index.html','./manifest.webmanifest',
  './assets/css/style.css?v=2.11','./assets/css/hero-animation.css?v=2.8',
  './assets/js/api.js?v=2.9.2','./assets/js/finance-model.js?v=2.9.6',
  './assets/js/member-autocomplete.js?v=2.10','./assets/js/registration-duplicates.js?v=2.11','./assets/js/app.js?v=2.11-registration','./assets/js/hero-animation.js?v=2.8',
  './assets/icons/favicon.svg?v=2.9','./assets/icons/apple-touch-icon.png?v=2.9'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
   caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('pna-app-shell-')&&n!==CACHE_NAME).map(n=>caches.delete(n)))),
   self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url),scope=new URL(self.registration.scope);
 // Never intercept/cache script.google.com, external APIs, or a different site.
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const isPage=req.mode==='navigate';
 const isAsset=/\/(assets\/(?:css|js|icons)\/[^/]+|manifest\.webmanifest)$/.test(url.pathname);
 if(!isPage&&!isAsset)return;
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   if(isPage){
     try{const fresh=await fetch(req);if(fresh.ok)await cache.put(new URL('./index.html',scope),fresh.clone());return fresh;}
     catch{const stored=await cache.match(new URL('./index.html',scope));return stored||Response.error();}
   }
   const cached=await cache.match(req);
   if(cached)return cached;
   try{const fresh=await fetch(req);if(fresh.ok)await cache.put(req,fresh.clone());return fresh;}
   catch{return Response.error();}
 })());
});
