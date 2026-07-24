"""
NEXVORE — Extractor de Leads (Google Maps) con Scrapling
=========================================================
Saca prospectos REALES de negocios locales con TELÉFONO listo para llamar,
los califica con la metodología SMSA (sin web = máxima oportunidad) y genera
un guion de llamada por nicho + un análisis de mercado (dólares alcanzables).

Fuente: Google Maps / Google Business (fichas públicas de negocio).
Motor:  Scrapling (DynamicFetcher, Chromium/Playwright).

USO:
    python scripts/extraer_leads.py                       # todos los nichos, Santiago
    python scripts/extraer_leads.py --zona "Providencia, Santiago"
    python scripts/extraer_leads.py --nichos peluqueros,tatuadores --max 40
    python scripts/extraer_leads.py --no-headless         # ver el navegador

Requisitos:
    pip install -r scripts/requirements.txt
    (Chromium de Playwright ya viene en el entorno remoto)

NOTA HONESTA: los teléfonos y datos salen de la ficha pública real de cada
negocio. Este script NO inventa números. Si Google bloquea la IP o cambia el
HTML, el script lo reporta y no genera datos falsos.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from datetime import datetime
from urllib.parse import quote_plus

try:
    from scrapling.fetchers import DynamicFetcher
except ImportError:
    sys.exit(
        "❌ Falta Scrapling. Instala con:\n"
        "   pip install -r scripts/requirements.txt"
    )

# ────────────────────────────────────────────────────────────
# CONFIG DE NEGOCIO  (alineada con scripts/agregar_lead.py)
# ────────────────────────────────────────────────────────────
PRECIO_PAQUETE_CLP = 19_990        # ticket base del paquete Nexvore
USD_CLP            = 950           # tipo de cambio aprox. (ajustable con --usd)
ZONA_DEFAULT      = "Santiago, Chile"

# Nicho → (términos de búsqueda en Google Maps, dolor principal SMSA)
NICHOS = {
    "tatuadores":    (["estudio de tatuajes", "tatuador"],
                      "Tienen followers pero no reservas online"),
    "fotografos":    (["fotógrafo", "estudio fotográfico"],
                      "Su portfolio es Instagram, no tienen web propia"),
    "videografos":   (["productora audiovisual", "videógrafo"],
                      "Sin web no pueden cobrar lo que valen sus proyectos"),
    "maquilladores": (["maquillaje profesional", "maquilladora"],
                      "Agenda por DM, sin sistema de reservas"),
    "entrenadores":  (["entrenador personal", "personal trainer"],
                      "No venden en línea, todo es cara a cara"),
    "peluqueros":    (["peluquería", "barbería"],
                      "Sin web ni reservas digitales = oportunidad perdida"),
    "musicos_djs":   (["dj para eventos", "banda en vivo"],
                      "Sin presencia web profesional pierden bookings"),
    "artesanos":     (["taller artesanal", "tienda de artesanía"],
                      "Venden por historias, sin tienda ni funnel"),
    "coaches":       (["coach", "centro de coaching"],
                      "Mucho contenido, poco sistema de conversión"),
    "restaurantes":  (["restaurante", "cafetería"],
                      "Ficha de Google desactualizada, sin web propia"),
    "ecommerce":     (["tienda", "boutique"],
                      "Tienda con bajo tráfico y conversión pobre"),
}

# Guion de llamada por nicho (apertura → dolor → CTA de 15 min)
GUIONES = {
    "default": {
        "apertura": "Hola, ¿hablo con {nombre}? Te llamo de Nexvore, súper breve — vi su ficha en Google y quería hacerte una sola pregunta rápida, ¿tenés 30 segundos?",
        "dolor":    "Cuando un cliente los busca en Google y ve que no tienen sitio web propio, muchas veces se va con el que sí lo tiene. ¿Hoy cómo están captando a esos clientes que los buscan por internet?",
        "cta":      "Justamente eso resolvemos: un sistema que atiende y agenda solo, aunque ustedes estén ocupados. ¿Te sirve que agendemos 15 minutos esta semana para mostrarte cómo se vería para {nombre}?",
    },
    "peluqueros": {
        "apertura": "Hola, ¿hablo con {nombre}? Soy de Nexvore, te robo 30 segundos — vi su ficha en Google y tienen muy buenas reseñas. Una pregunta rápida.",
        "dolor":    "¿Las reservas hoy las toman por teléfono/WhatsApp o tienen algo automático? Porque cada llamada que no alcanzan a contestar en hora punta suele ser un cliente que se va a otra.",
        "cta":      "Nosotros montamos un sistema que agenda y confirma solo, 24/7. ¿Agendamos 15 min para verlo aplicado a {nombre}?",
    },
    "restaurantes": {
        "apertura": "Hola, ¿hablo con {nombre}? Soy de Nexvore, súper breve — los vi en Google Maps. ¿Tenés 30 segundos?",
        "dolor":    "En horario peak, ¿cuántas llamadas de reservas o pedidos quedan sin contestar? Ese es dinero que entra por la puerta y se va porque nadie alcanzó a atender el teléfono.",
        "cta":      "Tenemos una recepcionista con IA que contesta y toma reservas sola. ¿15 minutos esta semana para mostrártela con el caso de {nombre}?",
    },
    "tatuadores": {
        "apertura": "Hola, ¿hablo con {nombre}? Soy de Nexvore, te robo 30 segundos — vi el estudio en Google.",
        "dolor":    "¿Las citas las coordinan por DM o tienen reservas online? Porque responder uno por uno consume horas y muchos interesados se enfrían antes de agendar.",
        "cta":      "Montamos un sistema que reserva y cobra la seña solo. ¿Te muestro cómo quedaría para {nombre} en 15 min?",
    },
}

# Columnas del CSV listo para llamar
COLUMNAS = [
    "nombre", "nicho", "telefono", "telefono_e164", "llamable",
    "tiene_web", "web", "direccion", "categoria", "rating", "reviews",
    "score_smsa", "prioridad", "dolor_principal",
    "guion_apertura", "guion_dolor", "guion_cta",
    "valor_estimado_clp", "valor_estimado_usd",
    "maps_url", "zona", "fecha_registro",
]


# ────────────────────────────────────────────────────────────
# HELPERS DE PARSEO
# ────────────────────────────────────────────────────────────
def _browser_kwargs(headless, timeout):
    """
    kwargs comunes para DynamicFetcher.fetch, adaptados al entorno:
      - executable_path: usa el Chromium ya presente (entorno remoto de Claude)
        para evitar 'playwright install'. En local, si no existe, Playwright
        usa el suyo.
      - proxy: respeta HTTPS_PROXY/HTTP_PROXY si están definidos.
    """
    kw = {"headless": headless, "network_idle": True, "timeout": timeout}

    for ruta in ("/opt/pw-browsers/chromium",
                 "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"):
        if os.path.exists(ruta):
            kw["executable_path"] = ruta
            break

    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    if proxy:
        kw["proxy"] = proxy
    return kw


def _first(node, selector):
    """Primer elemento que matchea el CSS, o None."""
    els = node.css(selector)
    return els[0] if els else None


def _txt(node, selector):
    el = _first(node, selector)
    if el is None:
        return ""
    try:
        return (el.text or "").strip()
    except Exception:
        return (el.get_all_text() or "").strip()


def normalizar_telefono_cl(raw: str):
    """Devuelve (display, e164) para un teléfono chileno. e164='' si no válido."""
    if not raw:
        return "", ""
    digits = re.sub(r"[^\d+]", "", raw)
    d = digits.lstrip("+")
    if d.startswith("56"):
        core = d[2:]
    elif d.startswith("9") and len(d) == 9:      # móvil 9xxxxxxxx
        core = d
    elif len(d) == 8:                            # fijo sin código de área/país
        core = d
    else:
        core = d
    e164 = ""
    if len(core) == 9 and core.startswith("9"):      # móvil
        e164 = f"+56{core}"
        display = f"+56 9 {core[1:5]} {core[5:]}"
    elif len(core) in (8, 9):                          # fijo
        e164 = f"+56{core}"
        display = f"+56 {core}"
    else:
        display = raw.strip()
    return display, e164


def extraer_telefono(node):
    """Teléfono desde data-item-id='phone:tel:...' o aria-label."""
    el = _first(node, 'button[data-item-id^="phone:tel:"]')
    if el is not None:
        did = el.attrib.get("data-item-id", "")
        m = re.search(r"phone:tel:(.+)$", did)
        if m:
            return m.group(1)
    el = _first(node, 'button[aria-label^="Teléfono"], button[aria-label^="Phone"]')
    if el is not None:
        aria = el.attrib.get("aria-label", "")
        m = re.search(r"[\d+][\d\s]{6,}", aria)
        if m:
            return m.group(0)
    return ""


def extraer_web(node):
    """URL de sitio web propio (excluye redes sociales / el propio Google)."""
    el = _first(node, 'a[data-item-id="authority"]')
    if el is None:
        return ""
    href = el.attrib.get("href", "")
    if not href:
        return ""
    social = ("facebook.", "instagram.", "wa.me", "whatsapp.",
              "linktr.ee", "google.", "goo.gl", "tiktok.")
    if any(s in href.lower() for s in social):
        return ""
    return href


def extraer_rating_reviews(node):
    rating = 0.0
    reviews = 0
    el = _first(node, "div.F7nice")
    if el is not None:
        txt = el.get_all_text()
        mr = re.search(r"([0-9],[0-9])", txt)          # 4,7
        if mr:
            try:
                rating = float(mr.group(1).replace(",", "."))
            except ValueError:
                pass
        mv = re.search(r"\(([\d\.\s]+)\)", txt)         # (1.234)
        if mv:
            reviews = int(re.sub(r"[^\d]", "", mv.group(1)) or 0)
    return rating, reviews


# ────────────────────────────────────────────────────────────
# SCORING SMSA (adaptado a datos de Google / lead llamable)
# ────────────────────────────────────────────────────────────
def calcular_score(tiene_web, tiene_telefono, rating, reviews):
    """
    0-100. Prioriza el dolor que Nexvore resuelve:
      - Sin sitio web propio       → +35 (oportunidad máxima)
      - Teléfono disponible        → +15 (se puede prospectar YA)
      - Negocio activo con reseñas → hasta +25 (sweet spot alcanzable)
      - Rating sano                → +10
      - Base negocio local real    → +15
    """
    score = 15  # base: es un negocio local real listado en Google

    if not tiene_web:
        score += 35
    if tiene_telefono:
        score += 15

    # Sweet spot SMSA: establecido pero aún accesible
    if   20 <= reviews <= 150:  score += 25
    elif 151 <= reviews <= 500: score += 16
    elif 5 <= reviews < 20:     score += 14
    elif reviews > 500:         score += 8
    else:                        score += 4

    if 3.5 <= rating <= 4.7:    score += 10
    elif rating > 4.7:          score += 6
    elif rating > 0:            score += 8   # rating bajo = dolor = necesita ayuda

    return min(score, 100)


def prioridad(score):
    if score >= 75:  return "🔥 ALTA"
    if score >= 55:  return "⚡ MEDIA"
    return "❄️ BAJA"


def guion_para(nicho, nombre):
    g = GUIONES.get(nicho, GUIONES["default"])
    nom = nombre or "el negocio"
    return (g["apertura"].format(nombre=nom),
            g["dolor"].format(nombre=nom),
            g["cta"].format(nombre=nom))


# ────────────────────────────────────────────────────────────
# SCRAPING
# ────────────────────────────────────────────────────────────
def _aceptar_consentimiento(page):
    """Cierra el muro de cookies de Google si aparece."""
    for sel in ('button[aria-label*="Aceptar"]', 'button[aria-label*="Accept"]',
                'form[action*="consent"] button'):
        try:
            btn = page.query_selector(sel)
            if btn:
                btn.click()
                page.wait_for_timeout(1500)
                return
        except Exception:
            pass


def recolectar_urls(termino, zona, maximo, headless, timeout):
    """Scrollea el feed de resultados y devuelve las URLs de las fichas."""
    query = f"{termino} en {zona}"
    url = f"https://www.google.com/maps/search/{quote_plus(query)}?hl=es&gl=CL"

    def scroll(page):
        _aceptar_consentimiento(page)
        try:
            page.wait_for_selector('div[role="feed"]', timeout=timeout)
        except Exception:
            return page
        anterior = 0
        estancado = 0
        for _ in range(40):
            try:
                page.evaluate(
                    "() => { const f = document.querySelector('div[role=\"feed\"]');"
                    " if (f) f.scrollBy(0, f.scrollHeight); }"
                )
            except Exception:
                break
            page.wait_for_timeout(1600)
            n = len(page.query_selector_all('div[role="feed"] a.hfpxzc'))
            fin = page.query_selector('span.HlvSq, p.fontBodyMedium span span')  # "fin de la lista"
            if n >= maximo:
                break
            estancado = estancado + 1 if n == anterior else 0
            anterior = n
            if estancado >= 3 or fin:
                break
        return page

    resp = DynamicFetcher.fetch(
        url, page_action=scroll, wait_selector='div[role="feed"]',
        **_browser_kwargs(headless, timeout),
    )
    urls = []
    for a in resp.css("a.hfpxzc"):
        href = a.attrib.get("href", "")
        if href.startswith("/"):
            href = "https://www.google.com" + href
        if "/maps/place/" in href and href not in urls:
            urls.append(href)
    return urls[:maximo]


def extraer_ficha(url, nicho, dolor, zona, usd_clp, headless, timeout):
    """Abre una ficha de negocio y devuelve el dict del lead (o None)."""
    try:
        resp = DynamicFetcher.fetch(
            url, wait_selector="h1.DUwDvf",
            **_browser_kwargs(headless, timeout),
        )
    except Exception:
        return None

    nombre = _txt(resp, "h1.DUwDvf")
    if not nombre:
        return None

    telefono_raw = extraer_telefono(resp)
    telefono, e164 = normalizar_telefono_cl(telefono_raw)
    web = extraer_web(resp)
    tiene_web = bool(web)
    llamable = bool(e164 or telefono_raw)
    direccion = ""
    el = _first(resp, 'button[data-item-id="address"]')
    if el is not None:
        direccion = re.sub(r"^(Dirección|Address):\s*", "",
                           el.attrib.get("aria-label", "")).strip()
    categoria = _txt(resp, 'button[jsaction*="category"]')
    rating, reviews = extraer_rating_reviews(resp)

    score = calcular_score(tiene_web, llamable, rating, reviews)
    apertura, g_dolor, cta = guion_para(nicho, nombre)
    val_clp = PRECIO_PAQUETE_CLP
    val_usd = round(PRECIO_PAQUETE_CLP / usd_clp, 1)

    return {
        "nombre": nombre,
        "nicho": nicho,
        "telefono": telefono,
        "telefono_e164": e164,
        "llamable": "Sí" if llamable else "No",
        "tiene_web": "Sí" if tiene_web else "NO",
        "web": web or "—",
        "direccion": direccion,
        "categoria": categoria,
        "rating": rating or "",
        "reviews": reviews,
        "score_smsa": score,
        "prioridad": prioridad(score),
        "dolor_principal": dolor,
        "guion_apertura": apertura,
        "guion_dolor": g_dolor,
        "guion_cta": cta,
        "valor_estimado_clp": val_clp,
        "valor_estimado_usd": val_usd,
        "maps_url": url,
        "zona": zona,
        "fecha_registro": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


# ────────────────────────────────────────────────────────────
# SALIDAS
# ────────────────────────────────────────────────────────────
def guardar_csv(leads, ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    leads = sorted(leads, key=lambda x: x["score_smsa"], reverse=True)
    with open(ruta, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS)
        w.writeheader()
        for l in leads:
            w.writerow({k: l.get(k, "") for k in COLUMNAS})
    return ruta


def escribir_analisis(leads, zona, usd_clp, ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    total = len(leads)
    llamables = [l for l in leads if l["llamable"] == "Sí"]
    sin_web = [l for l in leads if l["tiene_web"] == "NO"]
    alta = [l for l in leads if "ALTA" in l["prioridad"]]
    # Mercado alcanzable = leads llamables (con quien SÍ puedo hablar)
    tam_clp = len(llamables) * PRECIO_PAQUETE_CLP
    tam_usd = round(tam_clp / usd_clp)

    por_nicho = {}
    for l in leads:
        d = por_nicho.setdefault(l["nicho"], {"n": 0, "sin_web": 0, "llamables": 0})
        d["n"] += 1
        d["sin_web"] += 1 if l["tiene_web"] == "NO" else 0
        d["llamables"] += 1 if l["llamable"] == "Sí" else 0

    lines = []
    lines.append(f"# Análisis de Mercado — Nexvore ({zona})")
    lines.append("")
    lines.append(f"_Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')} · "
                 f"ticket base ${PRECIO_PAQUETE_CLP:,} CLP · TC {usd_clp} CLP/USD_")
    lines.append("")
    lines.append("## Resumen ejecutivo")
    lines.append("")
    lines.append(f"- **Prospectos extraídos:** {total}")
    lines.append(f"- **Con teléfono (llamables hoy):** {len(llamables)} "
                 f"({round(100*len(llamables)/total) if total else 0}%)")
    lines.append(f"- **Sin sitio web (oportunidad SMSA máxima):** {len(sin_web)} "
                 f"({round(100*len(sin_web)/total) if total else 0}%)")
    lines.append(f"- **Prioridad ALTA (score ≥ 75):** {len(alta)}")
    lines.append("")
    lines.append("## Dinero alcanzable (primer contacto)")
    lines.append("")
    lines.append(f"Sobre los **{len(llamables)} prospectos con teléfono**, a ticket base:")
    lines.append("")
    lines.append(f"- **~${tam_clp:,} CLP** (~US${tam_usd:,}) en primer paquete.")
    lines.append(f"- Si cierras solo el **10%** → **~${round(tam_clp*0.1):,} CLP** (~US${round(tam_usd*0.1):,}).")
    lines.append("")
    lines.append("> El potencial real es mayor: cada cliente puede escalar a retainer "
                 "mensual. Esta cifra es solo el primer paquete.")
    lines.append("")
    lines.append("## Por nicho")
    lines.append("")
    lines.append("| Nicho | Prospectos | Llamables | Sin web | $ alcanzable (CLP) |")
    lines.append("|-------|-----------:|----------:|--------:|-------------------:|")
    for nicho, d in sorted(por_nicho.items(), key=lambda x: -x[1]["llamables"]):
        lines.append(f"| {nicho} | {d['n']} | {d['llamables']} | {d['sin_web']} "
                     f"| ${d['llamables']*PRECIO_PAQUETE_CLP:,} |")
    lines.append("")
    lines.append("## Cómo prospectar (orden sugerido)")
    lines.append("")
    lines.append("1. Empieza por **prioridad ALTA + sin web** (dolor evidente, presupuesto real).")
    lines.append("2. Usa el **guion de llamada** del CSV (apertura → dolor → CTA de 15 min).")
    lines.append("3. No pitchees en los primeros 30 segundos: pide permiso, revela el dolor, cierra la reunión.")
    lines.append("4. Registra el resultado de cada llamada en tu CRM / `agregar_lead.py`.")
    lines.append("")
    with open(ruta, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return ruta, {"total": total, "llamables": len(llamables),
                  "sin_web": len(sin_web), "alta": len(alta),
                  "clp": tam_clp, "usd": tam_usd}


# ────────────────────────────────────────────────────────────
# CLI
# ────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Extractor de leads Nexvore (Google Maps)")
    ap.add_argument("--zona", default=ZONA_DEFAULT, help="Ciudad/comuna a prospectar")
    ap.add_argument("--nichos", default="", help="Coma-separados (default: todos)")
    ap.add_argument("--max", type=int, default=25, help="Máx. fichas por término de búsqueda")
    ap.add_argument("--usd", type=int, default=USD_CLP, help="Tipo de cambio CLP/USD")
    ap.add_argument("--timeout", type=int, default=45000, help="Timeout ms por página")
    ap.add_argument("--no-headless", action="store_true", help="Mostrar navegador")
    ap.add_argument("--out", default="scripts/leads/leads_google.csv")
    ap.add_argument("--pausa", type=float, default=1.0, help="Segundos entre fichas (cortesía)")
    args = ap.parse_args()

    headless = not args.no_headless
    seleccion = ([n.strip() for n in args.nichos.split(",") if n.strip()]
                 if args.nichos else list(NICHOS.keys()))
    seleccion = [n for n in seleccion if n in NICHOS]
    if not seleccion:
        sys.exit("❌ Nichos inválidos. Disponibles: " + ", ".join(NICHOS))

    print("=" * 60)
    print(f"  NEXVORE — Extractor de leads  |  Zona: {args.zona}")
    print(f"  Nichos: {', '.join(seleccion)}")
    print(f"  Máx por búsqueda: {args.max}  |  Headless: {headless}")
    print("=" * 60)

    leads = []
    vistos = set()  # dedupe por teléfono/nombre
    for nicho in seleccion:
        terminos, dolor = NICHOS[nicho]
        urls = []
        for termino in terminos:
            print(f"\n🔎 [{nicho}] Buscando '{termino}' en {args.zona} …")
            try:
                nuevas = recolectar_urls(termino, args.zona, args.max,
                                         headless, args.timeout)
            except Exception as e:
                print(f"   ⚠️  No se pudo buscar '{termino}': {e}")
                nuevas = []
            for u in nuevas:
                if u not in urls:
                    urls.append(u)
            print(f"   → {len(nuevas)} fichas encontradas")

        for i, url in enumerate(urls, 1):
            ficha = extraer_ficha(url, nicho, dolor, args.zona,
                                  args.usd, headless, args.timeout)
            if not ficha:
                continue
            clave = ficha["telefono_e164"] or ficha["nombre"].lower()
            if clave in vistos:
                continue
            vistos.add(clave)
            leads.append(ficha)
            marca = "📵" if ficha["llamable"] == "No" else "📞"
            print(f"   {marca} [{i}/{len(urls)}] {ficha['nombre'][:38]:<38} "
                  f"score {ficha['score_smsa']:>3} {ficha['prioridad']}")
            time.sleep(args.pausa)

    if not leads:
        print("\n❌ No se extrajo ningún lead. Causas posibles:")
        print("   • Google bloqueó la IP (datacenter/proxy) → corré en local o con proxy residencial.")
        print("   • Cambió el HTML de Google Maps → revisá los selectores en extraer_ficha().")
        print("   • Timeout → subí --timeout.")
        sys.exit(1)

    ruta_csv = guardar_csv(leads, args.out)
    ruta_md, stats = escribir_analisis(
        leads, args.zona, args.usd,
        os.path.join(os.path.dirname(args.out), "analisis_mercado.md"))

    print("\n" + "=" * 60)
    print("  ✅ EXTRACCIÓN COMPLETA")
    print("=" * 60)
    print(f"  Prospectos:        {stats['total']}")
    print(f"  Con teléfono:      {stats['llamables']}")
    print(f"  Sin web (dolor):   {stats['sin_web']}")
    print(f"  Prioridad ALTA:    {stats['alta']}")
    print(f"  💰 Alcanzable:     ${stats['clp']:,} CLP  (~US${stats['usd']:,})")
    print(f"\n  📁 CSV para llamar: {ruta_csv}")
    print(f"  📊 Análisis:        {ruta_md}")
    print("=" * 60)


if __name__ == "__main__":
    main()
