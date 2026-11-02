# -*- coding: utf-8 -*-
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

SRC = Path(r"c:\Users\RomuloEmanuelLongoPe\Downloads\Conversa do WhatsApp com LISTA MB MUNDO\Conversa do WhatsApp com LISTA MB MUNDO.txt")
text = SRC.read_text(encoding="utf-8")

msg_re = re.compile(
    r"^(\d{2}/\d{2}/\d{4}) (\d{2}:\d{2}) - (?:([^:\n]+): )?",
    re.M,
)

parts = []
last = None
for m in msg_re.finditer(text):
    if last is not None:
        last["end"] = m.start()
        parts.append(last)
    last = {
        "start": m.start(),
        "date": m.group(1),
        "time": m.group(2),
        "sender": (m.group(3) or "").strip(),
        "header_end": m.end(),
    }
if last:
    last["end"] = len(text)
    parts.append(last)

msgs = []
for p in parts:
    body = text[p["header_end"] : p["end"]].strip()
    msgs.append({**p, "body": body})

senders = defaultdict(int)
for m in msgs:
    senders[m["sender"] or "(sistema)"] += 1

OUT = Path(r"C:\Users\RomuloEmanuelLongoPe\Desktop\DEV\Local\MundoSmart\_tmp_whatsapp_out.txt")
lines = []

def log(s=""):
    lines.append(s)

log(f"MSGS {len(msgs)}")
log(f"FIRST {msgs[0]['date']} {msgs[0]['time']}")
log(f"LAST {msgs[-1]['date']} {msgs[-1]['time']}")
log("SENDERS")
for s, n in sorted(senders.items(), key=lambda x: -x[1])[:20]:
    log(f"  {n:5d}  {s[:60]}")

# price line: model + number with .00 or ,00
price_re = re.compile(
    r"(?P<label>.+?)\s+(?P<price>\d{2,5}(?:[.,]\d{2})?)\s*$",
    re.M,
)

# sold models aliases (normalized)
ALIASES = {
    "a5": "Redmi A5",
    "redmi a5": "Redmi A5",
    "14c": "Redmi 14C",
    "redmi 14c": "Redmi 14C",
    "15c": "Redmi 15C",
    "redmi 15c": "Redmi 15C",
    "redmi 15": "Redmi 15",
    "note 14": "Redmi Note 14",
    "redmi note 14": "Redmi Note 14",
    "note 14s": "Redmi Note 14s",
    "note 14 pro": "Redmi Note 14 Pro",
    "redmi note 14 pro": "Redmi Note 14 Pro",
    "note 14 pro 4g": "Redmi Note 14 Pro",
    "note 14 pro 5g": "Redmi Note 14 Pro 5G",
    "poco c61": "POCO C61",
    "poco c71": "POCO C71",
    "poco c75": "POCO C75",
    "poco c85": "POCO C85",
    "poco x7": "POCO X7",
    "poco x7 pro": "POCO X7 Pro",
    "note 60x": "Note 60x",
    "realme note 60x": "Note 60x",
    "note 60": "Note 60",
    "realme note 60": "Note 60",
    "note 70": "Note 70",
    "realme note 70": "Note 70",
    "c71": "C71",
    "realme c71": "C71",
    "c75x": "C75x",
    "c75 x": "C75x",
    "realme c75 x": "C75x",
    "realme c75x": "C75x",
    "c75": "C75",
    "realme c75": "C75",
    "moto g04s": "Moto G04s",
    "motorola g04s": "Moto G04s",
    "moto g14": "Moto G14",
    "moto g15": "Moto G15",
    "galaxy a04e": "Galaxy A04e",
    "samsung a04e": "Galaxy A04e",
    "a04e": "Galaxy A04e",
    "galaxy a12": "Galaxy A12",
    "samsung a12": "Galaxy A12",
    "a12": "Galaxy A12",
}

SOLD = {
    "C71",
    "C75x",
    "Note 60",
    "Note 60x",
    "Note 70",
    "Galaxy A04e",
    "Galaxy A12",
    "Moto G04s",
    "Moto G14",
    "Moto G15",
    "POCO C61",
    "POCO C75",
    "POCO C85",
    "POCO X7",
    "Redmi 14C",
    "Redmi 15C",
    "Redmi A5",
    "Redmi Note 14",
    "Redmi Note 14 Pro",
}


def norm(s):
    s = s.lower()
    s = s.replace("*", " ")
    s = re.sub(r"\s+", " ", s)
    s = s.replace("poco", "poco").replace("pοco", "poco")
    return s.strip()


def match_model(label):
    n = norm(label)
    n = re.sub(r"\d+\s*/\s*\d+", " ", n)
    n = re.sub(r"\b(gb|nfc|4g|5g)\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # try longest alias first
    for alias, modelo in sorted(ALIASES.items(), key=lambda x: -len(x[0])):
        if re.search(rf"(^| ){re.escape(alias)}( |$)", n):
            return modelo
    return None


found = defaultdict(list)  # modelo -> list of (price, date, raw)
list_msgs = 0
for m in msgs:
    body = m["body"]
    if "ATACADO" in body.upper() or "REDMI" in body.upper() or re.search(r"\d{3,4}[.,]\d{2}", body):
        if len(body) > 200:
            list_msgs += 1
    for line in body.splitlines():
        line = line.strip().strip("*")
        if not line or len(line) > 120:
            continue
        pm = price_re.search(line)
        if not pm:
            continue
        raw_price = pm.group("price").replace(",", ".")
        try:
            price = float(raw_price)
        except ValueError:
            continue
        if price < 80 or price > 8000:
            continue
        label = pm.group("label")
        modelo = match_model(label)
        if modelo and modelo in SOLD:
            found[modelo].append((price, m["date"], line))

log(f"LIST_MSGS_BIG {list_msgs}")
log("--- PRECOS MODELOS VENDIDOS ---")
for modelo in sorted(SOLD):
    xs = found.get(modelo) or []
    if not xs:
        log(f"SEM PRECO\t{modelo}")
        continue
    xs_sorted = sorted(xs, key=lambda t: -t[0])
    mx = xs_sorted[0][0]
    log(f"{modelo}\tmax={mx:.2f}\t+20={mx+20:.2f}\tn={len(xs)}\tmaior='{xs_sorted[0][2]}'\t{xs_sorted[0][1]}")
    seen = []
    for p, d, raw in xs_sorted[:8]:
        key = (p, raw)
        if key in seen:
            continue
        seen.append(key)
        log(f"    {p:.2f}  {d}  {raw}")

# dump unique unmatched price lines that look like phones
log("--- AMOSTRA LINHAS COM PRECO NAO MAPEADAS (possiveis vendidos) ---")
unmatched = defaultdict(int)
for m in msgs:
    for line in m["body"].splitlines():
        line = line.strip().strip("*")
        pm = price_re.search(line)
        if not pm:
            continue
        label = pm.group("label")
        if match_model(label) in SOLD:
            continue
        if re.search(r"tablet|air tag|caneta|jbl|haylou|alexa|fone|caixa", label, re.I):
            continue
        unmatched[line[:90]] += 1
for line, n in sorted(unmatched.items(), key=lambda x: -x[1])[:40]:
    log(f"{n:4d}  {line}")

OUT.write_text("\n".join(lines), encoding="utf-8")
print("WROTE", OUT, "lines", len(lines))
