#!/usr/bin/env python3
import json
import pathlib
import urllib.request
import zipfile

out = pathlib.Path(__file__).resolve().parents[1] / ".tools" / "supabase"
out.mkdir(parents=True, exist_ok=True)
api = "https://api.github.com/repos/supabase/cli/releases/latest"
with urllib.request.urlopen(api, timeout=60) as resp:
    release = json.load(resp)
asset = next(a for a in release["assets"] if a["name"].endswith("windows_amd64.zip"))
zip_path = out / asset["name"]
print("downloading", asset["browser_download_url"])
urllib.request.urlretrieve(asset["browser_download_url"], zip_path)
with zipfile.ZipFile(zip_path) as zf:
    zf.extractall(out)
exe = next(out.rglob("supabase.exe"))
print("exe", exe)
