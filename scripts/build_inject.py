#!/usr/bin/env python3
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
sql_path = root / sys.argv[1]
out_path = root / sys.argv[2]
sql = sql_path.read_text(encoding="utf-8")
expr = (
    "(function(){"
    f"const sql={json.dumps(sql)};"
    "const eds=(window.monaco&&monaco.editor.getEditors)?monaco.editor.getEditors():[];"
    "if(!eds.length){"
    "const ta=document.querySelector('.monaco-editor textarea, textarea');"
    "if(ta){ta.focus();ta.value=sql;ta.dispatchEvent(new Event('input',{bubbles:true}));"
    "return {ok:true,via:'textarea',len:sql.length};}"
    "return {ok:false,reason:'no-editors'};"
    "}"
    "eds[0].setValue(sql);"
    "return {ok:true,via:'monaco',len:eds[0].getValue().length};"
    "})()"
)
out_path.write_text(expr, encoding="utf-8")
print(out_path, len(expr))
