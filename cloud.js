/* Shared household list without sign-in. The table is intentionally public. */
(() => {
 const el=id=>document.getElementById(id),bridge=window.recipeBridge;
 const URL='https://fckkbcxaghwuyapszwap.supabase.co/rest/v1/family_shared_state';
 const KEY='sb_publishable_N2L5T5GR0UECfCuhRDMoBg_iNxpASMp';
 const STORE='family-recipes-shared-v1';let baseline=bridge.read(),journal={pending:{}},running=false,rerun=false,initializing=true;
 const headers={apikey:KEY};
 const panel=el('cloud-panel');panel.innerHTML='<h2 style="margin-top:0">Общий список и каталог</h2><p>Галочки, размер порций, перекусы и выбор салатов сохраняются в общей базе. Рецепты, продукты, состав и лайки тоже хранятся в Supabase и синхронизируются между устройствами.</p><p class="note"><b>Общий доступ:</b> поскольку вход не требуется, любой посетитель публичного сайта сможет видеть и менять сохранения, лайки и рецепты.</p><div class="tools"><button id="cloud-refresh">Обновить общий список</button><button type="button" id="catalog-refresh">Обновить каталог рецептов</button></div><p id="cloud-status" role="status" aria-live="polite">Подключаем базу…</p><p><small>Офлайн-изменения сохраняются на этом устройстве и отправляются после подключения. Если одну позицию одновременно меняют с двух устройств, остаётся последнее отправленное значение.</small></p>';
 const status=text=>{el('cloud-status').textContent=text;const inline=el('save-status');if(inline)inline.textContent=text;};
 el('catalog-refresh').onclick=()=>{if(!window.catalogApi)return;status('Обновляем каталог…');window.catalogApi.refresh().then(()=>status('Каталог обновлён · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))).catch(err=>status('Каталог: '+(err?.message||err)));};
 const read=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{pending:{}};}catch{return {pending:{}};}};
 function persist(){try{localStorage.setItem(STORE,JSON.stringify(journal));return true;}catch{status('Не удалось сохранить очередь на устройстве. Не закрывайте страницу до синхронизации.');return false;}}
 function timeoutSignal(ms){if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'){try{return AbortSignal.timeout(ms);}catch{}}if(typeof AbortController==='undefined')return undefined;const c=new AbortController();setTimeout(()=>{try{c.abort();}catch{}},ms);return c.signal;}
 async function request(path='',options={}){const opts={...options,headers:{...headers,...options.headers,...(options.body?{'Content-Type':'application/json'}:{})}};const signal=timeoutSignal(15000);if(signal)opts.signal=signal;const response=await fetch(URL+path,opts);if(!response.ok){let detail='';try{detail=await response.text();}catch{}let msg='Supabase '+response.status;try{const parsed=JSON.parse(detail);if(parsed&&parsed.message)msg+=' · '+parsed.message;}catch{if(detail)msg+=' · '+detail.slice(0,160);}throw new Error(msg);}if(response.status===204)return null;const body=await response.text();return body?JSON.parse(body):null;}
 const fetchRows=()=>request('?select=key,value&limit=2000');
 // Cleared keys must not be written as null: the value column is NOT NULL.
 // false is a tombstone that apply() ignores for checks/salads; snacks uses boolean false as a real value.
 function mergePending(remote){for(const [key,op]of Object.entries(journal.pending)){if(op.value===null||op.value===undefined)delete remote[key];else remote[key]=op.value;}return remote;}
 async function push(batch){const rows=Object.entries(batch).map(([key,op])=>({key,value:op.value??false}));if(rows.length)await request('?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});}
 function changed(){const next=bridge.read();for(const key of new Set([...Object.keys(baseline),...Object.keys(next)])){if(JSON.stringify(baseline[key])!==JSON.stringify(next[key]))journal.pending[key]={value:next[key]??null,id:Date.now()+Math.random()};}baseline=next;persist();if(!initializing){status(navigator.onLine?'Отметка сохранена на устройстве · отправляем в общую базу…':'Нет интернета. Отметка сохранена на устройстве и отправится после подключения.');void sync();}}
 async function sync(){
  if(initializing)return;if(running){rerun=true;return;}if(!navigator.onLine){status('Нет интернета. Изменения сохранены на устройстве и отправятся после подключения.');return;}
  running=true;rerun=false;let succeeded=false;
  try{
   status('Синхронизация общего списка…');const batch={...journal.pending},keys=Object.keys(batch);await push(batch);
   for(const key of keys)if(journal.pending[key]?.id===batch[key].id)delete journal.pending[key];persist();
   const rows=await fetchRows(),remote=mergePending(Object.fromEntries(rows.map(row=>[row.key,row.value])));
   if(JSON.stringify(remote)!==JSON.stringify(journal.cached)){bridge.apply(remote);baseline=bridge.read();}
   journal.cached=remote;persist();succeeded=true;status(Object.keys(journal.pending).length?'Отправляем новые изменения…':'Изменения сохранены в общей базе · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));
  }catch(error){status('Ошибка синхронизации: '+(error?.message||String(error)));}
  finally{running=false;if(rerun&&navigator.onLine){rerun=false;setTimeout(()=>void sync(),succeeded?0:1200);}}
 }
 async function initialize(){
  journal=read();journal.pending||={};const local=bridge.read();
  try{
   status('Подключаем общий список…');const rows=await fetchRows();
   if(rows.length===0&&!journal.initialized){for(const [key,value]of Object.entries(local))journal.pending[key]={value,id:Date.now()+Math.random()};}
   const remote=mergePending(Object.fromEntries(rows.map(row=>[row.key,row.value])));
   if(rows.length||Object.keys(journal.pending).length){bridge.apply(remote);baseline=bridge.read();}
   journal.cached=remote;journal.initialized=true;persist();initializing=false;await sync();
  }catch(error){initializing=false;status('Ошибка подключения: '+(error?.message||String(error)));}
 }
 el('cloud-refresh').onclick=()=>void sync();window.addEventListener('recipe-change',changed);window.addEventListener('online',()=>void sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});setInterval(()=>{if(!document.hidden)void sync();},15000);void initialize();
})();
