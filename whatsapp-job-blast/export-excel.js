/**
 * export-excel.js
 * Lee businesses.json y genera contactos.xlsx listo para enviar tu currículum.
 *
 * Uso: node export-excel.js
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const BUSINESSES_FILE = path.join(__dirname, 'businesses.json');
const OUTPUT_FILE     = path.join(__dirname, 'contactos.xlsx');

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        EXPORTADOR DE CONTACTOS A EXCEL           ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(BUSINESSES_FILE)) {
    console.error('❌ No se encontró businesses.json. Ejecuta primero: node scraper.js');
    process.exit(1);
  }

  const all = JSON.parse(fs.readFileSync(BUSINESSES_FILE, 'utf8'));
  const withPhone = all.filter(b => b.phone);
  const noPhone   = all.filter(b => !b.phone);

  console.log(`Total negocios      : ${all.length}`);
  console.log(`Con teléfono/WA     : ${withPhone.length}`);
  console.log(`Sin teléfono        : ${noPhone.length}\n`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mateo González – Job Blast';
  workbook.created = new Date();

  // ── Hoja 1: Con teléfono (para enviar currículum por WhatsApp) ──────────
  const sheetPhone = workbook.addWorksheet('📱 Con WhatsApp', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheetPhone.columns = [
    { header: 'N°',                key: 'index',    width: 6  },
    { header: 'Nombre del negocio',key: 'name',     width: 40 },
    { header: 'Ciudad',            key: 'city',     width: 16 },
    { header: 'Teléfono',          key: 'phone',    width: 18 },
    { header: 'WhatsApp (link)',   key: 'walink',   width: 42 },
    { header: 'Google Maps',       key: 'url',      width: 50 },
    { header: 'Estado envío',      key: 'status',   width: 18 },
    { header: 'Fecha envío',       key: 'date',     width: 16 },
    { header: 'Notas',             key: 'notes',    width: 30 },
  ];

  // Estilo del encabezado
  const headerRow = sheetPhone.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A4B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 22;

  // Agregar filas
  withPhone.forEach((biz, i) => {
    const waLink = `https://wa.me/${biz.phone}`;
    const row = sheetPhone.addRow({
      index:  i + 1,
      name:   biz.name,
      city:   biz.city,
      phone:  biz.phone,
      walink: waLink,
      url:    biz.url || '',
      status: 'Pendiente',
      date:   '',
      notes:  '',
    });

    // Estilo alterno por fila
    const fill = i % 2 === 0
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FFF4' } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    row.fill = fill;
    row.alignment = { vertical: 'middle' };

    // Link clickeable en columna WhatsApp
    const waCell = row.getCell('walink');
    waCell.value = { text: waLink, hyperlink: waLink };
    waCell.font = { color: { argb: 'FF0563C1' }, underline: true };

    // Link clickeable en columna Google Maps
    if (biz.url) {
      const urlCell = row.getCell('url');
      urlCell.value = { text: 'Ver en Maps', hyperlink: biz.url };
      urlCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }

    // Validación desplegable en "Estado envío"
    row.getCell('status').dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Pendiente,Enviado,Sin respuesta,Interesados,No disponible"'],
    };
  });

  // Auto-filter
  sheetPhone.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: sheetPhone.columnCount },
  };

  // ── Hoja 2: Sin teléfono (referencia) ───────────────────────────────────
  const sheetNoPhone = workbook.addWorksheet('📋 Sin teléfono', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheetNoPhone.columns = [
    { header: 'N°',                key: 'index', width: 6  },
    { header: 'Nombre del negocio',key: 'name',  width: 40 },
    { header: 'Ciudad',            key: 'city',  width: 16 },
    { header: 'Google Maps',       key: 'url',   width: 50 },
  ];

  const headerRow2 = sheetNoPhone.getRow(1);
  headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF555555' } };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow2.height = 22;

  noPhone.forEach((biz, i) => {
    const row = sheetNoPhone.addRow({
      index: i + 1,
      name:  biz.name,
      city:  biz.city,
      url:   biz.url || '',
    });
    row.fill = i % 2 === 0
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    if (biz.url) {
      const urlCell = row.getCell('url');
      urlCell.value = { text: 'Ver en Maps', hyperlink: biz.url };
      urlCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }
  });

  sheetNoPhone.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: sheetNoPhone.columnCount },
  };

  // ── Hoja 3: Resumen ──────────────────────────────────────────────────────
  const sheetResumen = workbook.addWorksheet('📊 Resumen');

  sheetResumen.getColumn('A').width = 28;
  sheetResumen.getColumn('B').width = 18;

  const titulo = sheetResumen.getCell('A1');
  titulo.value = 'Resumen de contactos extraídos';
  titulo.font = { bold: true, size: 14, color: { argb: 'FF1F7A4B' } };
  sheetResumen.mergeCells('A1:B1');

  const datos = [
    ['Total negocios encontrados', all.length],
    ['Con teléfono (para enviar CV)', withPhone.length],
    ['Sin teléfono',                  noPhone.length],
    ['', ''],
    ['Ciudades incluidas', CITIES_LABEL],
    ['Fecha de extracción', new Date().toLocaleDateString('es-CL')],
  ];

  datos.forEach(([label, value], i) => {
    const row = sheetResumen.getRow(i + 3);
    row.getCell('A').value = label;
    row.getCell('A').font = { bold: true };
    row.getCell('B').value = value;
    if (i < 3) {
      row.getCell('B').font = { bold: true, color: { argb: 'FF1F7A4B' } };
      row.getCell('B').numFmt = '#,##0';
    }
  });

  // Guardar
  await workbook.xlsx.writeFile(OUTPUT_FILE);

  console.log(`✅ Excel generado: ${OUTPUT_FILE}`);
  console.log(`\n   Hoja 1 "📱 Con WhatsApp" → ${withPhone.length} contactos con link wa.me directo`);
  console.log(`   Hoja 2 "📋 Sin teléfono"  → ${noPhone.length} negocios de referencia`);
  console.log(`   Hoja 3 "📊 Resumen"        → estadísticas\n`);
  console.log('Abre contactos.xlsx, filtra por ciudad o estado, y envía tu currículum');
  console.log('haciendo clic en cada link de WhatsApp. Marca el estado en la columna "Estado envío".\n');
}

// Lista legible de ciudades para el resumen
const CITIES_LABEL = 'Limache, Olmué, Quilpué, Villa Alemana, Peñablanca';

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
