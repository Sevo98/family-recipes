const CACHE='family-recipes-pwa-v3';
const ASSETS=['./','./index.html','./pwa.js','./cloud.js','./supabase-2.117.2.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const allowed=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('family-recipes-pwa-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  // Never cache API calls, authentication responses or external resources.
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  const clean=new URL(url);clean.search='';clean.hash='';
  if(!allowed.has(clean.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{const response=await fetch(req,{signal:AbortSignal.timeout(6000)});if(response.ok&&!response.redirected)await cache.put(clean.href,response.clone());return response;}
    catch(error){const saved=await cache.match(clean.href);if(saved)return saved;throw error;}
  })());
});
