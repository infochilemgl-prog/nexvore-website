#!/usr/bin/env python3
"""
RADAR COSTERO — Extractor de leads para Temporada Llena™
========================================================
Nicho único: administradores de arriendos turísticos del corredor Concón–Zapallar
(Región de Valparaíso, Chile).

Qué hace:
  1. Recorre una matriz de (nicho × comuna) sobre Google Maps.
  2. De cada negocio saca: nombre, TELÉFONO, web, rating, nº reseñas, categoría,
     dirección y link de Maps.
  3. Lo califica con la lógica de Temporada Llena (sin web = máximo dolor, etc.).
  4. Estima el TRAMO de precio y los DÓLARES que puedes tocar por cada lead.
  5. Deja el primer toque escrito (guion "estudio de arriendos", NO pitch).
  6. Escribe todo a un CSV listo para prospectar por el Motor 1.

Dos motores de datos (elige con --source):
  • scrapling  → scrapea Google Maps con la librería Scrapling (por defecto).
                 Es lo que pediste. Necesita navegador (ver README).
  • api        → Google Places API (New). Más confiable y dentro de los
                 Términos de Google, pero requiere una API key.

USO RÁPIDO (desde TU máquina, no desde la nube):
    cd nexvore-website
    pip install -r scripts/requirements.txt
    scrapling install            # baja el navegador stealth (solo 1 vez)
    python scripts/radar_costero.py --source scrapling --max 20

    # o con la API oficial (más confiable):
    export GOOGLE_PLACES_API_KEY="tu_key"
    python scripts/radar_costero.py --source api --max 40

IMPORTANTE:
  - Scrapear Google Maps va contra los Términos de Google. Úsalo con criterio,
    con los delays puestos, y para tu propia prospección B2B. Para volumen serio
    y sostenible, usa --source api (datos públicos de negocios, vía oficial).
  - El corredor tiene ~150-400 administradores. Esto es prospección quirúrgica,
    no spam masivo. Respeta la "Regla: nunca spam" de tu propio documento.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

# ─────────────────────────────────────────────────────────────
# CONFIG — edita esto y solo esto para cambiar el objetivo
# ─────────────────────────────────────────────────────────────

# Comunas / localidades del corredor Concón–Zapallar (Doc 2, §1)
COMUNAS = [
    "Concón", "Reñaca", "Cochoa", "Montemar", "Las Salinas Viña del Mar",
    "Ritoque", "Quintero", "Puchuncaví", "Horcón", "Maitencillo",
    "Cachagua", "Zapallar", "Papudo", "Quintay",
]

# Términos que delatan a un ADMINISTRADOR (no a un dueño de una sola cabaña).
# El que aparece bajo estas categorías suele manejar varias propiedades.
QUERIES = [
    "administración de propiedades",
    "administración de arriendos turísticos",
    "corretora de propiedades",
    "arriendo de cabañas",
    "departamentos amoblados arriendo turístico",
    "administración airbnb",
    "propiedades vacacionales arriendo",
    "cabañas y departamentos arriendo por día",
]

# Precios de Temporada Llena (Doc 2, §3.3 / Doc 3, §2.2)
TRAMOS = {
    "Base":     {"props": "5-10",  "impl": 450_000, "gestion":   800_000},
    "Estándar": {"props": "11-20", "impl": 600_000, "gestion": 1_100_000},
    "Alto":     {"props": "21-30", "impl": 750_000, "gestion": 1_500_000},
}
CONTRATO_MESES = 3          # contrato mínimo (Doc 2, §3.3)
USD_CLP        = 950        # 9.5M CLP ≈ USD 10.000  → 950 CLP/USD (Doc 2, §1)

# Dolor principal del nicho (Doc 2, §4-S / creencias Doc 3, §2.5)
DOLOR = "Pierde reservas por responder tarde las consultas (Airbnb/WhatsApp) 24/7"

OUT_DEFAULT = os.path.join(os.path.dirname(__file__), "leads", "radar_costero.csv")

# Selectores de la ficha de Google Maps (pueden cambiar; edítalos si Maps rota el DOM)
SEL = {
    "feed_link": "a.hfpxzc",
    "name":      "h1.DUwDvf",
    "rating":    "div.F7nice span[aria-hidden='true']",
    "reviews":   "div.F7nice span[aria-label]",
    "category":  "button[jsaction*='category']",
    "address":   "button[data-item-id='address'] div.Io6YTe",
    "phone":     "button[data-item-id^='phone'] div.Io6YTe",
    "website":   "a[data-item-id='authority'] div.Io6YTe",
}

CSV_COLUMNS = [
    "nombre", "categoria", "comuna", "telefono", "whatsapp_link",
    "web", "tiene_web", "rating", "resenas", "direccion", "url_maps",
    "es_administrador", "score", "prioridad",
    "tramo_estimado", "fee_mensual_clp", "valor_contrato_3m_clp",
    "valor_contrato_usd", "valor_potencial_alto_clp",
    "dolor_principal", "argumento_perdida",
    "toque_1", "toque_2", "toque_3", "toque_4",
    "estado", "fuente", "query_origen", "fecha_registro",
]


# ─────────────────────────────────────────────────────────────
# TELÉFONO — normalización chilena + link de WhatsApp
# ─────────────────────────────────────────────────────────────
def normalizar_telefono(raw):
    """Devuelve (display, whatsapp) para un teléfono chileno."""
    if not raw:
        return "", ""
    digits = re.sub(r"\D", "", raw)
    rest = digits[2:] if digits.startswith("56") else digits.lstrip("0")

    # Móvil chileno: 9 + 8 dígitos
    if len(rest) == 9 and rest.startswith("9"):
        display = f"+56 9 {rest[1:5]} {rest[5:]}"
        wa = f"https://wa.me/56{rest}"
        return display, wa

    # Fijo (ej. Valparaíso 32XXXXXXX): mostrable, pero WhatsApp no aplica
    if len(rest) in (8, 9):
        return f"+56 {rest}", ""

    return raw.strip(), ""


# ─────────────────────────────────────────────────────────────
# CALIFICACIÓN Y SCORING (lógica Temporada Llena)
# ─────────────────────────────────────────────────────────────
_ADMIN_HINTS = (
    "administra", "propiedades", "corretora", "corredora", "inmobiliaria",
    "rentas", "rental", "airbnb", "gestión", "gestion", "cabañas", "cabanas",
    "departamentos", "arriendo",
)

def es_administrador(nombre, categoria):
    txt = f"{nombre} {categoria}".lower()
    return any(h in txt for h in _ADMIN_HINTS)


def parse_int(s):
    if s is None:
        return 0
    m = re.search(r"[\d\.]+", str(s).replace(".", "").replace(",", ""))
    return int(m.group()) if m else 0


def parse_float(s):
    if s is None:
        return 0.0
    m = re.search(r"\d+[.,]?\d*", str(s))
    return float(m.group().replace(",", ".")) if m else 0.0


def calcular_score(tiene_web, es_admin, reviews, rating, tiene_telefono):
    """
    Score 0-100 anclado al modelo de Temporada Llena:
      - SIN WEB = depende de Airbnb/Booking = el dolor más claro (35)
      - Es administrador (varias propiedades) = buyer real (25)
      - Reseñas = ya tiene tráfico/consultas que hoy pierde (25)
      - Rating sano = negocio serio y activo (5)
      - Tiene teléfono = contactable YA por el Motor 1 (10)
    """
    score = 0
    if not tiene_web:      score += 35
    if es_admin:           score += 25

    if   reviews >= 100:   score += 25
    elif reviews >= 40:    score += 20
    elif reviews >= 15:    score += 14
    elif reviews >= 5:     score += 8
    else:                  score += 3

    if rating >= 4.0:      score += 5
    elif rating >= 3.0:    score += 3

    if tiene_telefono:     score += 10
    return min(score, 100)


def prioridad(score):
    if score >= 75:  return "🔥 ALTA"
    if score >= 50:  return "⚡ MEDIA"
    return "❄️ BAJA"


def estimar_valor(reviews, es_admin):
    """
    No podemos ver el nº exacto de propiedades desde Maps, así que estimamos el
    tramo de forma CONSERVADORA (se confirma en el diagnóstico). Un operador con
    mucha actividad probablemente maneja más unidades → tramo más alto.
    """
    if reviews >= 80 and es_admin:
        tramo = "Estándar"
    else:
        tramo = "Base"
    t = TRAMOS[tramo]
    fee = t["gestion"]
    contrato = t["impl"] + CONTRATO_MESES * t["gestion"]
    contrato_alto = TRAMOS["Alto"]["impl"] + CONTRATO_MESES * TRAMOS["Alto"]["gestion"]
    usd = round(contrato / USD_CLP)
    return tramo, fee, contrato, usd, contrato_alto


def argumento_perdida():
    """Frase de anclaje en la pérdida (Doc 3, §2.4) lista para la llamada."""
    return ("Recuperar 1 sola reserva de fin de semana largo al mes "
            "(≈ CLP 300.000–2.000.000) ya paga el sistema completo.")


# ─────────────────────────────────────────────────────────────
# MENSAJES — cadencia de 4 toques (Doc 3, §3.2). NO se pitchea en frío.
# ─────────────────────────────────────────────────────────────
def toques(nombre, comuna):
    ref = f"por {nombre}" if nombre else "por tus propiedades"
    return {
        "toque_1": (f"Hola, te escribo {ref}. Estoy haciendo un estudio de arriendos "
                    f"turísticos en la V Región, sobre {comuna}. ¿Me regalas 15 min "
                    f"de tu experiencia administrando propiedades?"),
        "toque_2": ("Te dejo un dato del estudio: cerca del 38% de las consultas de "
                    "enero llegan después de las 20:00. ¿Las alcanzas a contestar todas?"),
        "toque_3": ("Hablé con administradores de Maitencillo y Zapallar y todos me "
                    "dijeron lo mismo: se les escapan reservas por no responder a tiempo. "
                    "¿Te pasa igual?"),
        "toque_4": ("Te dejo tranquilo. Si en algún momento quieres ver el resumen del "
                    "estudio con los números del corredor, me escribes y te lo mando."),
    }


# ─────────────────────────────────────────────────────────────
# CONSTRUCCIÓN DE LA FILA
# ─────────────────────────────────────────────────────────────
def construir_lead(d, comuna, query, fuente):
    """d = dict crudo del backend con: nombre, categoria, telefono, web,
    rating, reviews, direccion, url_maps."""
    nombre = (d.get("nombre") or "").strip()
    if not nombre:
        return None

    categoria = (d.get("categoria") or "").strip()
    tel_disp, wa = normalizar_telefono(d.get("telefono"))
    web = (d.get("web") or "").strip()
    tiene_web = bool(web)
    rating = parse_float(d.get("rating"))
    reviews = parse_int(d.get("reviews"))
    admin = es_administrador(nombre, categoria)

    score = calcular_score(tiene_web, admin, reviews, rating, bool(tel_disp))
    tramo, fee, contrato, usd, contrato_alto = estimar_valor(reviews, admin)
    tq = toques(nombre, comuna)

    return {
        "nombre": nombre,
        "categoria": categoria or "—",
        "comuna": comuna,
        "telefono": tel_disp or "—",
        "whatsapp_link": wa or "—",
        "web": web or "—",
        "tiene_web": "Sí" if tiene_web else "NO",
        "rating": rating or "—",
        "resenas": reviews,
        "direccion": (d.get("direccion") or "—").strip(),
        "url_maps": (d.get("url_maps") or "—").strip(),
        "es_administrador": "Sí" if admin else "Dudoso",
        "score": score,
        "prioridad": prioridad(score),
        "tramo_estimado": tramo,
        "fee_mensual_clp": fee,
        "valor_contrato_3m_clp": contrato,
        "valor_contrato_usd": usd,
        "valor_potencial_alto_clp": contrato_alto,
        "dolor_principal": DOLOR,
        "argumento_perdida": argumento_perdida(),
        "toque_1": tq["toque_1"],
        "toque_2": tq["toque_2"],
        "toque_3": tq["toque_3"],
        "toque_4": tq["toque_4"],
        "estado": "Nuevo",
        "fuente": fuente,
        "query_origen": f"{query} | {comuna}",
        "fecha_registro": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


# ─────────────────────────────────────────────────────────────
# BACKEND 1 — SCRAPLING (Google Maps)
# ─────────────────────────────────────────────────────────────
def _txt(page, sel):
    try:
        el = page.css_first(sel)
        return str(el.text).strip() if el else ""
    except Exception:
        return ""


def _scroll_feed(page):
    """page_action para Scrapling: baja el feed de resultados hasta el fondo."""
    try:
        prev = -1
        for _ in range(12):
            page.evaluate(
                "() => { const f = document.querySelector(\"div[role='feed']\");"
                " if (f) f.scrollTo(0, f.scrollHeight); }"
            )
            page.wait_for_timeout(1600)
            count = page.evaluate(
                "() => document.querySelectorAll('a.hfpxzc').length"
            )
            if count == prev:
                break
            prev = count
    except Exception:
        pass
    return page


def scrape_scrapling(query, comuna, max_results, delay):
    try:
        from scrapling.fetchers import StealthyFetcher
    except ImportError:
        sys.exit("❌ Falta Scrapling. Instala: pip install -r scripts/requirements.txt "
                 "&& scrapling install")

    q = f"{query} en {comuna}, Valparaíso, Chile"
    url = "https://www.google.com/maps/search/" + urllib.parse.quote(q)

    search = StealthyFetcher.fetch(
        url, headless=True, network_idle=True, page_action=_scroll_feed
    )
    if not search or getattr(search, "status", 200) >= 400:
        print(f"   ⚠️  Sin resultados para: {q}")
        return []

    # Recolecta links de fichas del feed
    place_urls = []
    for a in search.css(SEL["feed_link"]):
        href = a.attrib.get("href", "")
        if "/maps/place/" in href and href not in place_urls:
            place_urls.append(href)
    place_urls = place_urls[:max_results]

    resultados = []
    for i, purl in enumerate(place_urls, 1):
        try:
            page = StealthyFetcher.fetch(purl, headless=True, network_idle=True)
            reviews_raw = ""
            rev_el = page.css_first(SEL["reviews"])
            if rev_el:
                reviews_raw = rev_el.attrib.get("aria-label", "") or str(rev_el.text)
            web_el = page.css_first("a[data-item-id='authority']")
            web = ""
            if web_el:
                web = _txt(page, SEL["website"]) or web_el.attrib.get("href", "")
            resultados.append({
                "nombre":    _txt(page, SEL["name"]),
                "categoria": _txt(page, SEL["category"]),
                "telefono":  _txt(page, SEL["phone"]),
                "web":       web,
                "rating":    _txt(page, SEL["rating"]),
                "reviews":   reviews_raw,
                "direccion": _txt(page, SEL["address"]),
                "url_maps":  purl,
            })
        except Exception as e:
            print(f"   ⚠️  Error en ficha {i}: {e}")
        time.sleep(delay)
    return resultados


# ─────────────────────────────────────────────────────────────
# BACKEND 2 — GOOGLE PLACES API (New) — confiable y dentro de ToS
# ─────────────────────────────────────────────────────────────
def fetch_places_api(query, comuna, max_results, api_key):
    endpoint = "https://places.googleapis.com/v1/places:searchText"
    field_mask = ",".join([
        "places.displayName", "places.nationalPhoneNumber",
        "places.internationalPhoneNumber", "places.websiteUri",
        "places.rating", "places.userRatingCount", "places.formattedAddress",
        "places.primaryTypeDisplayName", "places.googleMapsUri",
        "nextPageToken",
    ])
    resultados = []
    page_token = None
    while len(resultados) < max_results:
        body = {"textQuery": f"{query} en {comuna}, Región de Valparaíso, Chile",
                "languageCode": "es", "regionCode": "CL"}
        if page_token:
            body["pageToken"] = page_token
        req = urllib.request.Request(
            endpoint, data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json",
                     "X-Goog-Api-Key": api_key,
                     "X-Goog-FieldMask": field_mask},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
        except Exception as e:
            print(f"   ⚠️  Error API para {comuna}: {e}")
            break

        for p in data.get("places", []):
            resultados.append({
                "nombre":    (p.get("displayName") or {}).get("text", ""),
                "categoria": (p.get("primaryTypeDisplayName") or {}).get("text", ""),
                "telefono":  p.get("nationalPhoneNumber") or p.get("internationalPhoneNumber", ""),
                "web":       p.get("websiteUri", ""),
                "rating":    p.get("rating", ""),
                "reviews":   p.get("userRatingCount", ""),
                "direccion": p.get("formattedAddress", ""),
                "url_maps":  p.get("googleMapsUri", ""),
            })
        page_token = data.get("nextPageToken")
        if not page_token:
            break
        time.sleep(2)  # el token tarda unos segundos en activarse
    return resultados[:max_results]


# ─────────────────────────────────────────────────────────────
# I/O
# ─────────────────────────────────────────────────────────────
def cargar_existentes(path):
    """Devuelve set de claves ya guardadas para no duplicar."""
    claves = set()
    if os.path.exists(path):
        with open(path, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                claves.add(_clave(row.get("nombre", ""), row.get("telefono", "")))
    return claves


def _clave(nombre, telefono):
    tel = re.sub(r"\D", "", telefono or "")
    return (tel or nombre.strip().lower())


def escribir(path, filas, columnas):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    nuevo = not os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        if nuevo:
            w.writeheader()
        for fila in filas:
            w.writerow(fila)


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Radar Costero — leads para Temporada Llena")
    ap.add_argument("--source", choices=["scrapling", "api"], default="scrapling")
    ap.add_argument("--max", type=int, default=20, help="máx. resultados por (nicho×comuna)")
    ap.add_argument("--delay", type=float, default=2.5, help="segundos entre fichas (scrapling)")
    ap.add_argument("--comunas", nargs="*", help="filtra comunas (ej: Concón Zapallar)")
    ap.add_argument("--queries", nargs="*", help="filtra queries")
    ap.add_argument("--api-key", default=os.getenv("GOOGLE_PLACES_API_KEY", ""))
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args()

    comunas = args.comunas or COMUNAS
    queries = args.queries or QUERIES

    if args.source == "api" and not args.api_key:
        sys.exit("❌ --source api requiere una API key. Usa --api-key o export GOOGLE_PLACES_API_KEY=...")

    vistos = cargar_existentes(args.out)
    total_nuevos = 0
    print(f"\n{'='*58}\n  RADAR COSTERO — fuente: {args.source.upper()}  |  "
          f"{len(comunas)} comunas × {len(queries)} nichos\n{'='*58}")

    for query in queries:
        for comuna in comunas:
            print(f"\n▶ {query}  ·  {comuna}")
            if args.source == "scrapling":
                crudos = scrape_scrapling(query, comuna, args.max, args.delay)
            else:
                crudos = fetch_places_api(query, comuna, args.max, args.api_key)

            nuevas = []
            for d in crudos:
                lead = construir_lead(d, comuna, query, args.source)
                if not lead:
                    continue
                clave = _clave(lead["nombre"], lead["telefono"])
                if clave in vistos:
                    continue
                vistos.add(clave)
                nuevas.append(lead)

            if nuevas:
                nuevas.sort(key=lambda x: x["score"], reverse=True)
                escribir(args.out, nuevas, CSV_COLUMNS)
                total_nuevos += len(nuevas)
                con_tel = sum(1 for x in nuevas if x["telefono"] != "—")
                alta = sum(1 for x in nuevas if "ALTA" in x["prioridad"])
                print(f"   ✅ {len(nuevas)} nuevos  |  {con_tel} con teléfono  |  {alta} prioridad ALTA")
            else:
                print("   —  0 nuevos")

    print(f"\n{'='*58}\n  LISTO. {total_nuevos} leads nuevos → {args.out}")
    print(f"  Ábrelo en Excel/Sheets, ordena por 'score' y arranca por los 🔥 ALTA.")
    print(f"  Recuerda: 30 contactos por día. Toque 1 = estudio, NO pitch.\n{'='*58}\n")


if __name__ == "__main__":
    main()
