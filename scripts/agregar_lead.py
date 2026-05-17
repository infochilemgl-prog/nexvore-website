"""
NEXVORE — Sistema SMSA de Prospección Instagram
================================================
Metodología Nick Cochavi: research → primer toque → valor → cierre.

Meta: $1.000.000 CLP en 13 días desde cero.

USO:
    python scripts/agregar_lead.py

Requisitos:
    pip install pandas rich
"""

import pandas as pd
import os
import sys
import json
from datetime import datetime, date
from textwrap import dedent

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.progress import Progress, BarColumn, TextColumn
    from rich.prompt import Prompt, Confirm
    from rich import box
    RICH = True
    console = Console()
except ImportError:
    RICH = False
    # Fallback simple
    class Console:
        def print(self, *a, **kw): print(*a)
    console = Console()

# ────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────
ARCHIVO         = "scripts/leads/leads.csv"
META_CLP        = 1_000_000
PRECIO_PAQUETE  = 19_990          # CLP — ajustar si vendés ticket más alto
DIAS_RESTANTES  = 13              # días del mes que quedan
INICIO_SPRINT   = "2026-05-17"   # fecha de arranque del sprint

# Para calcular conversiones (adaptar a tu realidad):
TASA_RESPUESTA  = 0.25    # 25% de DMs contestados
TASA_LLAMADA    = 0.40    # 40% de respuestas → llamada
TASA_CIERRE     = 0.35    # 35% de llamadas → cierre

COLUMNAS = [
    "username", "nombre", "nicho", "seguidores", "posts",
    "ratio_seg_posts", "engagement_est", "tiene_web", "web",
    "bio", "es_negocio", "url_perfil",
    "score_smsa", "prioridad", "dolor_principal",
    "toque_1_engagement", "toque_2_dm", "toque_3_followup",
    "toque_4_valor", "toque_5_cta",
    "dm_enviado", "dm_fecha", "estado", "etapa_smsa", "notas",
    "fecha_registro"
]

NICHOS = {
    "tatuadores":       {"emoji": "🎨", "dolor": "Tienen followers pero no reservas online"},
    "fotografos":       {"emoji": "📷", "dolor": "Su portfolio es Instagram, no tienen web propia"},
    "videografos":      {"emoji": "🎬", "dolor": "Sin web no pueden cobrar lo que valen sus proyectos"},
    "maquilladores":    {"emoji": "💄", "dolor": "Agenda por DM, sin sistema de reservas"},
    "entrenadores":     {"emoji": "💪", "dolor": "No venden en línea, todo es cara a cara"},
    "peluqueros":       {"emoji": "✂️",  "dolor": "Sin web ni reservas digitales = oportunidad perdida"},
    "musicos_djs":      {"emoji": "🎵", "dolor": "Sin presencia web profesional pierden bookings"},
    "artesanos":        {"emoji": "🧶", "dolor": "Venden por historias, sin tienda ni funnel"},
    "coaches":          {"emoji": "🧠", "dolor": "Mucho contenido, poco sistema de conversión"},
    "restaurantes":     {"emoji": "🍽️",  "dolor": "Ficha de Google desactualizada, sin web propia"},
    "ecommerce":        {"emoji": "🛒", "dolor": "Tienda con bajo tráfico y conversión pobre"},
    "otro":             {"emoji": "🏢", "dolor": "Presencia digital débil"},
}

