/**
 * sender.js
 * Lee businesses.json y envía mensajes de WhatsApp a cada número.
 * Muestra QR en terminal para autenticar WhatsApp Web.
 *
 * Uso: node sender.js
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ─── Configuración ───────────────────────────────────────────────────────────

const BUSINESSES_FILE = path.join(__dirname, 'businesses.json');
const SENT_LOG_FILE   = path.join(__dirname, 'sent.json');

const MIN_DELAY_MS = 15000; // 15 segundos
const MAX_DELAY_MS = 45000; // 45 segundos

const MESSAGE = `Hola, buen día 👋

Me llamo Mateo González, tengo 18 años y estoy buscando trabajo en la zona.

Soy responsable, aprendo rápido y me adapto a cualquier área — atención al cliente, bodega, reparto, administración, lo que necesiten.

Disponibilidad inmediata y horario flexible.

📞 945076214

¿Tienen algo disponible o conocen a alguien que esté buscando personal?`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay() {
  return Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function loadSentLog() {
  if (!fs.existsSync(SENT_LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SENT_LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSentLog(log) {
  fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
}

function formatTime(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       WHATSAPP JOB BLAST – SENDER                ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Cargar negocios
  if (!fs.existsSync(BUSINESSES_FILE)) {
    console.error(`❌ No se encontró ${BUSINESSES_FILE}. Ejecuta primero: node scraper.js`);
    process.exit(1);
  }

  const allBusinesses = JSON.parse(fs.readFileSync(BUSINESSES_FILE, 'utf8'));
  const targets = allBusinesses.filter(b => b.phone);

  if (targets.length === 0) {
    console.error('❌ No hay negocios con teléfono en businesses.json');
    process.exit(1);
  }

  // Cargar log existente para no reenviar
  const sentLog = loadSentLog();
  const alreadySent = new Set(sentLog.filter(e => e.status === 'enviado').map(e => e.phone));

  const pending = targets.filter(b => !alreadySent.has(b.phone));

  console.log(`📋 Negocios con teléfono : ${targets.length}`);
  console.log(`✅ Ya enviados           : ${alreadySent.size}`);
  console.log(`📤 Pendientes            : ${pending.length}`);

  if (pending.length === 0) {
    console.log('\n✅ Todos los mensajes ya fueron enviados.');
    return;
  }

  // Calcular tiempo estimado
  const avgDelay = (MIN_DELAY_MS + MAX_DELAY_MS) / 2;
  const estimatedMs = pending.length * avgDelay;
  console.log(`⏱  Tiempo estimado       : ${formatTime(estimatedMs)}\n`);

  // Inicializar cliente WhatsApp
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  // QR Code
  client.on('qr', (qr) => {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  Escanea este QR con WhatsApp (Dispositivos vinculados)');
    console.log('══════════════════════════════════════════════════\n');
    qrcode.generate(qr, { small: true });
    console.log('\nEsperando autenticación...');
  });

  client.on('authenticated', () => {
    console.log('\n✅ WhatsApp autenticado correctamente.\n');
  });

  client.on('auth_failure', (msg) => {
    console.error('\n❌ Error de autenticación:', msg);
    process.exit(1);
  });

  // Esperar a que el cliente esté listo antes de enviar
  await new Promise((resolve, reject) => {
    client.on('ready', () => {
      console.log('✅ WhatsApp Web listo. Iniciando envíos...\n');
      resolve();
    });
    client.on('auth_failure', reject);
    client.initialize();
  });

  // ─── Envío de mensajes ───────────────────────────────────────────────────

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const biz = pending[i];
    const chatId = `${biz.phone}@c.us`;
    const progress = `[${i + 1}/${pending.length}]`;

    process.stdout.write(`${progress} ${biz.name} (${biz.city}) → ${biz.phone} ... `);

    const logEntry = {
      phone: biz.phone,
      name: biz.name,
      city: biz.city,
      timestamp: new Date().toISOString(),
      status: null,
      error: null,
    };

    try {
      // Verificar si el número existe en WhatsApp
      const isRegistered = await client.isRegisteredUser(chatId);
      if (!isRegistered) {
        logEntry.status = 'error';
        logEntry.error = 'Número no registrado en WhatsApp';
        sentLog.push(logEntry);
        saveSentLog(sentLog);
        console.log('❌ No registrado en WhatsApp');
        failed++;
      } else {
        await client.sendMessage(chatId, MESSAGE);
        logEntry.status = 'enviado';
        sentLog.push(logEntry);
        saveSentLog(sentLog);
        console.log('✅ Enviado');
        sent++;
      }
    } catch (err) {
      logEntry.status = 'error';
      logEntry.error = err.message;
      sentLog.push(logEntry);
      saveSentLog(sentLog);
      console.log(`❌ Error: ${err.message}`);
      failed++;
    }

    // Delay aleatorio entre mensajes (excepto en el último)
    if (i < pending.length - 1) {
      const delay = randomDelay();
      process.stdout.write(`   ⏳ Esperando ${formatTime(delay)}...\n`);
      await sleep(delay);
    }
  }

  // ─── Resumen final ───────────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════════════');
  console.log('               RESUMEN FINAL');
  console.log('══════════════════════════════════════════════════');
  console.log(`✅ Enviados con éxito : ${sent}`);
  console.log(`❌ Fallidos          : ${failed}`);
  console.log(`📊 Total procesados  : ${sent + failed}`);
  console.log(`📄 Log guardado en   : ${SENT_LOG_FILE}`);
  console.log('══════════════════════════════════════════════════\n');

  await client.destroy();
}

main().catch(err => {
  console.error('\nError fatal:', err);
  process.exit(1);
});
