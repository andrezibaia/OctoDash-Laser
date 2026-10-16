#!/usr/bin/env python3
"""Checks OctoDash-Laser translations: every string sent through tr()/lzt has an English entry,
and no Portuguese text is left untranslated in the laser templates. Run from the repo root."""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
i18n = (SRC / "services/laser/laser-i18n.ts").read_text()
en_block = i18n[i18n.index("export const EN"):]
keys = set()
for m in re.finditer(r"^\s+(?:'((?:[^'\\]|\\.)*)'|([A-Za-zÀ-ÿ.]+)):", en_block, re.M):
    keys.add((m.group(1) or m.group(2)).replace("\\'", "'"))

IDENTICAL = {"Home", "Home ($H)", "Laser"}  # same in both languages
files = [p for d in ("components/laser", "services/laser") for p in (SRC / d).rglob("*") if p.suffix in (".ts", ".html")]
files = [p for p in files if p.name != "laser-i18n.ts"]
files += [SRC / "components/standby/standby.component.html", SRC / "components/notification/notification.component.html"]

used = set()
lit = r"'((?:[^'\\]|\\.)*)'"


def balanced(text, start):
    """Return the text inside the parentheses that open at text[start]."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return text[start + 1 : i]
    return ""


def strings(expr):
    expr = re.sub(r"[!=]==\s*'[^']*'", " ", expr)  # comparison operands are code, not text
    return re.findall(lit, expr)


for p in files:
    t = re.sub(r"/\*.*?\*/", "", p.read_text(), flags=re.S)
    t = re.sub(r"^\s*//[^\n]*$", "", t, flags=re.M)
    for m in re.finditer(r"\btr\(", t):
        used.update(strings(balanced(t, m.end() - 1)))
    for m in re.finditer(r"(\((?:[^()]|\([^()]*\))*\)|" + lit + r")\s*\|\s*lzt", t):
        used.update(strings(m.group(1)))
# labels passed through template contexts / section tables, translated with `label | lzt`
settings = SRC / "components/laser/settings"
for f in settings.glob("*"):
    used.update(re.findall(r"(?:label|hint): '([^']+)'", f.read_text()))
# strings translated indirectly (tables passed to tr at render time)
for f, pat in (
    ("components/laser/shared/lz-alarms.ts", r"(?:title|help): '([^']+)'"),
    ("components/laser/shared/lz-format.ts", r"'([a-z]{3})'"),
):
    used.update(re.findall(pat, (SRC / f).read_text()))
bar = (SRC / "components/laser/shared/lz-status-bar.component.ts").read_text()
used.update(re.findall(r"\]: '([^']+)'", bar[bar.index("LASER_STATE_LABEL") : bar.index("LASER_STATE_TONE")]))
schema = json.loads((SRC / "helper/config.schema.json").read_text())
used.update(schema["properties"]["laser"]["properties"]["checklist"]["default"])
used -= {"array", "string", "type", "items", "default", "checklist", "—"}

CODE = re.compile(r"^(?:[0-9 .]*B|[a-z-]{1,8})$")  # e.g. '0 B', 'map' — values, not UI text
missing = sorted(k for k in used if k not in keys and k not in IDENTICAL and not CODE.match(k) and re.search(r"[a-zA-Zà-ú]", k))
unused = sorted(k for k in keys if k not in used)

# untranslated Portuguese text nodes in templates
pt_words = re.compile(r"\b(?:de|da|do|para|não|ção|ões|ar|ir|mover|trabalho|câmara|origem|ligar|parar)\b|[ãõçáéíóúâêô]", re.I)
leftovers = []
for p in files:
    t = p.read_text()
    if p.suffix == ".ts":
        m = re.search(r"template:\s*`(.*?)`", t, re.S)
        if not m:
            continue
        t = m.group(1)
    elif p.suffix != ".html":
        continue
    stripped = re.sub(r"\{\{.*?\}\}", " ", t, flags=re.S)
    stripped = re.sub(r"<[^>]*>", "\n", stripped, flags=re.S)
    for line in stripped.splitlines():
        line = line.strip()
        if line and re.search(r"[A-Za-zÀ-ÿ]{3,}", line) and pt_words.search(line) and not line.startswith("@") and line != "Português":
            leftovers.append(f"{p.relative_to(SRC)}: {line}")

print(f"chaves usadas: {len(used)} · no dicionário: {len(keys)}")
for k in missing:
    print("FALTA EN:", k)
for k in unused:
    print("sem uso (ok):", k)
for line in leftovers:
    print("TEXTO PT SEM TRADUÇÃO:", line)
sys.exit(1 if missing or leftovers else 0)
