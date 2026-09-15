(async () => {
 const hash = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const storage = await Promise.all(Object.keys(localStorage).sort().map(async key => {const value=localStorage.getItem(key);return {key,bytes:new TextEncoder().encode(value).length,sha256:await hash(value)};}));
 const rect = (e) => { const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 return {
  at:new Date().toISOString(),url:location.href,title:document.title,online:navigator.onLine,
  viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},userAgent:navigator.userAgent,
  fullscreen:{enabled:document.fullscreenEnabled,element:document.fullscreenElement?.tagName??null,dataset:document.documentElement.dataset.gameFullscreen??null},
  body:document.body.innerText,active:{tag:document.activeElement?.tagName,id:document.activeElement?.id,text:document.activeElement?.textContent?.slice(0,180)},
  canvases:[...document.querySelectorAll('canvas')].map(e=>({id:e.id,width:e.width,height:e.height,rect:rect(e)})),
  controls:[...document.querySelectorAll('button,select,input,a,summary')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).slice(0,180).map(e=>({id:e.id,tag:e.tagName,label:e.getAttribute('aria-label')??e.textContent?.trim()?.slice(0,130),disabled:!!e.disabled,rect:rect(e)})),
  storage,databases:typeof indexedDB.databases==='function'?await indexedDB.databases():[],
  worker:navigator.serviceWorker?.controller?.scriptURL??null
 };
})();
