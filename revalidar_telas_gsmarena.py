import argparse
import json
import re
import time
import urllib.parse
import urllib.request

BASE_API = "http://127.0.0.1:5276"
USUARIO = "admin"
SENHA = "Admin@4552"


def req_json(url: str, method="GET", headers=None, data=None):
    hdr = headers or {}
    payload = None
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
        hdr = {**hdr, "Content-Type": "application/json"}
    req = urllib.request.Request(url, method=method, headers=hdr, data=payload)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "ignore"))


def req_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def login_token() -> str:
    out = req_json(
        f"{BASE_API}/api/conta/login",
        method="POST",
        data={"usuario": USUARIO, "senha": SENHA},
    )
    return out["accessToken"]


def listar_modelos(token: str, marca: str):
    q = urllib.parse.urlencode({"marcaNome": marca, "limite": 800})
    return req_json(
        f"{BASE_API}/api/aparelhos/modelos?{q}",
        headers={"Authorization": f"Bearer {token}"},
    ) or []


def buscar_link_gsmarena(query: str) -> str | None:
    url = "https://www.bing.com/search?q=" + urllib.parse.quote(query + " gsmarena")
    html = req_text(url)
    # Captura primeiro link GSMArena.
    m = re.search(r"https://www\.gsmarena\.com/[a-z0-9_\\-]+\.php", html, flags=re.I)
    if not m:
        return None
    return m.group(0)


def extrair_tipo_tela_gsmarena(url: str) -> str | None:
    html = req_text(url)
    m = re.search(
        r"\|\s*Display\s*\|\s*Type\s*\|\s*([^|\n]+)",
        html,
        flags=re.I,
    )
    if not m:
        return None
    raw = re.sub(r"\s+", " ", m.group(1)).strip()
    up = raw.upper()
    if "AMOLED" in up:
        return "OLED(AMOLED)"
    if "P-OLED" in up:
        return "OLED(P-OLED)"
    if "OLED" in up:
        return "OLED"
    if "IPS" in up:
        return "LCD(IPS)"
    if "LCD" in up:
        return "LCD"
    if "TFT" in up:
        return "LCD(TFT)"
    return None


def atualizar_modelo(token: str, modelo: dict, tipo_tela: str):
    payload = {
        "nome": modelo.get("nome"),
        "marcaId": modelo.get("marcaId"),
        "marcaNome": modelo.get("marcaNome"),
        "tipoDispositivo": modelo.get("tipoDispositivo") or "Celular",
        "tipoTela": tipo_tela,
        "observacoes": modelo.get("observacoes"),
        "aparelhosCompativeis": modelo.get("aparelhosCompativeis") or [],
    }
    req_json(
        f"{BASE_API}/api/aparelhos/modelos/{modelo['id']}",
        method="PUT",
        headers={"Authorization": f"Bearer {token}"},
        data=payload,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--marca", required=True)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--sleep", type=float, default=0.6)
    args = parser.parse_args()

    token = login_token()
    modelos = listar_modelos(token, args.marca)
    modelos = sorted(modelos, key=lambda x: (x.get("nome") or "").lower())
    fatia = modelos[args.offset: args.offset + args.limit]

    print(f"Marca={args.marca} TotalMarca={len(modelos)} Lote={len(fatia)} Offset={args.offset}")
    atualizados = 0
    sem_link = 0
    sem_tipo = 0
    for idx, m in enumerate(fatia, start=1):
        nome = (m.get("nome") or "").strip()
        if not nome:
            sem_tipo += 1
            continue
        query = f"{args.marca} {nome}"
        link = None
        tipo = None
        try:
            link = buscar_link_gsmarena(query)
            if link:
                tipo = extrair_tipo_tela_gsmarena(link)
        except Exception:
            link = None
            tipo = None

        if not link:
            sem_link += 1
            print(f"[{idx}/{len(fatia)}] {nome}: sem link")
            time.sleep(args.sleep)
            continue
        if not tipo:
            sem_tipo += 1
            print(f"[{idx}/{len(fatia)}] {nome}: link ok, sem tipo ({link})")
            time.sleep(args.sleep)
            continue

        atualizar_modelo(token, m, tipo)
        atualizados += 1
        print(f"[{idx}/{len(fatia)}] {nome}: {tipo} ({link})")
        time.sleep(args.sleep)

    print("RESUMO")
    print(f"atualizados={atualizados} sem_link={sem_link} sem_tipo={sem_tipo}")


if __name__ == "__main__":
    main()
