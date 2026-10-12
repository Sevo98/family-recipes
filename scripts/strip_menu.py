#!/usr/bin/env python3
"""Replace inline MENU in index.html with seed/catalog script tags."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
path = ROOT / "index.html"
html = path.read_text(encoding="utf-8")
pattern = re.compile(r"const MENU=\{.*?\};\nconst PRODUCT_CATEGORIES", re.S)
replacement = (
    "let MENU={products:{},recipes:[],saladMeals:{},saladPlan:{}};\n"
    "if(window.MENU_SEED){MENU={products:structuredClone(MENU_SEED.products),"
    "recipes:MENU_SEED.recipes.map(r=>({...structuredClone(r),likesCount:0,liked:false,description:r.description||'',isCustom:false})),"
    "saladMeals:structuredClone(MENU_SEED.saladMeals),saladPlan:structuredClone(MENU_SEED.saladPlan)};}\n"
    "const PRODUCT_CATEGORIES"
)
new_html, count = pattern.subn(replacement, html, count=1)
if count != 1:
    raise SystemExit(f"MENU replacement failed, count={count}")

# Load menu-data + catalog before the inline app script and ahead of cloud.js
new_html = new_html.replace(
    '<script src="./supabase-2.117.2.js"></script><script src="./cloud.js?v=empty-body-20261009"></script><script src="./pwa.js"></script>',
    '<script src="./menu-data.js"></script><script src="./catalog.js"></script>'
    '<script src="./supabase-2.117.2.js"></script><script src="./cloud.js?v=catalog-20261012"></script><script src="./pwa.js"></script>',
)
# Also load seed before the big inline script that uses MENU
new_html = new_html.replace(
    "<script>\nlet MENU=",
    '<script src="./menu-data.js"></script>\n<script>\nlet MENU=',
    1,
)
path.write_text(new_html, encoding="utf-8")
print("updated index.html", path.stat().st_size)