# ────────────────────────────────────────────
# DM SCRIPTS POR NICHO  (metodología SMSA)
# Touch 1-5 = la secuencia de Cochavi
# ────────────────────────────────────────────
DM_SCRIPTS = {
    "tatuadores": {
        "t2": "Oye {nombre}, vi tu trabajo de {nicho} y quedé impresionado — especialmente {aspecto}. ¿Llevas mucho en esto?",
        "t3": "Justo estaba pensando en vos — vi un estudio en Santiago que triplicó sus reservas solo con una landing page bien hecha. Sin más. ✌️",
        "t4": "Oye, rápida pregunta: ¿tenés web propia o todo lo manejás por Instagram? No te juzgo, 9 de cada 10 estudios que conozco están igual.",
        "t5": "Lo que hacemos en Nexvore es exactamente eso — convertir tu Instagram en un sistema que reserva solo. 15 min de llamada y te cuento. ¿Cuándo andás disponible?",
    },
    "fotografos": {
        "t2": "Hola {nombre}, encontré tu perfil buscando fotógrafos en {ciudad} y tu trabajo tiene una identidad visual muy clara. ¿Hace cuánto te dedicás a esto?",
        "t3": "Dato que me parece útil: los fotógrafos con portfolio en web propia cobran en promedio 40% más que los que solo tienen Instagram. Pensé en vos al leerlo.",
        "t4": "Curiosidad genuina: cuando un cliente potencial te busca en Google, ¿qué encuentra?",
        "t5": "Eso es exactamente lo que resolvemos — web profesional + posicionamiento en 30 días. ¿Agendamos 15 min para ver si te aplica?",
    },
    "videografos": {
        "t2": "Oye {nombre}, vi tu reel de {proyecto} y la producción está a otro nivel. ¿Trabajás solo o con equipo?",
        "t3": "Tip que le doy a los creativos: una showreel page bien hecha genera más contactos de marca que 6 meses de contenido orgánico. Va al grano.",
        "t4": "¿Tenés página web donde las marcas puedan encontrarte y contactarte directo?",
        "t5": "Si no, eso se arregla rápido y el ROI se ve en semanas. En Nexvore hacemos exactamente eso. ¿15 min para contarte el proceso?",
    },
    "maquilladores": {
        "t2": "Hola {nombre}, vi tus trabajos de {nicho} — el detalle en {aspecto} es impresionante. ¿Tenés mucha demanda actualmente?",
        "t3": "Dato: las maquilladoras con sistema de reservas online trabajan 30% más porque el cliente llega ya decidido. Solo quería compartirlo.",
        "t4": "Oye, ¿cómo gestionás las reservas ahora? ¿Todo por DM o tenés algo más automatizado?",
        "t5": "Lo que hacemos en Nexvore es montar ese sistema completo — web, reservas, seguimiento automático. ¿Te explico en 15 min cómo funciona?",
    },
    "entrenadores": {
        "t2": "Oye {nombre}, vi tu contenido de {nicho} y hay muy buena metodología detrás. ¿Trabajás con clientes presenciales, online o ambos?",
        "t3": "Interesante esto: los coaches con embudo digital generan hasta 3x más ingresos porque no dependen del boca a boca. Lo compartí porque me pareció relevante para vos.",
        "t4": "¿Tenés una web donde capturás clientes o todo entra por Instagram/recomendaciones?",
        "t5": "Si querés escalar sin quedar esclavo del contenido diario, Nexvore arma el sistema. 15 min de llamada para ver si tiene sentido para vos. ¿Cuándo?",
    },
    "default": {
        "t2": "Hola {nombre}, vi tu perfil y lo que hacés con {nicho} tiene mucho potencial. ¿Hace cuánto estás en esto?",
        "t3": "Pensé en vos leyendo un caso: un negocio similar al tuyo duplicó sus contactos en 60 días solo mejorando su presencia digital. Dato nomás.",
        "t4": "Pregunta directa: ¿cuántos clientes nuevos entraron este mes por tu web/Instagram?",
        "t5": "Eso es exactamente lo que optimizamos en Nexvore. ¿15 min para contarte cómo?",
    }
}

# ────────────────────────────────────────────
# LÓGICA DE SCORING SMSA
# ────────────────────────────────────────────
def calcular_score_smsa(seguidores, posts, tiene_web, es_negocio, ratio):
    """
    Score 0-100 basado en metodología SMSA:
    - Sin web = máxima oportunidad (30 pts)
    - Es negocio o servicio = buyer real (20 pts)
    - Ratio engagement sano = audiencia activa (25 pts)
    - Tamaño de audiencia ideal para SMSA (15 pts)
    - Cuenta activa / posts recientes señal (10 pts)
    """
    score = 0

    # SIN WEB = el dolor más evidente y la oportunidad más clara
    if not tiene_web:
        score += 30

    # Es negocio / cuenta profesional
    if es_negocio:
        score += 20

    # Ratio seguidores/posts (señal de engagement orgánico)
    if ratio >= 300:   score += 25
    elif ratio >= 150: score += 20
    elif ratio >= 75:  score += 15
    elif ratio >= 30:  score += 10
    else:              score += 5

    # Sweet spot SMSA: 2K-50K — ya tienen audiencia, aún son accesibles
    if   2_000 <= seguidores <= 10_000: score += 15
    elif 10_001 <= seguidores <= 50_000: score += 12
    elif 1_000  <= seguidores < 2_000:  score += 8
    elif 50_001 <= seguidores <= 100_000: score += 6
    else: score += 2

    # Posts activos (señal de que el negocio está vivo)
    if posts >= 50:   score += 10
    elif posts >= 20: score += 6
    elif posts >= 10: score += 3

    return min(score, 100)


