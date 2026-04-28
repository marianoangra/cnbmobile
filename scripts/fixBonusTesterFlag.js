// Fix one-shot:
// 1. Reverte 20k extras do marianoangra (foi creditado 2x: backfill + teste do Cloud Function)
// 2. Seta `bonusTesterCreditado: true` nos 11 testers do backfill anterior pra evitar
//    que o Cloud Function (chamado pelo Apps Script) credite de novo.
const https = require('https');
const fs = require('fs');
const os = require('os');

const PROJECT = 'cnbmobile-2053c';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const BONUS = 20000;

const TESTERS_JA_CREDITADOS = [
  // uid, ajuste de pontos, ajuste de pontosInicioSemana
  ['vfI2wvWr4IarNCzeUnnH6jKjBN43', -BONUS, -BONUS], // marianoangra (reverter teste)
  ['LybDEN3gsheBjJ80Ef0gSYcOyOR2', 0, 0],            // gilmarscn
  ['aYfYn7ne5GTeuU1WtI7UhI01O9M2', 0, 0],            // cleberborges121
  ['42F0Ocvk0XNgEU9rCr6NPdfH0zi2', 0, 0],            // edsonconfig
  ['81tUG7jxEWYM5Wj74aCr3PN1wrD2', 0, 0],            // limasebastiaorodrigues0
  ['VujT8jdL4zeH1VFkzAZzK55Q4Cm1', 0, 0],            // renatogalina17
  ['12qX2Bm5pBUIKKLlRmEf4l3H8mz1', 0, 0],            // luandinojp
  ['1ItYDGc59uQ8p8WoMrPfLJuzxZe2', 0, 0],            // gensveo
  ['Q8XbixvXKqQPAUVl1onvKDvm2mv1', 0, 0],            // neutron.vista
  ['vjCaZKRWLbTvmlDlxE3SOXpVXZE2', 0, 0],            // marciascheda3577
  ['bWXgH0Fh4ddEb5Wg3xCWk7v7Hrh2', 0, 0],            // diegollima23456
];

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

async function ler(uid) {
  const r = await req('GET', `/usuarios/${uid}?mask.fieldPaths=pontos&mask.fieldPaths=pontosInicioSemana&mask.fieldPaths=bonusTesterCreditado`);
  if (r.status !== 200) return null;
  const f = r.body.fields ?? {};
  return {
    pontos: parseInt(f.pontos?.integerValue ?? '0', 10),
    pontosInicioSemana: f.pontosInicioSemana ? parseInt(f.pontosInicioSemana.integerValue, 10) : null,
    bonusTesterCreditado: f.bonusTesterCreditado?.booleanValue === true,
  };
}

async function patch(uid, ajustePts, ajusteInicio, atual) {
  const fields = {
    pontos: { integerValue: String(atual.pontos + ajustePts) },
    bonusTesterCreditado: { booleanValue: true },
  };
  let mask = 'updateMask.fieldPaths=pontos&updateMask.fieldPaths=bonusTesterCreditado';
  if (atual.pontosInicioSemana !== null && ajusteInicio !== 0) {
    fields.pontosInicioSemana = {
      integerValue: String(atual.pontosInicioSemana + ajusteInicio),
    };
    mask += '&updateMask.fieldPaths=pontosInicioSemana';
  }
  const r = await req('PATCH', `/usuarios/${uid}?${mask}`, { fields });
  return r.status === 200;
}

(async () => {
  console.log(`Processando ${TESTERS_JA_CREDITADOS.length} testers...\n`);
  for (const [uid, ajustePts, ajusteInicio] of TESTERS_JA_CREDITADOS) {
    const atual = await ler(uid);
    if (!atual) {
      console.log(`  ✗ ${uid} — não encontrado`);
      continue;
    }
    if (atual.bonusTesterCreditado && ajustePts === 0) {
      console.log(`  ~ ${uid} — flag já estava setada, sem ajuste`);
      continue;
    }
    const sucesso = await patch(uid, ajustePts, ajusteInicio, atual);
    const ajusteStr = ajustePts !== 0 ? ` (ajuste pts: ${ajustePts > 0 ? '+' : ''}${ajustePts})` : '';
    console.log(`  ${sucesso ? '✓' : '✗'} ${uid}${ajusteStr} → flag setada`);
  }
  console.log('\nFeito.');
})();
