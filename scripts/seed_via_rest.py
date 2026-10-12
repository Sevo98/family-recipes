#!/usr/bin/env python3
"""Upsert catalog into Supabase REST after 001_catalog.sql has been applied."""
from __future__ import annotations

import json
import pathlib
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://fckkbcxaghwuyapszwap.supabase.co/rest/v1"
KEY = "sb_publishable_N2L5T5GR0UECfCuhRDMoBg_iNxpASMp"


def request(path: str, method: str = "GET", body: object | None = None, prefer: str = "return=minimal") -> object:
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {path} -> {exc.code}: {detail[:400]}") from exc


def chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> None:
    menu = json.loads((ROOT / "menu-data.js").read_text(encoding="utf-8").split("=", 1)[1].rstrip().rstrip(";"))
    probe = request("/products?select=id&limit=1")
    print("products reachable, sample:", probe)

    product_rows = [
        {
            "id": pid,
            "name": p["name"],
            "unit": p["unit"],
            "group_key": p["group"],
            "category": p.get("category") or "other",
            "note": p.get("note") or "",
        }
        for pid, p in menu["products"].items()
    ]
    for batch in chunks(product_rows, 40):
        request("/products?on_conflict=id", "POST", batch, "resolution=merge-duplicates,return=minimal")
    print("upserted products", len(product_rows))

    recipe_rows = [
        {
            "id": r["id"],
            "title": r["title"],
            "meal": r["meal"],
            "mins": r.get("mins") or "",
            "servings": r.get("servings") or 2,
            "per_occurrence": bool(r.get("perOccurrence")),
            "days": r.get("days") or [],
            "steps": r.get("steps") or [],
            "tip": r.get("tip") or "",
            "description": r.get("description") or "",
            "is_custom": False,
        }
        for r in menu["recipes"]
    ]
    for batch in chunks(recipe_rows, 25):
        request("/recipes?on_conflict=id", "POST", batch, "resolution=merge-duplicates,return=minimal")
    print("upserted recipes", len(recipe_rows))

    for r in menu["recipes"]:
        request(f"/recipe_ingredients?recipe_id=eq.{r['id']}", "DELETE")
    ingredient_rows = []
    for r in menu["recipes"]:
        for sort_order, (product_id, quantity) in enumerate(r["ingredients"]):
            ingredient_rows.append(
                {
                    "recipe_id": r["id"],
                    "product_id": product_id,
                    "quantity": quantity,
                    "sort_order": sort_order,
                    "note": "",
                }
            )
    for batch in chunks(ingredient_rows, 80):
        request("/recipe_ingredients", "POST", batch)
    print("inserted ingredients", len(ingredient_rows))
    print("done")


if __name__ == "__main__":
    main()