def urgencia(score):
    if score >= 75: return "🔥 ALTA"
    elif score >= 50: return "⚡ MEDIA"
    else:             return "❄️ BAJA"


def etapa_smsa(dm_enviado, estado):
    mapa = {
        "No":           "🎯 Prospectado",
        "Sí":           "📩 DM enviado",
    }
    estado_mapa = {
        "Respondió":    "💬 En conversación",
        "Interesado":   "🔥 Calificando",
        "Llamada":      "📞 Llamada agendada",
        "Propuesta":    "📋 Propuesta enviada",
        "Cerrado":      "✅ CLIENTE",
        "No interesado":"❌ Descartado",
    }
    if estado in estado_mapa:
        return estado_mapa[estado]
    return mapa.get(dm_enviado, "🎯 Prospectado")


# ────────────────────────────────────────────
# META & CALCULADORA
# ────────────────────────────────────────────
def calcular_meta(df):
    clientes_cerrados = len(df[df["estado"] == "Cerrado"])
    ingreso_actual    = clientes_cerrados * PRECIO_PAQUETE
    faltante          = max(META_CLP - ingreso_actual, 0)
    clientes_faltantes = -(-faltante // PRECIO_PAQUETE)  # ceil division

    # Backward desde meta
    dms_necesarios = round(clientes_faltantes / (TASA_RESPUESTA * TASA_LLAMADA * TASA_CIERRE))
    dms_por_dia    = max(1, round(dms_necesarios / DIAS_RESTANTES))

    return {
        "ingreso_actual":     ingreso_actual,
        "faltante":           faltante,
        "clientes_faltantes": clientes_faltantes,
        "dms_necesarios":     dms_necesarios,
        "dms_por_dia":        dms_por_dia,
        "clientes_cerrados":  clientes_cerrados,
        "porcentaje":         round(ingreso_actual / META_CLP * 100, 1),
    }


def generar_dm(nicho, nombre):
    scripts = DM_SCRIPTS.get(nicho, DM_SCRIPTS["default"])
    return {
        "Touch 2 — Primer DM (observación genuina)": scripts["t2"].format(nombre=nombre, nicho=nicho, aspecto="[mencioná algo específico]", ciudad="[ciudad]", proyecto="[nombre del proyecto]"),
        "Touch 3 — Follow-up (valor sin pitch)":     scripts["t3"],
        "Touch 4 — Pregunta que revela el dolor":    scripts["t4"],
        "Touch 5 — CTA suave":                       scripts["t5"],
    }


# ────────────────────────────────────────────
# I/O
# ────────────────────────────────────────────
def cargar_df():
    os.makedirs(os.path.dirname(ARCHIVO), exist_ok=True)
    if os.path.exists(ARCHIVO):
        df = pd.read_csv(ARCHIVO)
        for col in COLUMNAS:
            if col not in df.columns:
                df[col] = ""
        return df
    return pd.DataFrame(columns=COLUMNAS)


def guardar_df(df):
    df.to_csv(ARCHIVO, index=False, encoding="utf-8-sig")


def pedir(pregunta, obligatorio=True, default=""):
    while True:
        sufijo = f" [{default}]" if default else ""
        val = input(f"  {pregunta}{sufijo}: ").strip()
        if not val and default:
            return default
        if val or not obligatorio:
            return val
        print("  ⚠️  Campo obligatorio")


# ────────────────────────────────────────────
# VISTAS
# ────────────────────────────────────────────
def imprimir_encabezado(df):
    meta = calcular_meta(df)
    linea = "=" * 54
    print(f"\n{linea}")
    print(f"  NEXVORE — SPRINT SMSA  |  {DIAS_RESTANTES} días restantes")
    print(linea)
    progreso = "█" * int(meta["porcentaje"] / 5) + "░" * (20 - int(meta["porcentaje"] / 5))
    print(f"  META:  ${META_CLP:,} CLP")
    print(f"  HOY:   ${meta['ingreso_actual']:,} CLP  [{progreso}] {meta['porcentaje']}%")
    print(f"  FALTAN: {meta['clientes_faltantes']} clientes → {meta['dms_necesarios']} DMs → {meta['dms_por_dia']}/día")
    print(linea)
    if len(df) > 0:
        print(f"  Leads totales: {len(df)}  |  Alta prioridad: {len(df[df['prioridad'].str.contains('ALTA', na=False)])}  |  Cerrados: {meta['clientes_cerrados']}")
    print(linea)


def imprimir_top_leads(df, n=15):
    if len(df) == 0:
        print("  No hay leads todavía.")
        return
    cols = ["username", "nicho", "seguidores", "score_smsa", "prioridad", "etapa_smsa", "estado"]
    top = df[cols].head(n)
    print(f"\n  TOP {min(n, len(df))} LEADS (ordenados por score)\n")
    print(top.to_string(index=False))


def imprimir_plan_diario(df):
    meta = calcular_meta(df)
    hoy  = date.today()
    print(f"\n  {'─'*50}")
    print(f"  PLAN DE ACCIÓN HOY — {hoy.strftime('%A %d %B').upper()}")
    print(f"  {'─'*50}")
    print(f"  1. PROSPECCIÓN      → Agregar {meta['dms_por_dia'] * 3} leads nuevos")
    print(f"  2. ENGAGEMENT       → Like/comentar 3 posts de cada lead nuevo")
    print(f"  3. DMs A ENVIAR     → {meta['dms_por_dia']} DMs hoy (Touch 2)")
    print(f"  4. SEGUIMIENTOS     → Follow-up a leads que no contestaron en 24-48h")
    print(f"  5. LLAMADAS         → Confirmar y ejecutar llamadas agendadas")
    print(f"  {'─'*50}")
    print(f"  💡 FOCO COCHAVI:")
    print(f"     No pitches en el primer DM. Observación genuina primero.")
    print(f"     Agrega valor antes de pedir. Cierra pidiendo 15 min — no más.")
    print(f"     Cada NO te acerca al SÍ. Volumen con calidad.")
    print(f"  {'─'*50}\n")


# ────────────────────────────────────────────
# FLUJO PRINCIPAL
# ────────────────────────────────────────────
def agregar_lead(df):
    print("\n  ── Nuevo Lead ─────────────────────────────")

    username = pedir("@username (sin @)")
    full_user = f"@{username}"
    if full_user in df["username"].values:
        print(f"  ⚠️  {full_user} ya existe")
        return df

    nombre = pedir("Nombre del negocio/persona", default=username)

    print(f"\n  Nichos disponibles:")
    for idx, (k, v) in enumerate(NICHOS.items(), 1):
        print(f"    {idx:2}. {v['emoji']} {k}")
    nicho_key = pedir("Nicho (nombre exacto)")
    nicho_key = nicho_key if nicho_key in NICHOS else "otro"
    dolor = NICHOS[nicho_key]["dolor"]

    try:
        seguidores = int(pedir("Seguidores"))
        posts      = int(pedir("Publicaciones"))
    except ValueError:
        print("  ⚠️  Número inválido"); return df

    web_raw    = input("  Web en bio (Enter = no tiene): ").strip()
    tiene_web  = bool(web_raw)
    negocio    = input("  ¿Cuenta de negocio? (s/n): ").strip().lower() == "s"
    bio        = pedir("Bio (pegar o resumir)", obligatorio=False)
    notas      = pedir("Notas (por qué califica)", obligatorio=False)

    ratio = round(seguidores / max(posts, 1), 1)
    score = calcular_score_smsa(seguidores, posts, tiene_web, negocio, ratio)
    prio  = urgencia(score)
    etapa = "🎯 Prospectado"

    # Generar DMs
    dms = generar_dm(nicho_key, nombre)

    lead = {
        "username":        full_user,
        "nombre":          nombre,
        "nicho":           nicho_key,
        "seguidores":      seguidores,
        "posts":           posts,
        "ratio_seg_posts": ratio,
        "engagement_est":  f"~{round(ratio*0.01,2)}%",
        "tiene_web":       "Sí" if tiene_web else "NO",
        "web":             web_raw or "—",
        "bio":             bio[:140],
        "es_negocio":      "Sí" if negocio else "No",
        "url_perfil":      f"https://instagram.com/{username}",
        "score_smsa":      score,
        "prioridad":       prio,
        "dolor_principal": dolor,
        "toque_1_engagement": "Pendiente — like/comentar 2-3 posts antes del DM",
        "toque_2_dm":      dms["Touch 2 — Primer DM (observación genuina)"],
        "toque_3_followup": dms["Touch 3 — Follow-up (valor sin pitch)"],
        "toque_4_valor":   dms["Touch 4 — Pregunta que revela el dolor"],
        "toque_5_cta":     dms["Touch 5 — CTA suave"],
        "dm_enviado":      "No",
        "dm_fecha":        "",
        "estado":          "Nuevo",
        "etapa_smsa":      etapa,
        "notas":           notas,
        "fecha_registro":  datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    df = pd.concat([df, pd.DataFrame([lead])], ignore_index=True)
    df = df.sort_values("score_smsa", ascending=False).reset_index(drop=True)
    guardar_df(df)

    print(f"\n  ✅ {full_user} guardado")
    print(f"     Score SMSA: {score}/100 | {prio} | {dolor}")
    print(f"\n  📩 SECUENCIA DE DMs GENERADA:")
    for titulo, msg in dms.items():
        print(f"\n  [{titulo}]")
        print(f"  {msg}")

    return df


def actualizar_lead(df):
    username = pedir("@username a actualizar (sin @)")
    mask = df["username"] == f"@{username}"
    if not mask.any():
        print("  ⚠️  No encontrado"); return df

    print("\n  Estados: Nuevo | DM enviado | Respondió | Interesado | Llamada | Propuesta | Cerrado | No interesado")
    nuevo_estado = pedir("Nuevo estado")
    dm_raw       = input("  ¿DM enviado hoy? (s/n): ").strip().lower()
    notas        = pedir("Notas adicionales", obligatorio=False)

    df.loc[mask, "estado"]     = nuevo_estado
    df.loc[mask, "etapa_smsa"] = etapa_smsa("Sí" if dm_raw == "s" else df.loc[mask, "dm_enviado"].values[0], nuevo_estado)
    if dm_raw == "s":
        df.loc[mask, "dm_enviado"] = "Sí"
        df.loc[mask, "dm_fecha"]   = datetime.now().strftime("%Y-%m-%d")
    if notas:
        df.loc[mask, "notas"] = notas

    guardar_df(df)
    print(f"  ✅ {username} → {nuevo_estado} | {df.loc[mask, 'etapa_smsa'].values[0]}")

    # Si se cerró, celebrar
    if nuevo_estado == "Cerrado":
        meta = calcular_meta(df)
        print(f"\n  🎉 ¡CLIENTE CERRADO! Ingresos: ${meta['ingreso_actual']:,} CLP ({meta['porcentaje']}% de la meta)")

    return df


def ver_dms_lead(df):
    username = pedir("@username para ver sus DMs (sin @)")
    mask = df["username"] == f"@{username}"
    if not mask.any():
        print("  ⚠️  No encontrado"); return

    row = df[mask].iloc[0]
    print(f"\n  DMs para {row['username']} — {row['nombre']} ({row['nicho']})")
    print(f"  Dolor principal: {row['dolor_principal']}\n")
    touches = ["toque_1_engagement", "toque_2_dm", "toque_3_followup", "toque_4_valor", "toque_5_cta"]
    labels  = ["Touch 1 — Engagement (antes del DM)", "Touch 2 — Primer DM", "Touch 3 — Follow-up",
               "Touch 4 — Pregunta dolor", "Touch 5 — CTA"]
    for col, label in zip(touches, labels):
        val = row.get(col, "—")
        print(f"  [{label}]")
        print(f"  {val}\n")


def ver_funnel(df):
    if len(df) == 0:
        print("  Sin datos."); return
    print("\n  FUNNEL SMSA\n")
    etapas = df.groupby("etapa_smsa").size().reset_index(name="cantidad")
    for _, row in etapas.iterrows():
        barra = "█" * min(row["cantidad"], 30)
        print(f"  {row['etapa_smsa']:<30} {barra} {row['cantidad']}")


# ────────────────────────────────────────────
# MAIN
# ────────────────────────────────────────────
def main():
    df = cargar_df()
    imprimir_encabezado(df)

    MENU = dedent("""
  ¿Qué hacemos?
  1. Agregar lead nuevo
  2. Ver top leads
  3. Ver DMs de un lead
  4. Actualizar estado de lead
  5. Ver funnel SMSA
  6. Plan de acción del día
  7. Salir
""")

    while True:
        print(MENU)
        op = input("  → ").strip()

        if op == "1":
            df = agregar_lead(df)

        elif op == "2":
            n = input("  ¿Cuántos leads ver? [15]: ").strip()
            imprimir_top_leads(df, int(n) if n.isdigit() else 15)

        elif op == "3":
            ver_dms_lead(df)

        elif op == "4":
            df = actualizar_lead(df)

        elif op == "5":
            ver_funnel(df)

        elif op == "6":
            imprimir_plan_diario(df)

        elif op == "7":
            imprimir_encabezado(df)
            print(f"  📁 Leads guardados en: {ARCHIVO}\n")
            sys.exit(0)


if __name__ == "__main__":
    main()
