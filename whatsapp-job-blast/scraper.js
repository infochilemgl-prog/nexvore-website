/**
 * scraper.js
 * Extrae negocios con teléfono desde Google Maps para ciudades del Gran Valparaíso.
 * Usa Playwright (Chromium headless).
 *
 * Uso: node scraper.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

// ─── Configuración ───────────────────────────────────────────────────────────

const CITIES = ['Limache', 'Olmué', 'Quilpué', 'Villa Alemana', 'Peñablanca'];

const SEARCH_TERMS = [
  'negocios',
  'restaurantes',
  'ferreterías',
  'supermercados',
  'tiendas',
  'almacenes',
  'farmacias',
  'peluquerías',
  'talleres mecánicos',
  'minimarket',
  'carnicerías',
  'panaderías',
  'veterinarias',
  'botillerías',
  'distribuidoras',
];

const MAX_RESULTS_PER_SEARCH = 20; // resultados máximos por búsqueda
const SCROLL_TIMES = 5;            // veces que se hace scroll en el panel de resultados
const SCROLL_DELAY_MS = 1500;      // ms entre scrolls

const OUTPUT_JSON = path.join(__dirname, 'businesses.json');
const OUTPUT_CSV  = path.join(__dirname, 'businesses.csv');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Normaliza un número chileno a formato internacional 56XXXXXXXXX */
function normalizePhone(raw) {
  if (!raw) return null;
  // quitar todo excepto dígitos y +
  let n = raw.replace(/[^\d+]/g, '');
  // quitar + inicial
  n = n.replace(/^\+/, '');
  // si empieza en 56 y tiene 11 dígitos → ok
  if (/^56\d{9}$/.test(n)) return n;
  // si empieza en 9 y tiene 9 dígitos → celular chileno
  if (/^9\d{8}$/.test(n)) return '56' + n;
  // si tiene 8 dígitos y empieza en 2/3/4/5/6/7 → fijo chileno
  if (/^[23456789]\d{7}$/.test(n)) return '56' + n;
  // si empieza en 0 (ej. 09...)
  if (/^09\d{7}$/.test(n)) return '56' + n.slice(1);
  return null;
}

