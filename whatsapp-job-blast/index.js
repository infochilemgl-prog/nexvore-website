/**
 * index.js
 * Orquestador: corre scraper y luego sender en secuencia.
 *
 * Uso: node index.js
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BUSINESSES_FILE = path.join(__dirname, 'businesses.json');

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      cwd: __dirname,
    });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} terminó con código ${code}`));
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         WHATSAPP JOB BLAST – MODO COMPLETO       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Paso 1: Scraping
  console.log('PASO 1: Extrayendo negocios desde Google Maps...\n');
  await runScript('scraper.js');

  // Verificar que se generaron negocios
  if (!fs.existsSync(BUSINESSES_FILE)) {
    console.error('\n❌ El scraper no generó businesses.json. Abortando.');
    process.exit(1);
  }

  const businesses = JSON.parse(fs.readFileSync(BUSINESSES_FILE, 'utf8'));
  const withPhone = businesses.filter(b => b.phone).length;

  if (withPhone === 0) {
    console.error('\n❌ No se encontraron negocios con teléfono. Verifica la conexión y vuelve a intentar.');
    process.exit(1);
  }

  console.log(`\n✅ Scraping completado. ${withPhone} negocios con teléfono listos para envío.\n`);
  console.log('─'.repeat(50));

  // Paso 2: Envío
  console.log('\nPASO 2: Enviando mensajes por WhatsApp...\n');
  await runScript('sender.js');

  console.log('\n✅ Proceso completo finalizado.');
}

main().catch(err => {
  console.error('Error fatal en index.js:', err.message);
  process.exit(1);
});
