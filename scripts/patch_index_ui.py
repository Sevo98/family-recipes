#!/usr/bin/env python3
"""Patch index.html: recipe likes, CRUD UI, catalog wiring."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
path = ROOT / "index.html"
html = path.read_text(encoding="utf-8")

# CSS additions
css_extra = (
    ".like-btn{border:1px solid #89978a;background:#fff;border-radius:6px;padding:4px 10px;font:inherit;cursor:pointer}"
    ".like-btn[aria-pressed=true]{background:#365b3d;color:#fff;border-color:#365b3d}"
    ".recipe-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}"
    "#recipe-editor{margin:16px 0;padding:16px;background:#e9eee4;border-radius:8px}"
    "#recipe-editor .ing-row,#recipe-editor .step-row{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:6px 0}"
    "#recipe-editor input,#recipe-editor select,#recipe-editor textarea{font:inherit;border:1px solid #89978a;border-radius:5px;padding:8px;max-width:100%}"
    "#recipe-editor textarea{min-height:72px;width:100%}"
    ".recipe-desc{color:#526557;margin:6px 0 10px}"
)

html = html.replace(
    ".print-list-title{display:none}",
    css_extra + ".print-list-title{display:none}",
    1,
)

old_controls = (
    '<div class="controls"><label>Размер порций<select id="portion-scale">'
    '<option value="1">Обычный · 2 человека</option>'
    '<option value="1.25">На 25% больше · 2 человека</option>'
    '<option value="1.5">На 50% больше · 2 человека</option></select></label>'
    '<label>Найти рецепт<input type="search" id="recipe-search" placeholder="Например: котлеты или завтрак"></label>'
    '<label>Приём пищи<select id="recipe-meal"><option value="all">Все</option><option>Завтрак</option><option>Обед</option><option>Ужин</option></select></label>'
    '<label>День меню<select id="recipe-day"><option value="all">Все дни</option></select></label></div>\n'
    '<p class="status" id="recipe-status" aria-live="polite"></p>'
    '<div class="tools"><button id="expand-recipes">Раскрыть найденные рецепты</button>'
    '<button id="collapse-recipes">Свернуть рецепты</button></div>\n'
    '<div id="recipe-list"></div>'
)

new_controls = (
    '<div class="controls"><label>Размер порций<select id="portion-scale">'
    '<option value="1">Обычный · 2 человека</option>'
    '<option value="1.25">На 25% больше · 2 человека</option>'
    '<option value="1.5">На 50% больше · 2 человека</option></select></label>'
    '<label>Найти рецепт<input type="search" id="recipe-search" placeholder="Например: котлеты или завтрак"></label>'
    '<label>Приём пищи<select id="recipe-meal"><option value="all">Все</option><option>Завтрак</option><option>Обед</option><option>Ужин</option></select></label>'
    '<label>День меню<select id="recipe-day"><option value="all">Все дни</option></select></label>'
    '<label>Сортировка<select id="recipe-sort"><option value="menu">По меню</option><option value="likes">По лайкам</option><option value="title">По названию</option></select></label></div>\n'
    '<p class="status" id="recipe-status" aria-live="polite"></p>'
    '<div class="tools"><button type="button" id="recipe-add">Добавить рецепт</button>'
    '<button id="expand-recipes">Раскрыть найденные рецепты</button>'
    '<button id="collapse-recipes">Свернуть рецепты</button></div>\n'
    '<div id="recipe-editor" class="hidden no-print" aria-live="polite"></div>\n'
    '<div id="recipe-list"></div>'
)

if old_controls not in html:
    raise SystemExit("recipe controls block not found")
html = html.replace(old_controls, new_controls, 1)

# Replace recipeCard + renderRecipes functions
recipe_card_re = re.compile(
    r"function recipeCard\(r\)\{return `.*?`;\}\n"
    r"function renderRecipes\(\)\{.*?\n\}\n",
    re.S,
)

new_fns = r'''function productName(key){const p=MENU.products[key];return p?p.name:key;}
function recipeCard(r){
 const ings=(r.ingredients||[]).map(([k,q])=>{const p=MENU.products[k];if(!p)return `<li>${esc(k)} — <b>${esc(String(q))}</b></li>`;return `<li>${esc(p.name)} — <b>${esc(fmt(scaled(q,k),p.unit))}</b></li>`;}).join('');
 const likes=Number(r.likesCount||0);
 return `<details class="recipe-detail" id="recipe-${r.id}"><summary>${esc(r.title)}<small>${esc(r.meal)} · ${r.days.length?'дни '+r.days.join(', '):'вариант на замену'} · ${r.servings} порции${r.perOccurrence?' на один день':''} · ${esc(r.mins)} · ♥ ${likes}</small></summary><div class="recipe-actions no-print"><button type="button" class="like-btn" data-like="${r.id}" aria-pressed="${r.liked?'true':'false'}">${r.liked?'♥':'♡'} ${likes}</button><button type="button" data-edit-recipe="${r.id}">Изменить</button><button type="button" data-delete-recipe="${r.id}">Удалить</button></div>${r.description?`<p class="recipe-desc">${esc(r.description)}</p>`:''}<div class="recipe-body"><div><h3>Ингредиенты</h3><ul class="ingredients">${ings}</ul><p><small>${r.perOccurrence?'Количество на один указанный день для двоих. Заготовки можно сделать на несколько дней; салаты с зеленью собирайте и заправляйте перед едой.':'Количество на весь блок: разделите готовое блюдо на '+r.servings+' порций.'}${Number(state.scale)>1?' Порции увеличены, яйца и булочки округлены до целых.':''}</small></p></div><div><h3>Как приготовить</h3><ol class="steps">${(r.steps||[]).map(s=>'<li>'+esc(s)+'</li>').join('')}</ol>${Number(state.scale)>1?'<p><small>Вода в шагах дана для обычной партии: увеличьте её пропорционально, затем корректируйте по густоте. Для увеличенной партии может понадобиться более крупная форма и больше времени. Делите блюдо на прежнее число более крупных порций.</small></p>':''}<p class="meta">${r.meal==='Салат'?'Зелень вымойте и обсушите. Заправку храните отдельно, смешивайте с салатом перед едой.':r.meal==='Завтрак'?'Заготовки для будущих недель замораживайте порциями.':'Готовое блюдо быстро охладите и уберите в холодильник; используйте в дни этого блока. Свежие овощи и соусы храните отдельно.'} Подробные правила — в разделе <a href="#storage">«Хранение»</a>.</p></div></div></details>`;
}
function bindRecipeActions(root){
 (root||document).querySelectorAll('[data-like]').forEach(btn=>btn.addEventListener('click',async()=>{
  const id=btn.dataset.like;if(!window.catalogApi)return;
  btn.disabled=true;try{await window.catalogApi.toggleLike(id);}catch(err){alert('Не удалось сохранить лайк: '+(err?.message||err));}finally{btn.disabled=false;rerenderCatalogViews();}
 }));
 (root||document).querySelectorAll('[data-edit-recipe]').forEach(btn=>btn.addEventListener('click',()=>openRecipeEditor(btn.dataset.editRecipe)));
 (root||document).querySelectorAll('[data-delete-recipe]').forEach(btn=>btn.addEventListener('click',async()=>{
  const id=btn.dataset.deleteRecipe,r=MENU.recipes.find(x=>x.id===id);if(!r||!confirm('Удалить рецепт «'+r.title+'»?'))return;
  try{await window.catalogApi.deleteRecipe(id);rerenderCatalogViews();}catch(err){alert('Не удалось удалить: '+(err?.message||err));}
 }));
}
function renderRecipes(){
 const q=$('recipe-search').value.toLocaleLowerCase('ru').trim(), meal=$('recipe-meal').value, day=$('recipe-day').value, sort=$('recipe-sort')?$('recipe-sort').value:'menu';
 let list=MENU.recipes.filter(r=>r.meal!=='Перекус'&&r.meal!=='Салат'&&(meal==='all'||r.meal===meal)&&(day==='all'||r.days.includes(Number(day)))&&(!q||(r.title+' '+r.meal+' '+(r.description||'')+' '+r.ingredients.map(([k])=>productName(k)).join(' ')).toLocaleLowerCase('ru').includes(q)));
 if(sort==='likes')list=list.slice().sort((a,b)=>(Number(b.likesCount)||0)-(Number(a.likesCount)||0)||a.title.localeCompare(b.title,'ru'));
 else if(sort==='title')list=list.slice().sort((a,b)=>a.title.localeCompare(b.title,'ru'));
 $('recipe-status').textContent=list.length+' рецептов · количества на выбранный размер порций';
 $('recipe-list').innerHTML=list.map(recipeCard).join('');
 bindRecipeActions($('recipe-list'));
}
function productOptions(selected){
 return Object.entries(MENU.products).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru')).map(([id,p])=>`<option value="${esc(id)}"${id===selected?' selected':''}>${esc(p.name)} (${esc(p.unit)})</option>`).join('');
}
function emptyIngRow(productId='',qty=''){return `<div class="ing-row"><label>Продукт<select name="product">${productOptions(productId)}</select></label><label>Кол-во<input name="qty" type="number" min="0.01" step="any" value="${esc(qty)}" required style="width:110px"></label><button type="button" data-remove-ing>Убрать</button></div>`;}
function emptyStepRow(text=''){return `<div class="step-row"><textarea name="step" rows="2">${esc(text)}</textarea><button type="button" data-remove-step>Убрать</button></div>`;}
function openRecipeEditor(id){
 const editor=$('recipe-editor');if(!editor)return;
 const r=id?MENU.recipes.find(x=>x.id===id):null;
 const days=(r?.days||[]).join(', ');
 editor.classList.remove('hidden');
 editor.innerHTML=`<h3 style="margin-top:0">${r?'Изменить рецепт':'Новый рецепт'}</h3>
<form id="recipe-form">
<input type="hidden" name="id" value="${esc(r?.id||'')}">
<div class="controls">
<label>Название<input name="title" required maxlength="120" value="${esc(r?.title||'')}"></label>
<label>Приём пищи<select name="meal"><option>Завтрак</option><option>Обед</option><option>Ужин</option><option>Салат</option><option>Перекус</option></select></label>
<label>Время<input name="mins" maxlength="80" value="${esc(r?.mins||'')}" placeholder="20 мин работы · 40 мин всего"></label>
<label>Порции<input name="servings" type="number" min="1" step="1" value="${esc(r?.servings||2)}" required></label>
<label>Дни меню<input name="days" value="${esc(days)}" placeholder="1, 2, 3"></label>
<label class="inline"><input name="perOccurrence" type="checkbox"${r?.perOccurrence?' checked':''}>На каждый день отдельно</label>
</div>
<label style="display:block;margin:8px 0">Краткое описание<textarea name="description" maxlength="400">${esc(r?.description||'')}</textarea></label>
<label style="display:block;margin:8px 0">Подсказка<textarea name="tip" maxlength="400">${esc(r?.tip||'')}</textarea></label>
<h4>Состав</h4><div id="recipe-ings">${(r?.ingredients?.length?r.ingredients:[['','']]).map(([k,q])=>emptyIngRow(k,q)).join('')}</div>
<div class="tools"><button type="button" id="add-ing-row">Добавить ингредиент</button><button type="button" id="add-product-mini">Новый продукт в базу</button></div>
<div id="new-product-box" class="hidden controls" style="margin-top:8px">
<label>Название продукта<input id="np-name" maxlength="80"></label>
<label>Единица<select id="np-unit"><option>г</option><option>мл</option><option>шт.</option></select></label>
<label>Группа закупок<select id="np-group"><option value="month">Месяц</option><option value="week">Неделя</option><option value="day">День</option></select></label>
<label>Категория<select id="np-category">${Object.entries(PRODUCT_CATEGORIES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
<button type="button" id="np-save">Сохранить продукт</button>
</div>
<h4>Шаги</h4><div id="recipe-steps">${(r?.steps?.length?r.steps:['']).map(emptyStepRow).join('')}</div>
<div class="tools"><button type="button" id="add-step-row">Добавить шаг</button></div>
<p id="recipe-form-status" class="status"></p>
<div class="tools"><button type="submit">Сохранить рецепт</button><button type="button" id="recipe-form-cancel">Отмена</button></div>
</form>`;
 const form=$('recipe-form');
 form.meal.value=r?.meal||'Обед';
 const bindRemove=(sel,parent)=>editor.querySelectorAll(sel).forEach(btn=>btn.onclick=()=>{if(parent.children.length>1)btn.closest('div').remove();});
 bindRemove('[data-remove-ing]',$('recipe-ings'));
 bindRemove('[data-remove-step]',$('recipe-steps'));
 $('add-ing-row').onclick=()=>{$('recipe-ings').insertAdjacentHTML('beforeend',emptyIngRow());bindRemove('[data-remove-ing]',$('recipe-ings'));};
 $('add-step-row').onclick=()=>{$('recipe-steps').insertAdjacentHTML('beforeend',emptyStepRow());bindRemove('[data-remove-step]',$('recipe-steps'));};
 $('add-product-mini').onclick=()=>$('new-product-box').classList.toggle('hidden');
 $('np-save').onclick=async()=>{
  const name=$('np-name').value.trim();if(!name)return;
  try{
   const pid=await window.catalogApi.upsertProduct({name,unit:$('np-unit').value,group:$('np-group').value,category:$('np-category').value,note:''});
   $('recipe-ings').querySelectorAll('select[name=product]').forEach(sel=>{const v=sel.value;sel.innerHTML=productOptions(v);});
   const last=$('recipe-ings').querySelector('.ing-row:last-child select[name=product]');if(last)last.value=pid;
   $('np-name').value='';$('new-product-box').classList.add('hidden');
   $('recipe-form-status').textContent='Продукт добавлен в базу.';
  }catch(err){$('recipe-form-status').textContent='Ошибка продукта: '+(err?.message||err);}
 };
 $('recipe-form-cancel').onclick=()=>{editor.classList.add('hidden');editor.innerHTML='';};
 form.onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(form);
  const ingredients=[...$('recipe-ings').querySelectorAll('.ing-row')].map(row=>[row.querySelector('[name=product]').value,Number(row.querySelector('[name=qty]').value)]).filter(x=>x[0]&&Number.isFinite(x[1])&&x[1]>0);
  const steps=[...$('recipe-steps').querySelectorAll('[name=step]')].map(el=>el.value.trim()).filter(Boolean);
  const daysStr=String(fd.get('days')||'');
  const days=[...new Set(daysStr.split(/[,;\s]+/).map(Number).filter(n=>Number.isFinite(n)&&n>=1&&n<=30))];
  const payload={
   id:String(fd.get('id')||'')||undefined,
   title:String(fd.get('title')||'').trim(),
   meal:String(fd.get('meal')||'Обед'),
   mins:String(fd.get('mins')||'').trim(),
   servings:Number(fd.get('servings')||2),
   perOccurrence:!!$('recipe-form').perOccurrence.checked,
   days,steps,tip:String(fd.get('tip')||'').trim(),description:String(fd.get('description')||'').trim(),
   ingredients,isCustom:true
  };
  if(!payload.title||!ingredients.length||!steps.length){$('recipe-form-status').textContent='Нужны название, хотя бы один ингредиент и один шаг.';return;}
  $('recipe-form-status').textContent='Сохраняем…';
  try{
   const savedId=await window.catalogApi.saveRecipe(payload);
   editor.classList.add('hidden');editor.innerHTML='';
   rerenderCatalogViews();
   openRecipe(savedId);
  }catch(err){$('recipe-form-status').textContent='Ошибка: '+(err?.message||err);}
 };
 editor.scrollIntoView({behavior:'smooth',block:'start'});
}
function rerenderCatalogViews(){renderRecipes();renderSalads();renderShop();renderMainLinks();renderToday();}
'''

match = recipe_card_re.search(html)
if not match:
    raise SystemExit("recipeCard/renderRecipes block not found")
html = html[: match.start()] + new_fns + html[match.end() :]

# Update renderSalads ingredient search + bind actions
html = html.replace(
    "(!q||(r.title+' '+r.ingredients.map(([k])=>MENU.products[k].name).join(' ')).toLocaleLowerCase('ru').includes(q)));\n"
    " $('salad-status').textContent=list.length+' из '+catalog.length+' рецептов салатов';\n"
    " $('salad-list').innerHTML=list.map(r=>recipeCard({...r,days:Array.from({length:30},(_,i)=>i+1).filter(d=>selectedSalad(d)===r.id)})).join('');\n}",
    "(!q||(r.title+' '+r.ingredients.map(([k])=>productName(k)).join(' ')).toLocaleLowerCase('ru').includes(q)));\n"
    " $('salad-status').textContent=list.length+' из '+catalog.length+' рецептов салатов';\n"
    " $('salad-list').innerHTML=list.map(r=>recipeCard({...r,days:Array.from({length:30},(_,i)=>i+1).filter(d=>selectedSalad(d)===r.id)})).join('');\n"
    " bindRecipeActions($('salad-list'));\n}",
    1,
)

# Fix salad kind filter for non-s ids
html = html.replace(
    "catalog.filter(r=>(Number(r.id.slice(1))>=11?'classic':'green')===kind)",
    "catalog.filter(r=>saladKind(r)===kind)",
    1,
)
html = html.replace(
    "const list=catalog.filter(r=>(kind==='all'||(Number(r.id.slice(1))>=11?'classic':'green')===kind)",
    "const list=catalog.filter(r=>(kind==='all'||saladKind(r)===kind)",
    1,
)

# Insert saladKind helper after productName if missing - add near selectedSalad
if "function saladKind(" not in html:
    html = html.replace(
        "function selectedSalad(day){",
        "function saladKind(r){const m=/^s(\\d+)$/.exec(r.id);if(!m)return 'green';return Number(m[1])>=11?'classic':'green';}\nfunction selectedSalad(day){",
        1,
    )

# Wire controls: recipe-sort, recipe-add, catalog-change
html = html.replace(
    "for(const id of ['recipe-search','recipe-meal','recipe-day'])$(id).addEventListener(id==='recipe-search'?'input':'change',renderRecipes);",
    "for(const id of ['recipe-search','recipe-meal','recipe-day','recipe-sort'])if($(id))$(id).addEventListener(id==='recipe-search'?'input':'change',renderRecipes);\n"
    "if($('recipe-add'))$('recipe-add').onclick=()=>openRecipeEditor(null);\n"
    "window.addEventListener('catalog-change',()=>rerenderCatalogViews());",
    1,
)

# Fix duplicate menu-data / move catalog before app script, clean footer scripts
html = html.replace(
    '<script src="./menu-data.js"></script>\n<script>\nlet MENU=',
    '<script src="./menu-data.js"></script>\n<script src="./catalog.js"></script>\n<script>\nlet MENU=',
    1,
)
html = html.replace(
    '<script src="./menu-data.js"></script><script src="./catalog.js"></script><script src="./supabase-2.117.2.js"></script><script src="./cloud.js?v=catalog-20261012"></script><script src="./pwa.js"></script>',
    '<script src="./supabase-2.117.2.js"></script><script src="./cloud.js?v=catalog-20261012"></script><script src="./pwa.js"></script>',
    1,
)

# Harden scaled() for missing products
html = html.replace(
    "function scaled(q,key){return MENU.products[key].unit==='шт.'?Math.ceil(q*Number(state.scale)):q*Number(state.scale);}",
    "function scaled(q,key){const p=MENU.products[key];return (p&&p.unit==='шт.')?Math.ceil(q*Number(state.scale)):q*Number(state.scale);}",
    1,
)

# Harden aggregate for missing products
html = html.replace(
    "for(const [key,q] of r.ingredients){\n   const p=MENU.products[key];if(p.group!==group)continue;",
    "for(const [key,q] of r.ingredients){\n   const p=MENU.products[key];if(!p||p.group!==group)continue;",
    1,
)

path.write_text(html, encoding="utf-8")
print("patched", path, path.stat().st_size)
