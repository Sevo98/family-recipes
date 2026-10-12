/* Catalog: products, recipes, ingredients and likes via Supabase + local cache. */
(() => {
 const BASE='https://fckkbcxaghwuyapszwap.supabase.co/rest/v1';
 const KEY='sb_publishable_N2L5T5GR0UECfCuhRDMoBg_iNxpASMp';
 const CACHE='meal-plan-catalog-v1';
 const DEVICE='family-recipes-device-id';
 const headers={apikey:KEY,Authorization:'Bearer '+KEY};
 let deviceId='', likedIds=new Set(), ready=false, loading=null;

 function seedMenu(){
  const seed=window.MENU_SEED;
  if(!seed)throw new Error('MENU_SEED missing');
  return {
   products:structuredClone(seed.products),
   recipes:seed.recipes.map(r=>({...structuredClone(r),likesCount:0,liked:false,description:r.description||'',isCustom:!!r.isCustom})),
   saladMeals:structuredClone(seed.saladMeals),
   saladPlan:structuredClone(seed.saladPlan)
  };
 }

 function applyToWindow(catalog){
  const recipes=catalog.recipes.map(r=>{
   const copy={...r};
   if(copy.perOccurrence==null&&copy.per_occurrence!=null)copy.perOccurrence=!!copy.per_occurrence;
   if(!Array.isArray(copy.ingredients))copy.ingredients=[];
   copy.likesCount=Number(copy.likesCount||copy.likes_count||0);
   copy.liked=likedIds.has(copy.id);
   copy.description=copy.description||'';
   copy.isCustom=!!(copy.isCustom??copy.is_custom);
   return copy;
  });
  const next={
   products:catalog.products,
   recipes,
   saladMeals:catalog.saladMeals||window.MENU_SEED.saladMeals,
   saladPlan:catalog.saladPlan||window.MENU_SEED.saladPlan
  };
  // Keep the same object reference as the inline app script's MENU.
  if(window.MENU&&typeof window.MENU==='object'){
   window.MENU.products=next.products;
   window.MENU.recipes=next.recipes;
   window.MENU.saladMeals=next.saladMeals;
   window.MENU.saladPlan=next.saladPlan;
  }else window.MENU=next;
 }

 function readCache(){
  try{return JSON.parse(localStorage.getItem(CACHE)||'null');}catch{return null;}
 }
 function writeCache(catalog){
  try{localStorage.setItem(CACHE,JSON.stringify({products:catalog.products,recipes:catalog.recipes.map(({liked,...r})=>r),saladMeals:catalog.saladMeals,saladPlan:catalog.saladPlan,savedAt:Date.now()}));}catch{}
 }
 function ensureDeviceId(){
  try{
   deviceId=localStorage.getItem(DEVICE)||'';
   if(!/^[0-9a-f-]{36}$/i.test(deviceId)){deviceId=crypto.randomUUID();localStorage.setItem(DEVICE,deviceId);}
  }catch{deviceId=deviceId||('temp-'+Math.random().toString(16).slice(2));}
  return deviceId;
 }

 async function request(path,options={}){
  const response=await fetch(BASE+path,{...options,signal:AbortSignal.timeout(20000),headers:{...headers,...options.headers,...(options.body?{'Content-Type':'application/json'}:{})}});
  if(!response.ok){
   let detail='';try{detail=await response.text();}catch{}
   let msg='Supabase '+response.status;
   try{const parsed=JSON.parse(detail);if(parsed?.message)msg+=' · '+parsed.message;}catch{if(detail)msg+=' · '+detail.slice(0,180);}
   throw new Error(msg);
  }
  if(response.status===204)return null;
  const body=await response.text();
  return body?JSON.parse(body):null;
 }

 function toClientRecipe(row,ingredients){
  return {
   id:row.id,
   title:row.title,
   meal:row.meal,
   mins:row.mins||'',
   servings:Number(row.servings)||2,
   perOccurrence:!!row.per_occurrence,
   days:Array.isArray(row.days)?row.days:[],
   steps:Array.isArray(row.steps)?row.steps:[],
   tip:row.tip||'',
   description:row.description||'',
   isCustom:!!row.is_custom,
   likesCount:Number(row.likes_count)||0,
   liked:likedIds.has(row.id),
   ingredients:(ingredients||[]).slice().sort((a,b)=>(a.sort_order-b.sort_order)||a.product_id.localeCompare(b.product_id)).map(x=>[x.product_id,Number(x.quantity)])
  };
 }

 function toClientProduct(row){
  return {
   name:row.name,
   unit:row.unit,
   group:row.group_key||row.group,
   note:row.note||'',
   category:row.category||'other',
   kcal_per_100:row.kcal_per_100??null
  };
 }

 async function fetchRemoteCatalog(){
  const [products,recipes,ingredients,likes]=await Promise.all([
   request('/products?select=*&limit=5000'),
   request('/recipes?select=*&limit=5000'),
   request('/recipe_ingredients?select=*&limit=20000'),
   request('/recipe_likes?select=recipe_id&device_id=eq.'+encodeURIComponent(ensureDeviceId())+'&limit=5000')
  ]);
  likedIds=new Set((likes||[]).map(x=>x.recipe_id));
  const byRecipe={};
  for(const row of ingredients||[]){(byRecipe[row.recipe_id]||=[]).push(row);}
  const productMap={};
  for(const row of products||[])productMap[row.id]=toClientProduct(row);
  const recipeList=(recipes||[]).map(row=>toClientRecipe(row,byRecipe[row.id]||[]));
  return {
   products:productMap,
   recipes:recipeList,
   saladMeals:window.MENU_SEED.saladMeals,
   saladPlan:window.MENU_SEED.saladPlan
  };
 }

 async function seedRemoteFromMenu(){
  const seed=window.MENU_SEED;
  const productRows=Object.entries(seed.products).map(([id,p])=>({
   id,name:p.name,unit:p.unit,group_key:p.group,category:p.category||'other',note:p.note||'',kcal_per_100:null
  }));
  // Upsert in chunks to stay under payload limits.
  for(let i=0;i<productRows.length;i+=40){
   await request('/products?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(productRows.slice(i,i+40))});
  }
  const recipeRows=seed.recipes.map(r=>({
   id:r.id,title:r.title,meal:r.meal,mins:r.mins||'',servings:r.servings||2,
   per_occurrence:!!r.perOccurrence,days:r.days||[],steps:r.steps||[],tip:r.tip||'',
   description:r.description||'',is_custom:false
  }));
  for(let i=0;i<recipeRows.length;i+=25){
   await request('/recipes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(recipeRows.slice(i,i+25))});
  }
  const ingredientRows=[];
  for(const r of seed.recipes){
   r.ingredients.forEach(([product_id,quantity],sort_order)=>{
    ingredientRows.push({recipe_id:r.id,product_id,quantity,sort_order,note:''});
   });
  }
  // Clear then insert — ignore failures on empty delete.
  for(const r of seed.recipes){
   try{await request('/recipe_ingredients?recipe_id=eq.'+encodeURIComponent(r.id),{method:'DELETE',headers:{Prefer:'return=minimal'}});}catch{}
  }
  for(let i=0;i<ingredientRows.length;i+=80){
   await request('/recipe_ingredients',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(ingredientRows.slice(i,i+80))});
  }
 }

 function publish(catalog){
  applyToWindow(catalog);
  writeCache({products:window.MENU.products,recipes:window.MENU.recipes,saladMeals:window.MENU.saladMeals,saladPlan:window.MENU.saladPlan});
  ready=true;
  window.dispatchEvent(new Event('catalog-ready'));
  window.dispatchEvent(new Event('catalog-change'));
 }

 async function load(){
  if(loading)return loading;
  loading=(async()=>{
   ensureDeviceId();
   const cached=readCache();
   if(cached?.products&&cached?.recipes?.length){
    likedIds=new Set((cached.recipes||[]).filter(r=>r.liked).map(r=>r.id));
    applyToWindow(cached);
    ready=true;
    window.dispatchEvent(new Event('catalog-ready'));
   }else{
    const local=seedMenu();
    applyToWindow(local);
    ready=true;
    window.dispatchEvent(new Event('catalog-ready'));
   }
   if(!navigator.onLine){loading=null;return window.MENU;}
   try{
    let remote=await fetchRemoteCatalog();
    if(!Object.keys(remote.products).length||!remote.recipes.length){
     await seedRemoteFromMenu();
     remote=await fetchRemoteCatalog();
    }
    publish(remote);
   }catch(error){
    console.warn('Catalog sync failed, using local/seed',error);
    if(!window.MENU)publish(seedMenu());
   }finally{loading=null;}
   return window.MENU;
  })();
  return loading;
 }

 function currentCatalog(){
  return {products:window.MENU.products,recipes:window.MENU.recipes,saladMeals:window.MENU.saladMeals,saladPlan:window.MENU.saladPlan};
 }

 function slugify(text){
  return String(text||'').toLocaleLowerCase('ru').replace(/[^a-z0-9а-яё]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,40)||'item';
 }

 async function upsertProduct(product){
  const id=product.id||('p-'+slugify(product.name)+'-'+crypto.randomUUID().slice(0,8));
  const row={id,name:product.name.trim(),unit:product.unit,group_key:product.group,category:product.category||'other',note:product.note||'',kcal_per_100:product.kcal_per_100??null};
  await request('/products?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row])});
  window.MENU.products[id]=toClientProduct(row);
  writeCache(currentCatalog());
  window.dispatchEvent(new Event('catalog-change'));
  return id;
 }

 async function saveRecipe(recipe){
  const id=recipe.id||('c-'+crypto.randomUUID().slice(0,10));
  const row={
   id,title:recipe.title.trim(),meal:recipe.meal,mins:recipe.mins||'',
   servings:Number(recipe.servings)||2,per_occurrence:!!recipe.perOccurrence,
   days:Array.isArray(recipe.days)?recipe.days.map(Number).filter(n=>n>=1&&n<=30):[],
   steps:Array.isArray(recipe.steps)?recipe.steps.filter(Boolean):[],
   tip:recipe.tip||'',description:recipe.description||'',is_custom:!!recipe.isCustom
  };
  await request('/recipes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([row])});
  await request('/recipe_ingredients?recipe_id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
  const merged=new Map();
  for(const rowIng of (recipe.ingredients||[])){
   if(!rowIng||!rowIng[0]||!(Number(rowIng[1])>0))continue;
   merged.set(rowIng[0],(merged.get(rowIng[0])||0)+Number(rowIng[1]));
  }
  const ingredients=[...merged.entries()];
  if(ingredients.length){
   await request('/recipe_ingredients',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(ingredients.map(([product_id,quantity],sort_order)=>({recipe_id:id,product_id,quantity:Number(quantity),sort_order,note:''})))});
  }
  const existing=window.MENU.recipes.findIndex(r=>r.id===id);
  const next=toClientRecipe({...row,likes_count:existing>=0?window.MENU.recipes[existing].likesCount:0},ingredients.map(([product_id,quantity],sort_order)=>({product_id,quantity,sort_order})));
  if(existing>=0)window.MENU.recipes[existing]=next;else window.MENU.recipes.push(next);
  writeCache(currentCatalog());
  window.dispatchEvent(new Event('catalog-change'));
  return id;
 }

 async function deleteRecipe(id){
  await request('/recipes?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
  window.MENU.recipes=window.MENU.recipes.filter(r=>r.id!==id);
  likedIds.delete(id);
  writeCache(currentCatalog());
  window.dispatchEvent(new Event('catalog-change'));
 }

 async function toggleLike(recipeId){
  ensureDeviceId();
  const recipe=window.MENU.recipes.find(r=>r.id===recipeId);
  if(!recipe)return false;
  const liked=likedIds.has(recipeId);
  if(liked){
   await request('/recipe_likes?recipe_id=eq.'+encodeURIComponent(recipeId)+'&device_id=eq.'+encodeURIComponent(deviceId),{method:'DELETE',headers:{Prefer:'return=minimal'}});
   likedIds.delete(recipeId);
   recipe.liked=false;
   recipe.likesCount=Math.max(0,(Number(recipe.likesCount)||0)-1);
  }else{
   await request('/recipe_likes?on_conflict=recipe_id,device_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{recipe_id:recipeId,device_id:deviceId}])});
   likedIds.add(recipeId);
   recipe.liked=true;
   recipe.likesCount=(Number(recipe.likesCount)||0)+1;
  }
  writeCache(currentCatalog());
  window.dispatchEvent(new Event('catalog-change'));
  return recipe.liked;
 }

 window.catalogApi={
  load,isReady:()=>ready,deviceId:ensureDeviceId,toggleLike,saveRecipe,deleteRecipe,upsertProduct,
  refresh:async()=>{const remote=await fetchRemoteCatalog();publish(remote);return remote;}
 };
 void load();
})();
