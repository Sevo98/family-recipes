#!/usr/bin/env python3
"""Generate supabase/migrations/002_seed_from_menu.sql from menu-data.js."""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
MENU_JS = ROOT / "menu-data.js"
OUT = ROOT / "supabase" / "migrations" / "002_seed_from_menu.sql"


def esc(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    raw = MENU_JS.read_text(encoding="utf-8")
    menu = json.loads(raw.split("=", 1)[1].rstrip().rstrip(";"))
    lines = ["-- Seed from original MENU catalog", "begin;"]
    for pid, product in menu["products"].items():
        lines.append(
            "insert into public.products (id, name, unit, group_key, category, note) values ("
            f"{esc(pid)}, {esc(product['name'])}, {esc(product['unit'])}, "
            f"{esc(product['group'])}, {esc(product['category'])}, "
            f"{esc(product.get('note') or '')}"
            ") on conflict (id) do update set name=excluded.name, unit=excluded.unit, "
            "group_key=excluded.group_key, category=excluded.category, note=excluded.note;"
        )
    for recipe in menu["recipes"]:
        days = json.dumps(recipe.get("days") or [], ensure_ascii=False)
        steps = json.dumps(recipe.get("steps") or [], ensure_ascii=False)
        per = "true" if recipe.get("perOccurrence") else "false"
        lines.append(
            "insert into public.recipes (id, title, meal, mins, servings, per_occurrence, days, steps, tip, description, is_custom) values ("
            f"{esc(recipe['id'])}, {esc(recipe['title'])}, {esc(recipe['meal'])}, "
            f"{esc(recipe['mins'])}, {int(recipe['servings'])}, {per}, "
            f"{esc(days)}::jsonb, {esc(steps)}::jsonb, {esc(recipe.get('tip') or '')}, '', false"
            ") on conflict (id) do update set title=excluded.title, meal=excluded.meal, mins=excluded.mins, "
            "servings=excluded.servings, per_occurrence=excluded.per_occurrence, days=excluded.days, "
            "steps=excluded.steps, tip=excluded.tip, is_custom=excluded.is_custom;"
        )
        lines.append(f"delete from public.recipe_ingredients where recipe_id={esc(recipe['id'])};")
        for index, (product_id, qty) in enumerate(recipe["ingredients"]):
            lines.append(
                "insert into public.recipe_ingredients (recipe_id, product_id, quantity, sort_order) values ("
                f"{esc(recipe['id'])}, {esc(product_id)}, {qty}, {index});"
            )
    lines.append("commit;")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
