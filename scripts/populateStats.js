const https = require('https');
const fs = require('fs');
const os = require('os');

const PROJECT = 'cnbmobile-2053c';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// Lê o token do Firebase CLI
const config = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const TOKEN = config.tokens.access_token;

function request(method, path, body) {
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
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Firestore runQuery para count
function runAggregation(collectionId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      structuredAggregationQuery: {
        aggregations: [{ alias: 'count', count: {} }],
        structuredQuery: { from: [{ collectionId }] },
      },
    });
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runAggregationQuery`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const arr = JSON.parse(raw);
          const count = parseInt(arr[0]?.result?.aggregateFields?.count?.integerValue ?? '0');
          resolve(count);
        } catch { resolve(0); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Busca todos docs de uma coleção (para somar campos)
function getAllDocs(collectionId, fields) {
  return new Promise((resolve, reject) => {
    const mask = fields.map(f => `mask.fieldPaths=${f}`).join('&');
    const url = new URL(`${BASE}/${collectionId}?${mask}&pageSize=3000`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve(data.documents ?? []);
        } catch { resolve([]); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getFieldValue(doc, field) {
  const f = doc.fields?.[field];
  if (!f) return 0;
  return parseFloat(f.integerValue ?? f.doubleValue ?? '0');
}

// Aceita --downloads=N como argumento (ex: node populateStats.js --downloads=12500)
const downloadsArg = process.argv.find(a => a.startsWith('--downloads='));
const downloadsOverride = downloadsArg ? parseInt(downloadsArg.split('=')[1]) : null;

async function run() {
  console.log('Calculando stats...');

  const [
    totalUsuarios,
    totalSaquesPIX,
    totalIndicacoes,
    diasAtividade,
    resgatesDocs,
    usuariosDocs,
  ] = await Promise.all([
    runAggregation('usuarios'),
    runAggregation('saques'),
    runAggregation('referrals_onchain'),
    runAggregation('provas_onchain'),
    getAllDocs('resgates_cnb', ['quantidade']),
    getAllDocs('usuarios', ['minutos', 'pontos']),
  ]);

  let totalCNBDistribuidos = 0;
  resgatesDocs.forEach(d => { totalCNBDistribuidos += getFieldValue(d, 'quantidade'); });

  let totalMinutos = 0;
  let totalPontos = 0;
  usuariosDocs.forEach(d => {
    totalMinutos += getFieldValue(d, 'minutos');
    totalPontos += getFieldValue(d, 'pontos');
  });

  // Busca downloads atual do Firestore se não foi passado como argumento
  let totalDownloads = downloadsOverride;
  if (totalDownloads === null) {
    const current = await request('GET', '/stats/public', null);
    totalDownloads = parseInt(current?.fields?.totalDownloads?.integerValue ?? '0');
  }

  const stats = {
    fields: {
      totalUsuarios: { integerValue: String(totalUsuarios) },
      totalCNBDistribuidos: { doubleValue: totalCNBDistribuidos },
      totalResgateCNB: { integerValue: String(resgatesDocs.length) },
      totalSaquesPIX: { integerValue: String(totalSaquesPIX) },
      totalIndicacoes: { integerValue: String(totalIndicacoes) },
      diasAtividade: { integerValue: String(diasAtividade) },
      totalMinutos: { doubleValue: totalMinutos },
      totalPontos: { doubleValue: totalPontos },
      totalDownloads: { integerValue: String(totalDownloads) },
    },
  };

  const result = await request('PATCH', '/stats/public', stats);

  if (result.name) {
    console.log('✅ stats/public atualizado com sucesso!');
    console.log(`  Usuários: ${totalUsuarios}`);
    console.log(`  Downloads: ${totalDownloads}`);
    console.log(`  CNB distribuídos: ${totalCNBDistribuidos}`);
    console.log(`  Saques PIX: ${totalSaquesPIX}`);
    console.log(`  Indicações: ${totalIndicacoes}`);
    console.log(`  Dias atividade: ${diasAtividade}`);
    console.log(`  Total minutos: ${totalMinutos}`);
    console.log(`  Total pontos: ${totalPontos}`);
  } else {
    console.error('❌ Erro:', JSON.stringify(result, null, 2));
  }
}

run().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
