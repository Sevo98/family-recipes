/* Installation is optional; the menu also works in an ordinary browser. */
(() => {
  const status=document.getElementById('offline-status');
  let ready=false, promptEvent;
  const update=()=>{status.textContent=!navigator.onLine?(ready?'Нет интернета. Меню работает из сохранённой копии.':'Нет интернета.'):(ready?'Меню сохранено для работы без интернета.':'Подготавливаем меню для работы без интернета…');};
  window.addEventListener('online',update);window.addEventListener('offline',update);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;document.getElementById('install-app').hidden=false;});
  document.getElementById('install-app').onclick=async()=>{if(!promptEvent)return;await promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;document.getElementById('install-app').hidden=true;};
  window.addEventListener('appinstalled',()=>{document.getElementById('install-app').hidden=true;document.getElementById('install-help').textContent='Приложение установлено — открывайте меню с главного экрана.';});
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    update();navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{ready=true;update();}).catch(()=>{status.textContent='Не удалось сохранить офлайн-копию. Меню доступно при подключении к интернету.';});
  }else status.textContent='Для установки откройте опубликованный сайт по HTTPS.';
})();
