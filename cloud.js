/* Shared household list without sign-in. The table is intentionally public. */
(() => {
 const el=id=>document.getElementById(id),bridge=window.recipeBridge;
 const URL='https://fckkbcxaghwuyapszwap.supabase.co/rest/v1/family_shared_state';
 const KEY='sb_publishable_N2L5T5GR0UECfCuhRDMoBg_iNxpASMp';
 const STORE='family-recipes-shared-v1';let baseline=bridge.read(),journal={pending:{}},running=false,rerun=false,initializing=true;
 const headers={apikey:KEY};
 const panel=el('cloud-panel');panel.innerHTML='<h2 style="margin-top:0">Общий список покупок</h2><p>Галочки, размер порций, перекусы и выбор салатов сохраняются в общей базе и появятся на других устройствах с этим сайтом.</p><p class="note"><b>Общий доступ:</b> поскольку вход не требуется, любой посетитель публичного сайта сможет видеть и менять эти сохранения.</p><div class="tools"><button id="cloud-refresh">Обновить общий список</button></div><p id="cloud-status" role="status" aria-live="polite">Подключаем базу…</p><p><small>Офлайн-изменения сохраняются на этом устройстве и отправляются после подключения. Если одну позицию одновременно меняют с двух устройств, остаётся последнее отправленное значение.</small></p>';
 const status=text=>{el('cloud-status').textContent=text;const inline=el('save-status');if(inline)inline.textContent=text;};
 const read=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{pending:{}};}catch{return {pending:{}};}};
 function persist(){try{localStorage.setItem(STORE,JSON.stringify(journal));return true;}catch{status('Не удалось сохранить очередь на устройстве. Не закрывайте страницу до синхронизации.');return false;}}
 async function request(path='',options={}){const response=await fetch(URL+path,{...options,signal:AbortSignal.timeout(15000),headers:{...headers,...options.headers,...(options.body?{'Content-Type':'application/json'}:{})}});if(!response.ok)throw new Error('Supabase '+response.status);if(response.status===204)return null;const body=await response.text();return body?JSON.parse(body):null;}
 const fetchRows=()=>request('?select=key,value&limit=2000');
 async function push(batch){const rows=Object.entries(batch).map(([key,op])=>({key,value:op.value}));if(rows.length)await request('?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});}
 function changed(){const next=bridge.read();for(const key of new Set([...Object.keys(baseline),...Object.keys(next)])){if(JSON.stringify(baseline[key])!==JSON.stringify(next[key]))journal.pending[key]={value:next[key]??null,id:Date.now()+Math.random()};}baseline=next;persist();if(!initializing){status(navigator.onLine?'Отметка сохранена на устройстве · отправляем в общую базу…':'Нет интернета. Отметка сохранена на устройстве и отправится после подключения.');void sync();}}
 async function sync(){
  if(initializing)return;if(running){rerun=true;return;}if(!navigator.onLine){status('Нет интернета. Изменения сохранены на устройстве и отправятся после подключения.');return;}
  running=true;rerun=false;let succeeded=false;
  try{
   status('Синхронизация общего списка…');const batch={...journal.pending},keys=Object.keys(batch);await push(batch);
   for(const key of keys)if(journal.pending[key]?.id===batch[key].id)delete journal.pending[key];persist();
   const rows=await fetchRows(),remote=Object.fromEntries(rows.map(row=>[row.key,row.value]));
   for(const [key,op]of Object.entries(journal.pending))remote[key]=op.value;
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
   const remote=Object.fromEntries(rows.map(row=>[row.key,row.value]));for(const [key,op]of Object.entries(journal.pending))remote[key]=op.value;
   if(rows.length||Object.keys(journal.pending).length){bridge.apply(remote);baseline=bridge.read();}
   journal.cached=remote;journal.initialized=true;persist();initializing=false;await sync();
  }catch(error){initializing=false;status('Ошибка подключения: '+(error?.message||String(error)));}
 }
 el('cloud-refresh').onclick=()=>void sync();window.addEventListener('recipe-change',changed);window.addEventListener('online',()=>void sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});setInterval(()=>{if(!document.hidden)void sync();},15000);void initialize();
})();
