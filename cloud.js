/* Shared household list without sign-in. The table is intentionally public. */
(() => {
 const el=id=>document.getElementById(id),bridge=window.recipeBridge;
 const sb=window.supabase.createClient('https://fckkbcxaghwuyapszwap.supabase.co','sb_publishable_N2L5T5GR0UECfCuhRDMoBg_iNxpASMp');
 const STORE='family-recipes-shared-v1';let baseline=bridge.read(),journal={pending:{}},running=false,initializing=true;
 const panel=el('cloud-panel');panel.innerHTML='<h2 style="margin-top:0">Общий список покупок</h2><p>Галочки, размер порций, перекусы и выбор салатов сохраняются в общей базе и появятся на других устройствах с этим сайтом.</p><p class="note"><b>Общий доступ:</b> поскольку вход не требуется, любой посетитель публичного сайта сможет видеть и менять эти сохранения.</p><div class="tools"><button id="cloud-refresh">Обновить общий список</button></div><p id="cloud-status" role="status" aria-live="polite">Подключаем базу…</p><p><small>Офлайн-изменения сохраняются на этом устройстве и отправляются после подключения. Если одну позицию одновременно меняют с двух устройств, остаётся последнее отправленное значение.</small></p>';
 const status=text=>el('cloud-status').textContent=text;
 const read=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{pending:{}};}catch{return {pending:{}};}};
 function persist(){try{localStorage.setItem(STORE,JSON.stringify(journal));return true;}catch{status('Не удалось сохранить очередь на устройстве. Не закрывайте страницу до синхронизации.');return false;}}
 function changed(){const next=bridge.read();for(const key of new Set([...Object.keys(baseline),...Object.keys(next)])){if(JSON.stringify(baseline[key])!==JSON.stringify(next[key]))journal.pending[key]={value:next[key]??null,id:crypto.randomUUID()};}baseline=next;persist();if(!initializing)void sync();}
 async function sync(){
  if(running||initializing)return;if(!navigator.onLine){status('Нет интернета. Изменения сохранены на устройстве и отправятся после подключения.');return;}
  running=true;
  try{
   status('Синхронизация общего списка…');const batch={...journal.pending},keys=Object.keys(batch);
   if(keys.length){const {error}=await sb.from('family_shared_state').upsert(keys.map(key=>({key,value:batch[key].value})),{onConflict:'key'});if(error)throw error;for(const key of keys)if(journal.pending[key]?.id===batch[key].id)delete journal.pending[key];persist();}
   const {data,error}=await sb.from('family_shared_state').select('key,value').limit(2000);if(error)throw error;
   const remote=Object.fromEntries(data.map(row=>[row.key,row.value]));for(const [key,op]of Object.entries(journal.pending))remote[key]=op.value;
   if(JSON.stringify(remote)!==JSON.stringify(journal.cached)){bridge.apply(remote);baseline=bridge.read();}journal.cached=remote;persist();
   status(Object.keys(journal.pending).length?'Новые изменения ждут отправки…':'Общий список синхронизирован · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));
  }catch(error){status('Не удалось синхронизировать. Изменения сохранены на этом устройстве. Проверьте интернет или нажмите кнопку повтора.');}
  finally{running=false;}
 }
 async function initialize(){
  journal=read();journal.pending||={};const local=bridge.read();
  try{
   status('Подключаем общий список…');const {data,error}=await sb.from('family_shared_state').select('key,value').limit(2000);if(error)throw error;
   if(data.length===0&&!journal.initialized){for(const [key,value]of Object.entries(local))journal.pending[key]={value,id:crypto.randomUUID()};}
   const remote=Object.fromEntries(data.map(row=>[row.key,row.value]));for(const [key,op]of Object.entries(journal.pending))remote[key]=op.value;
   if(data.length||Object.keys(journal.pending).length){bridge.apply(remote);baseline=bridge.read();}
   journal.cached=remote;journal.initialized=true;persist();initializing=false;await sync();
  }catch(error){initializing=false;status('Нет связи с базой. Меню работает локально, синхронизация повторится при подключении.');}
 }
 el('cloud-refresh').onclick=()=>void sync();window.addEventListener('recipe-change',changed);window.addEventListener('online',()=>void sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});setInterval(()=>{if(!document.hidden)void sync();},15000);void initialize();
})();
