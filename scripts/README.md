# NEXVORE — Sistema SMSA de Prospección

## Setup (1 vez)
```bash
cd scripts
pip install -r requirements.txt
```

## Dos herramientas

| Script | Para qué | Fuente |
|--------|----------|--------|
| `extraer_leads.py` | **Sacar prospectos con teléfono** listos para llamar + análisis de mercado | Google Maps (automático) |
| `agregar_lead.py` | Gestionar leads a mano + generar DMs de Instagram | Manual |

---

## 1) Extractor de leads — `extraer_leads.py`

Saca negocios locales **reales** de Google Maps con **teléfono listo para llamar**,
los puntúa con tu scoring SMSA (sin web = máxima oportunidad), te genera un
**guion de llamada por nicho** y un **análisis de mercado** (dólares alcanzables).

```bash
# Todos los nichos, Santiago
python extraer_leads.py

# Zona y nichos específicos
python extraer_leads.py --zona "Providencia, Santiago" --nichos peluqueros,restaurantes --max 40

# Ver el navegador mientras trabaja (debug)
python extraer_leads.py --no-headless
```

**Salidas:**
- `leads/leads_google.csv` — CSV listo para llamar (nombre, teléfono E.164, sin web sí/no, dirección, rating, score, guion apertura/dolor/CTA, valor estimado CLP/USD).
- `leads/analisis_mercado.md` — resumen ejecutivo + dinero alcanzable + desglose por nicho.

**Opciones útiles:** `--max N` (fichas por búsqueda), `--usd 950` (tipo de cambio), `--timeout 45000`, `--pausa 1.0` (segundos entre fichas).

> ⚠️ **Dónde correrlo:** ejecútalo en **tu computador** (o un entorno con salida
> a internet abierta). El entorno remoto de Claude bloquea Google por política de
> red, así que ahí no extrae — pero el código y la lógica ya están probados.
> El script **no inventa** teléfonos: salen de la ficha pública real de cada negocio.

---

## 2) Gestión manual — `agregar_lead.py`
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
- `leads/leads_google.csv` — prospectos con teléfono extraídos de Google Maps (listos para llamar)
- `leads/analisis_mercado.md` — análisis de mercado por nicho
- `leads/leads.csv` — base manual con DMs pre-escritos por nicho
