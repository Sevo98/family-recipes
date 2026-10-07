/* Supabase 2.117.2, local-first per-key synchronization. No privileged key. */
(() => {
 const el=id=>document.getElementById(id),bridge=window.recipeBridge;
 const URL='https://fckkbcxaghwuyapszwap.supabase.co';
 const sb=window.supabase.createClient(URL,'sb_publishable_N2L5T5GR0UECfCuhRDMoBg_iNxpASMp');
 const PREFIX='family-recipes-cloud-v1:';
 let user=null,baseline=bridge.read(),journal={pending:{}},running=false,initializing=false,generation=0,retrySession=null;
 const status=text=>el('cloud-status').textContent=text;
 const readJournal=id=>{try{return JSON.parse(localStorage.getItem(PREFIX+id))||{pending:{}};}catch{return {pending:{}};}};
 function persist(){try{localStorage.setItem(PREFIX+user.id,JSON.stringify(journal));return true;}catch{status('Не удалось сохранить очередь на устройстве. Не закрывайте страницу до синхронизации.');return false;}}
 function account(){el('cloud-login').hidden=!!user;el('cloud-login-help').hidden=!!user;el('cloud-pwa-login').hidden=!!user;el('cloud-account').hidden=!user;el('cloud-user').textContent=user?'Выполнен вход: '+user.email:'';}
 function changed(){
  const next=bridge.read();
  if(user){for(const key of new Set([...Object.keys(baseline),...Object.keys(next)])){if(JSON.stringify(baseline[key])!==JSON.stringify(next[key]))journal.pending[key]={value:next[key]??null,id:crypto.randomUUID()};}persist();}
  baseline=next;if(user&&!initializing)void sync();
 }
 async function sync(){
  if(!user||running||initializing)return;
  if(!navigator.onLine){status('Нет интернета. Изменения сохранены на устройстве и ждут отправки.');return;}
  if(retrySession){void attach(retrySession,true);return;}
  running=true;const uid=user.id,epoch=generation;
  try{
   status('Синхронизация…');
   // Snapshot the outbox: edits made during requests stay queued.
   const batch={...journal.pending},keys=Object.keys(batch);
   if(keys.length){const {error}=await sb.from('recipe_state').upsert(keys.map(key=>({user_id:uid,key,value:batch[key].value})),{onConflict:'user_id,key'});if(error)throw error;
    if(epoch!==generation)return;
    for(const key of keys)if(journal.pending[key]?.id===batch[key].id)delete journal.pending[key];persist();
   }
   const {data,error}=await sb.from('recipe_state').select('key,value').eq('user_id',uid).limit(2000);if(error)throw error;if(epoch!==generation)return;
   const remote=Object.fromEntries(data.map(row=>[row.key,row.value]));
   for(const [key,op]of Object.entries(journal.pending))remote[key]=op.value;
   if(JSON.stringify(remote)!==JSON.stringify(journal.cached)){bridge.apply(remote);baseline=bridge.read();}journal.cached=remote;persist();
   status(Object.keys(journal.pending).length?'Новые изменения ждут отправки…':'Синхронизировано · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));
  }catch(error){if(epoch===generation)status('Не удалось синхронизировать. Ваши изменения сохранены на этом устройстве. Проверьте интернет или повторите вход.');}
  finally{running=false;}
 }
 async function attach(session,force=false){
  const next=session?.user||null;
  if(!force&&next?.id===user?.id){account();if(!next)status('Локальный режим: сохранения доступны только в этом браузере.');return;}
  generation++;user=next;retrySession=null;account();
  if(!user){status('Локальный режим: сохранения доступны только в этом браузере.');return;}
  initializing=true;
  const epoch=generation,guest=bridge.read();journal=readJournal(user.id);journal.pending||={};
  // Never silently import another account's data into a new account.
  const previous=localStorage.getItem(PREFIX+'owner');
  baseline=bridge.read();
  try{
   status('Загружаем ваши сохранения…');
   const {data,error}=await sb.from('recipe_state').select('key,value').eq('user_id',user.id).limit(2000);if(error)throw error;if(epoch!==generation)return;
   if(data.length===0&&!previous){for(const [key,value]of Object.entries(guest))if(!journal.pending[key])journal.pending[key]={value,id:crypto.randomUUID()};}
   const merged=Object.fromEntries(data.map(row=>[row.key,row.value]));for(const [key,op]of Object.entries(journal.pending))merged[key]=op.value;
   bridge.apply(merged);baseline=bridge.read();journal.cached=merged;persist();localStorage.setItem(PREFIX+'owner',user.id);
  }catch(error){
   if(epoch!==generation)return;
   retrySession=session;
   const cached={...(journal.cached||{})};for(const [key,op]of Object.entries(journal.pending))cached[key]=op.value;
   if(journal.cached||previous&&previous!==user.id){bridge.apply(cached);baseline=bridge.read();}
   status('Нет связи с базой. Изменения будут отправлены после подключения.');
  }finally{if(epoch===generation){initializing=false;if(!retrySession)void sync();}}
 }
 function errorText(error){if(error?.status===429)return 'Слишком много запросов. Подождите несколько минут перед повторной попыткой.';if(error?.code==='email_address_not_authorized')return 'Пока используйте email владельца проекта Supabase. Для других адресов нужно подключить почтовый сервис.';return 'Не удалось войти. Проверьте адрес, интернет и срок действия ссылки; при необходимости запросите новую.';}
 el('cloud-login').onsubmit=async event=>{event.preventDefault();const button=el('cloud-send');button.disabled=true;status('Отправляем ссылку…');try{const {error}=await sb.auth.signInWithOtp({email:el('cloud-email').value.trim(),options:{emailRedirectTo:'https://sevo98.github.io/family-recipes/'}});if(error)throw error;status('Письмо отправлено. Откройте ссылку на этом устройстве или вставьте её ниже для входа в приложении. Проверьте также «Спам».');}catch(error){status(errorText(error));}finally{button.disabled=false;}};
 el('cloud-link-form').onsubmit=async event=>{event.preventDefault();try{
  const link=new window.URL(el('cloud-link').value.trim());el('cloud-link').value='';
  if(link.origin!==URL||link.pathname!=='/auth/v1/verify'||!link.searchParams.get('token'))throw Error('invalid link');
  const {error}=await sb.auth.verifyOtp({token_hash:link.searchParams.get('token'),type:'email'});if(error)throw error;
 }catch(error){status(errorText(error));}};
 el('cloud-refresh').onclick=()=>void sync();
 el('cloud-logout').onclick=async()=>{
  if(running||initializing){status('Дождитесь окончания синхронизации перед выходом.');return;}
  if(Object.keys(journal.pending).length&&!confirm('Есть неотправленные изменения. Они останутся в очереди для этого аккаунта. Выйти?'))return;
  const {error}=await sb.auth.signOut({scope:'local'});if(error){status('Не удалось выйти. Проверьте подключение.');return;}
  bridge.apply({});baseline=bridge.read();
 };
 window.addEventListener('recipe-change',changed);
 window.addEventListener('online',()=>void sync());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
 setInterval(()=>{if(!document.hidden)void sync();},15000);
 sb.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>void attach(session),0);});
 sb.auth.getSession().then(({data,error})=>{if(error){status('Не удалось восстановить вход. Войдите заново.');return;}void attach(data.session);});
})();
