# NEXVORE — Sistema SMSA de Prospección

## Setup (1 vez)
```bash
cd scripts
pip install -r requirements.txt
```

## Arrancar
```bash
python agregar_lead.py
```

## Metodología Nick Cochavi (5 toques)

| Touch | Acción | Objetivo |
|-------|--------|----------|
| 1 | Like/comentar 2-3 posts | Aparecer en su radar |
| 2 | Primer DM — observación genuina | Romper el hielo sin pitch |
| 3 | Follow-up — dato de valor | Posicionarte como experto |
| 4 | Pregunta que revela el dolor | Calificar en frío |
| 5 | CTA suave (15 min de llamada) | Cerrar la reunión |

> **Regla de oro**: Nunca pitches en el primer DM. El 90% de las agencias lo hace y por eso nadie contesta.

## Conversiones objetivo (13 días)
- Agregar 40+ leads nuevos por día
- Enviar 15-20 DMs diarios
- 4-5 llamadas por semana
- 1-2 cierres por semana = meta $1.000.000 CLP

## Archivos generados
- `leads/leads.csv` — base de datos completa con DMs pre-escritos por nicho

---

# RADAR COSTERO — Extractor de leads (Temporada Llena™)

Extrae automáticamente **administradores de arriendos turísticos** del corredor
**Concón–Zapallar** desde Google Maps, con **teléfono listo para prospectar**,
calificados por el scoring de Temporada Llena y con el **valor del contrato** (los
dólares que puedes tocar) estimado por cada lead.

## Setup
```bash
cd nexvore-website
pip install -r scripts/requirements.txt
scrapling install          # baja el navegador stealth (solo la 1ª vez)
```

## Uso

**Opción A — Scrapling (scrapea Google Maps):**
```bash
python scripts/radar_costero.py --source scrapling --max 20
# Solo unas comunas / nichos:
python scripts/radar_costero.py --source scrapling --comunas Concón Zapallar --max 15
```

**Opción B — Google Places API (más confiable, dentro de los ToS de Google):**
```bash
export GOOGLE_PLACES_API_KEY="tu_key"     # console.cloud.google.com → Places API (New)
python scripts/radar_costero.py --source api --max 40
```

## Qué genera
`leads/radar_costero.csv` con, por cada lead:

| Campo | Para qué |
|-------|----------|
| `telefono` / `whatsapp_link` | Marcar y escribir de inmediato (Motor 1) |
| `tiene_web` | Sin web = depende de Airbnb = dolor #1 → +35 pts |
| `score` / `prioridad` | Ordena tu día: arranca por los 🔥 ALTA |
| `tramo_estimado` | Base / Estándar / Alto según actividad |
| `fee_mensual_clp` · `valor_contrato_3m_clp` · `valor_contrato_usd` | **Los dólares que puedes tocar** por cliente |
| `argumento_perdida` | Frase de anclaje en la pérdida, lista para la llamada |
| `toque_1..4` | Cadencia de seguimiento (Doc 3, §3.2), NO pitch en frío |

## Reglas (de tu propio documento)
- **30 contactos por día**, no negociable.
- **Toque 1 = "estudio de arriendos"**, nunca pitch en el primer mensaje.
- Nunca spam en grupos. Esto es prospección quirúrgica en un corredor chico.

> ⚠️ Scrapear Google Maps va contra los Términos de Google y su DOM cambia seguido
> (puede que toque ajustar los selectores en `SEL`). Para volumen serio y estable,
> `--source api` es el camino recomendado.
