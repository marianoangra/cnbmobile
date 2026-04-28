// One-shot: credita 20.000 pontos para cada tester cadastrado no Forms.
// Também ajusta pontosInicioSemana pra não bagunçar o ranking semanal
// (o bônus é um presente, não atividade).
// Idempotência: NÃO é idempotente — rodar 2× credita 40k. Cuidado.
// Uso: `node scripts/creditarBonusTesters.js`
const https = require('https');
const fs = require('fs');
const os = require('os');

const PROJECT = 'cnbmobile-2053c';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const BONUS = 20000;

// Emails coletados do Forms (coluna "email do CNB Mobile"), normalizados pra lowercase.
const EMAILS = [
  'marianoangra@gmail.com',
  'gilmarscn@gmail.com',
  'cleberborges121@gmail.com',
  'edsonconfig@gmail.com',
  'limasebastiaorodrigues0@gmail.com',
  'renatogalina17@gmail.com',
  'luandinojp@gmail.com',
  'gensveo@gmail.com',
  'neutron.vista@gmail.com',
  'ddivulga31@gmail.com',
  'marciascheda3577@gmail.com',
  'diegollima23456@gmail.com',
  // jcardosostz@yahoo.com.br pulado — Yahoo não funciona com Play Store testing.
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

// Lista TODOS os usuários (pagina) com email/pontos/pontosInicioSemana.
async function listarTodos() {
  const docs = [];
  let pageToken = '';
  do {
    const url = `/usuarios?pageSize=300&mask.fieldPaths=email&mask.fieldPaths=pontos&mask.fieldPaths=pontosInicioSemana${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const r = await req('GET', url);
    if (r.status !== 200) {
      console.error('Erro ao listar:', r.body);
      throw new Error('Falha listagem');
    }
    (r.body.documents || []).forEach(d => {
      const uid = d.name.split('/').pop();
      const email = d.fields?.email?.stringValue ?? null;
      const pontos = parseInt(d.fields?.pontos?.integerValue ?? '0', 10);
      const pontosInicioSemana = d.fields?.pontosInicioSemana
        ? parseInt(d.fields.pontosInicioSemana.integerValue, 10)
        : null;
      docs.push({ uid, email, pontos, pontosInicioSemana });
    });
    pageToken = r.body.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function creditar(uid, pontosAtuais, pontosInicioSemanaAtuais) {
  const fields = {
    pontos: { integerValue: String(pontosAtuais + BONUS) },
  };
  let mask = 'updateMask.fieldPaths=pontos';
  if (pontosInicioSemanaAtuais !== null) {
    fields.pontosInicioSemana = {
      integerValue: String(pontosInicioSemanaAtuais + BONUS),
    };
    mask += '&updateMask.fieldPaths=pontosInicioSemana';
  }
  const r = await req('PATCH', `/usuarios/${uid}?${mask}`, { fields });
  return r.status === 200;
}

(async () => {
  console.log(`Listando todos usuários...`);
  const todos = await listarTodos();
  console.log(`${todos.length} usuários encontrados.\n`);

  // Mapa email-lowercase → user
  const porEmail = new Map();
  todos.forEach(u => {
    if (u.email) porEmail.set(u.email.toLowerCase().trim(), u);
  });

  console.log(`Creditando +${BONUS.toLocaleString('pt-BR')} pts para ${EMAILS.length} testers...\n`);

  const naoEncontrados = [];
  const ok = [];
  const falhas = [];

  for (const email of EMAILS) {
    const u = porEmail.get(email.toLowerCase().trim());
    if (!u) {
      console.log(`  ✗ ${email} — sem conta no app`);
      naoEncontrados.push(email);
      continue;
    }
    const sucesso = await creditar(u.uid, u.pontos, u.pontosInicioSemana);
    if (sucesso) {
      console.log(`  ✓ ${email} (${u.uid}) — ${u.pontos.toLocaleString('pt-BR')} → ${(u.pontos + BONUS).toLocaleString('pt-BR')} pts`);
      ok.push(email);
    } else {
      console.log(`  ✗ ${email} — erro no PATCH`);
      falhas.push(email);
    }
  }

  console.log(`\nResumo: ${ok.length} ok, ${naoEncontrados.length} sem conta, ${falhas.length} falhas`);
  if (naoEncontrados.length > 0) {
    console.log('\nSem conta no app (precisam baixar/logar primeiro):');
    naoEncontrados.forEach(e => console.log(`  - ${e}`));
  }
})();
