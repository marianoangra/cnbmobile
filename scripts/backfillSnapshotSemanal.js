// Backfill one-shot: define pontosInicioSemana = pontos atual em todos os usuarios.
// Roda uma vez após o deploy do snapshotInicioSemana. Idempotente.
// Uso: `node scripts/backfillSnapshotSemanal.js` (precisa firebase login feito).
const https = require('https');
const fs = require('fs');
const os = require('os');

const PROJECT = 'cnbmobile-2053c';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const config = JSON.parse(
  fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8')
);
const TOKEN = config.tokens.access_token;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function listarUsuarios() {
  const docs = [];
  let pageToken = '';
  do {
    const url = `/usuarios?pageSize=300&mask.fieldPaths=pontos${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const r = await req('GET', url);
    if (r.status !== 200) {
      console.error('Erro ao listar:', r.body);
      throw new Error('Falha listagem');
    }
    (r.body.documents || []).forEach(d => {
      const uid = d.name.split('/').pop();
      const pontos = parseInt(d.fields?.pontos?.integerValue ?? '0', 10);
      docs.push({ uid, pontos });
    });
    pageToken = r.body.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function atualizar(uid, pontos) {
  const url = `/usuarios/${uid}?updateMask.fieldPaths=pontosInicioSemana&updateMask.fieldPaths=inicioSemana`;
  const body = {
    fields: {
      pontosInicioSemana: { integerValue: String(pontos) },
      inicioSemana: { timestampValue: new Date().toISOString() },
    },
  };
  const r = await req('PATCH', url, body);
  if (r.status !== 200) {
    console.warn(`  ✗ ${uid}: status ${r.status}`, JSON.stringify(r.body).slice(0, 200));
    return false;
  }
  return true;
}

(async () => {
  console.log('Buscando usuarios...');
  const users = await listarUsuarios();
  console.log(`${users.length} usuarios encontrados. Fazendo snapshot...`);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < users.length; i++) {
    const { uid, pontos } = users[i];
    const sucesso = await atualizar(uid, pontos);
    if (sucesso) ok++;
    else fail++;
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${users.length} (${ok} ok, ${fail} falhas)`);
  }
  console.log(`\nFeito: ${ok} ok, ${fail} falhas de ${users.length}`);
})();