/** Deduplication por teléfono normalizado */
function deduplicate(list) {
  const seen = new Set();
  return list.filter(b => {
    const key = b.phone || `${b.name}-${b.city}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Scraping ────────────────────────────────────────────────────────────────

async function scrapeSearch(page, city, term) {
  const query = encodeURIComponent(`${term} en ${city} Chile`);
  const url = `https://www.google.com/maps/search/${query}`;
  const results = [];

  console.log(`  → Buscando: "${term}" en ${city}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Esperar panel lateral de resultados
    const panelSel = '[role="feed"]';
    try {
      await page.waitForSelector(panelSel, { timeout: 10000 });
    } catch {
      // Puede ser que solo se muestre un resultado directo
    }

    // Scroll para cargar más resultados
    for (let i = 0; i < SCROLL_TIMES; i++) {
      await page.evaluate((sel) => {
        const panel = document.querySelector(sel);
        if (panel) panel.scrollTop += 600;
      }, panelSel);
      await sleep(SCROLL_DELAY_MS);
    }

    // Recopilar todos los links de negocios visibles
    const links = await page.$$eval('a[href*="/maps/place/"]', (els) =>
      [...new Set(els.map(el => el.href).filter(h => h.includes('/maps/place/')))].slice(0, 25)
    );

    // Visitar cada negocio para extraer teléfono
    for (const link of links.slice(0, MAX_RESULTS_PER_SEARCH)) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(1200);

        // Nombre
        const name = await page.$eval('h1', el => el.textContent.trim()).catch(() => null);
        if (!name) continue;

        // Teléfono: buscar botón o texto con número
        let rawPhone = null;

        // Intentar encontrar el botón de llamada o el dato de teléfono
        rawPhone = await page.evaluate(() => {
          // Buscar en botones aria-label que contengan número
          const btns = document.querySelectorAll('button[data-item-id*="phone"], [data-tooltip*="Llamar"], [aria-label*="Teléfono"], [aria-label*="teléfono"], [aria-label*="phone"]');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || '';
            const match = label.match(/[\d\s()+\-]{7,}/);
            if (match) return match[0];
          }

          // Buscar en spans/divs que contengan solo dígitos con formato teléfono
          const allText = document.querySelectorAll('[data-item-id*="phone"] span, [data-item-id*="phone"] div');
          for (const el of allText) {
            const t = el.textContent.trim();
            if (/^[\d\s()+\-]{7,20}$/.test(t)) return t;
          }

          // Buscar en secciones de información
          const sections = document.querySelectorAll('div[class*="fontBodyMedium"], span[class*="fontBodyMedium"]');
          for (const s of sections) {
            const t = s.textContent.trim();
            // Número chileno: 9 dígitos empezando en 9, o con +56, o fijo
            if (/(\+?56\s?)?(\d[\s\-]?){8,}/.test(t) && t.length < 30) return t;
          }
          return null;
        });

        // Si no encontramos teléfono en la página de detalle, intentar con selector directo
        if (!rawPhone) {
          rawPhone = await page.$eval(
            'button[data-item-id*="phone"]',
            el => el.getAttribute('aria-label') || el.textContent
          ).catch(() => null);
        }

        const phone = normalizePhone(rawPhone);

        results.push({
          name,
          phone: phone || null,
          rawPhone: rawPhone || null,
          city,
          url: link,
        });

        process.stdout.write(`     ✓ ${name}${phone ? ' | ' + phone : ' | sin teléfono'}\n`);
      } catch (err) {
        // Ignorar errores por negocio individual
      }
    }
  } catch (err) {
    console.warn(`  ⚠ Error en búsqueda "${term}" en ${city}: ${err.message}`);
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       SCRAPER DE NEGOCIOS – GOOGLE MAPS          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Usar browser del sistema si existe (entornos cloud sin descarga de Chromium)
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--lang=es-CL',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ],
    ignoreHTTPSErrors: true,
  });

  const context = await browser.newContext({
    locale: 'es-CL',
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Aceptar cookies de Google si aparece el banner
  try {
    await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);
    const acceptBtn = page.locator('button:has-text("Aceptar todo"), button:has-text("Accept all"), form:nth-of-type(2) button');
    if (await acceptBtn.first().isVisible({ timeout: 4000 })) {
      await acceptBtn.first().click();
      await sleep(1000);
    }
  } catch {}

  let allBusinesses = [];

  for (const city of CITIES) {
    console.log(`\n🏙  Ciudad: ${city}`);
    console.log('─'.repeat(48));

    for (const term of SEARCH_TERMS) {
      const found = await scrapeSearch(page, city, term);
      allBusinesses.push(...found);
      await sleep(1000 + Math.random() * 1000);
    }
  }

  await browser.close();

  // Deduplicar
  const unique = deduplicate(allBusinesses);
  const withPhone = unique.filter(b => b.phone);

  console.log('\n══════════════════════════════════════════════════');
  console.log(`Total extraídos  : ${allBusinesses.length}`);
  console.log(`Únicos           : ${unique.length}`);
  console.log(`Con teléfono     : ${withPhone.length}`);
  console.log('══════════════════════════════════════════════════');

  // Guardar JSON (todos)
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(unique, null, 2), 'utf8');
  console.log(`\n✅ JSON guardado en: ${OUTPUT_JSON}`);

  // Guardar CSV
  const csvWriter = createObjectCsvWriter({
    path: OUTPUT_CSV,
    header: [
      { id: 'name',     title: 'Nombre' },
      { id: 'phone',    title: 'Teléfono' },
      { id: 'rawPhone', title: 'Teléfono Original' },
      { id: 'city',     title: 'Ciudad' },
      { id: 'url',      title: 'URL' },
    ],
  });
  await csvWriter.writeRecords(unique);
  console.log(`✅ CSV guardado en: ${OUTPUT_CSV}`);

  if (withPhone.length < 100) {
    console.log(`\n⚠  Solo se encontraron ${withPhone.length} negocios con teléfono.`);
    console.log('   Considera agregar más términos de búsqueda en SEARCH_TERMS o ampliar MAX_RESULTS_PER_SEARCH.');
  } else {
    console.log(`\n🎉 Meta alcanzada: ${withPhone.length} negocios con teléfono.`);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
