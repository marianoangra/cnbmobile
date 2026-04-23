const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { acumularPontosOnChain, tentarResgatarTokensOnChain } = require('./anchor-helper');
const { resgatarPontosPrivado, PONTOS_POR_BLOCO } = require('./cloak-helper');

initializeApp();

const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');
const solanaPrivateKey = defineSecret('SOLANA_PRIVATE_KEY');

const DESTINATARIO = 'contato@rafaelmariano.com.br';

// ─── Notificação de saque por email ──────────────────────────────────────────
exports.notificarSaque = onDocumentCreated(
  {
    document: 'saques/{saqueId}',
    secrets: [smtpUser, smtpPass],
    region: 'us-central1',
  },
  async (event) => {
    const saque = event.data?.data();
    if (!saque) return;

    const { nome, chavePix, pontos, uid, criadoEm } = saque;

    const data = criadoEm?.toDate
      ? criadoEm.toDate().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const saqueId = event.params.saqueId;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser.value(),
        pass: smtpPass.value(),
      },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00FF88; background: #0A0F1E; padding: 20px; border-radius: 8px;">
          ⚡ Nova Solicitação de Saque — CNB Mobile
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr style="background: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 40%;">ID do Saque</td>
            <td style="padding: 10px;">${saqueId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">UID do Usuário</td>
            <td style="padding: 10px;">${uid ?? '—'}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Nome Completo</td>
            <td style="padding: 10px;">${nome ?? '—'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Chave PIX</td>
            <td style="padding: 10px; font-size: 16px; color: #333;">${chavePix ?? '—'}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Pontos Solicitados</td>
            <td style="padding: 10px; font-size: 18px; font-weight: bold; color: #00AA55;">
              ${Number(pontos ?? 0).toLocaleString('pt-BR')} pontos
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Data/Hora</td>
            <td style="padding: 10px;">${data}</td>
          </tr>
        </table>
        <p style="margin-top: 24px; color: #666; font-size: 13px;">
          Acesse o <a href="https://console.firebase.google.com/project/cnbmobile-2053c/firestore/data/saques">Firebase Console</a>
          para ver todos os saques pendentes.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"CNB Mobile" <${smtpUser.value()}>`,
      to: DESTINATARIO,
      subject: `💰 Novo saque: ${nome ?? uid} — ${Number(pontos ?? 0).toLocaleString('pt-BR')} pontos`,
      html,
    });

    console.log(`Notificação enviada para ${DESTINATARIO} — saque ${saqueId}`);
  }
);

// ─── 1% de comissão para o indicador quando o indicado faz um saque ─────────
// Ex: saque de 100.000 pts → indicador recebe +1.000 pts automaticamente.
exports.processarComissaoSaque = onDocumentCreated(
  { document: 'saques/{saqueId}', region: 'us-central1' },
  async (event) => {
    const saque = event.data?.data();
    if (!saque) return;

    const { uid, pontos } = saque;
    if (!uid || !pontos) return;

    const db = getFirestore();
    const userSnap = await db.doc(`usuarios/${uid}`).get();
    if (!userSnap.exists) return;

    const referidoPor = userSnap.data().referidoPor;
    if (!referidoPor) return;

    const comissao = Math.floor(pontos * 0.01);
    if (comissao < 1) return;

    await db.doc(`usuarios/${referidoPor}`).update({
      pontos: FieldValue.increment(comissao),
    });

    console.log(`Comissão: +${comissao} pts → ${referidoPor} (saque de ${uid}: ${pontos} pts)`);
  }
);

// ─── Creditar indicador quando novo usuário aplica um código ─────────────────
// Dispara ao criar referral_events/{uid} (via processarIndicacao no cliente).
// Usa Admin SDK — bypassa regras do Firestore.
exports.onReferralCreated = onDocumentCreated(
  { document: 'referral_events/{uid}', region: 'us-central1', secrets: [solanaPrivateKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { referrerUid } = data;
    const newUserUid = event.params.uid;

    if (!referrerUid || referrerUid === newUserUid) return;

    const db = getFirestore();

    // Verifica se o indicador existe antes de creditar
    const referrerSnap = await db.doc(`usuarios/${referrerUid}`).get();
    if (!referrerSnap.exists) {
      console.warn(`Indicador ${referrerUid} não encontrado. Evento ignorado.`);
      await event.data.ref.delete();
      return;
    }

    await db.doc(`usuarios/${referrerUid}`).update({
      pontos: FieldValue.increment(100),
      referidos: FieldValue.increment(1),
    });

    // Registra prova on-chain na Solana (não-bloqueante — falha silenciosa)
    try {
      const { Connection, PublicKey, Transaction, TransactionInstruction } = require('@solana/web3.js');
      const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const projectKeypair = carregarKeypair(solanaPrivateKey.value());

      // Hashs dos UIDs para preservar privacidade na blockchain pública
      const referrerHash = crypto.createHash('sha256').update(referrerUid).digest('hex').slice(0, 16);
      const referredHash = crypto.createHash('sha256').update(newUserUid).digest('hex').slice(0, 16);

      const memo = JSON.stringify({
        app: 'CNB Mobile',
        event: 'referral',
        referrerHash,
        referredHash,
        timestamp: new Date().toISOString(),
      });

      const transaction = new Transaction();
      transaction.add(new TransactionInstruction({
        keys: [{ pubkey: projectKeypair.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM,
        data: Buffer.from(memo, 'utf8'),
      }));

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = projectKeypair.publicKey;

      const signature = await connection.sendTransaction(transaction, [projectKeypair]);
      await connection.confirmTransaction(signature, 'confirmed');

      // Salva prova no Firestore
      await db.collection('referrals_onchain').add({
        referrerUid,
        newUserUid,
        referrerHash,
        referredHash,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        criadoEm: FieldValue.serverTimestamp(),
      });

      console.log(`[ReferralProof] ${referrerHash} → ${referredHash} | sig: ${signature}`);
    } catch (e) {
      console.warn('[ReferralProof] Falha ao registrar on-chain (não crítico):', e.message);
    }

    // Deleta o evento após processar (coleção é efêmera)
    await event.data.ref.delete();

    console.log(`Indicação: ${newUserUid} indicado por ${referrerUid} (+100 pts)`);
  }
);

// ─── Bônus de milestone: 50k pts por 5 indicações ativas, 100k por 10 ──────
// "Ativa" = indicado com minutos >= 3 (carregou pelo menos 3 minutos).
// Transição detectada por onDocumentUpdated em usuarios/{uid}: minutos < 3 → ≥3.
// Idempotência: contadoComoAtivo no indicado impede recontagem;
// bonus5kGranted/bonus10kGranted no indicador impedem duplo crédito.
exports.onReferreeBecameActive = onDocumentUpdated(
  { document: 'usuarios/{uid}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const minutosBefore = before.minutos ?? 0;
    const minutosAfter = after.minutos ?? 0;
    if (minutosBefore >= 3 || minutosAfter < 3) return;

    const referidoPor = after.referidoPor;
    if (!referidoPor) return;

    if (after.contadoComoAtivo === true) return;

    const refereeUid = event.params.uid;
    const db = getFirestore();
    const refereeRef = db.doc(`usuarios/${refereeUid}`);
    const referrerRef = db.doc(`usuarios/${referidoPor}`);

    try {
      await db.runTransaction(async (t) => {
        const refereeSnap = await t.get(refereeRef);
        if (!refereeSnap.exists) return;
        const refereeData = refereeSnap.data();
        if (refereeData.contadoComoAtivo === true) return;
        if ((refereeData.minutos ?? 0) < 3) return;

        const referrerSnap = await t.get(referrerRef);
        if (!referrerSnap.exists) {
          t.update(refereeRef, { contadoComoAtivo: true });
          return;
        }
        const referrerData = referrerSnap.data();
        const ativasDepois = (referrerData.indicacoesAtivas ?? 0) + 1;

        const update = { indicacoesAtivas: FieldValue.increment(1) };
        let bonus = 0;
        let log = '';
        if (ativasDepois >= 5 && !referrerData.bonus5kGranted) {
          bonus += 50000;
          update.bonus5kGranted = true;
          log += ' +50k (5 ativas)';
        }
        if (ativasDepois >= 10 && !referrerData.bonus10kGranted) {
          bonus += 100000;
          update.bonus10kGranted = true;
          log += ' +100k (10 ativas)';
        }
        if (bonus > 0) update.pontos = FieldValue.increment(bonus);

        t.update(refereeRef, { contadoComoAtivo: true });
        t.update(referrerRef, update);

        console.log(`Ativa: ${refereeUid} → ${referidoPor} (ativas=${ativasDepois})${log}`);
      });
    } catch (err) {
      console.error(`Erro em onReferreeBecameActive ${refereeUid} → ${referidoPor}:`, err);
    }
  }
);

// ─── Atualiza stats/public para o dashboard ───────────────────────────────────
// Roda a cada hora e agrega dados de todas as coleções.
exports.atualizarStatsDashboard = onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1' },
  async () => {
    const db = getFirestore();

    const [
      usersCount,
      saquesCount,
      referralsCount,
      provasCount,
      resgatesSnap,
      usuariosSnap,
    ] = await Promise.all([
      db.collection('usuarios').count().get(),
      db.collection('saques').count().get(),
      db.collection('referrals_onchain').count().get(),
      db.collection('provas_onchain').count().get(),
      db.collection('resgates_cnb').get(),
      db.collection('usuarios').select('minutos', 'pontos').get(),
    ]);

    let totalCNBDistribuidos = 0;
    let totalResgateCNB = resgatesSnap.size;
    resgatesSnap.forEach(d => { totalCNBDistribuidos += d.data().quantidade ?? 0; });

    let totalMinutos = 0;
    let totalPontos = 0;
    usuariosSnap.forEach(d => {
      totalMinutos += d.data().minutos ?? 0;
      totalPontos += d.data().pontos ?? 0;
    });

    await db.collection('stats').doc('public').set({
      totalUsuarios: usersCount.data().count,
      totalCNBDistribuidos,
      totalResgateCNB,
      totalSaquesPIX: saquesCount.data().count,
      totalIndicacoes: referralsCount.data().count,
      diasAtividade: provasCount.data().count,
      totalMinutos,
      totalPontos,
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    console.log('[Stats] Dashboard atualizado.');
  }
);

// ─── Relatório semanal por e-mail ────────────────────────────────────────────
// Toda segunda-feira às 08:00 horário de Brasília, envia um resumo da semana.
exports.relatorioSemanal = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'America/Sao_Paulo',
    secrets: [smtpUser, smtpPass],
    region: 'us-central1',
  },
  async () => {
    const db = getFirestore();

    // Últimos 7 dias de provas on-chain
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const provasSnap = await db.collection('provas_onchain')
      .where('criadoEm', '>=', seteDiasAtras)
      .orderBy('criadoEm', 'asc')
      .get();

    let totalUsuariosAtivos = 0;
    let totalPontos = 0;
    let totalMinutos = 0;
    let diasComAtividade = 0;
    let linhasDias = '';

    provasSnap.forEach(doc => {
      const d = doc.data();
      totalUsuariosAtivos = Math.max(totalUsuariosAtivos, d.activeUsers ?? 0);
      totalPontos += d.totalPoints ?? 0;
      totalMinutos += d.totalMinutes ?? 0;
      diasComAtividade++;
      linhasDias += `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #1a2a1a;">${d.date ?? doc.id}</td>
          <td style="padding:8px;border-bottom:1px solid #1a2a1a;text-align:center;">${(d.activeUsers ?? 0).toLocaleString('pt-BR')}</td>
          <td style="padding:8px;border-bottom:1px solid #1a2a1a;text-align:center;">${(d.totalPoints ?? 0).toLocaleString('pt-BR')}</td>
          <td style="padding:8px;border-bottom:1px solid #1a2a1a;text-align:center;">${(d.totalMinutes ?? 0).toLocaleString('pt-BR')}</td>
          <td style="padding:8px;border-bottom:1px solid #1a2a1a;font-size:11px;">
            <a href="${d.solscanUrl ?? '#'}" style="color:#00FF88;">ver ◎</a>
          </td>
        </tr>`;
    });

    // Total de usuários cadastrados
    const totalUsersSnap = await db.collection('usuarios').count().get();
    const totalUsuarios = totalUsersSnap.data().count ?? 0;

    // Total de saques da semana
    const saquesSnap = await db.collection('saques')
      .where('criadoEm', '>=', seteDiasAtras)
      .get();
    const totalSaques = saquesSnap.size;

    // Resgates CNB da semana
    const resgatesSnap = await db.collection('resgates_cnb')
      .where('criadoEm', '>=', seteDiasAtras)
      .get();
    const totalResgatesCNB = resgatesSnap.size;
    let totalCNBEnviado = 0;
    resgatesSnap.forEach(d => { totalCNBEnviado += d.data().quantidade ?? 0; });

    const semanaStr = `${seteDiasAtras.toLocaleDateString('pt-BR')} – ${new Date().toLocaleDateString('pt-BR')}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#0A0F1E;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#0d1f0d;padding:28px 32px;border-bottom:2px solid #00FF88;">
          <h1 style="margin:0;color:#00FF88;font-size:22px;">⚡ CNB Mobile — Relatório Semanal</h1>
          <p style="margin:6px 0 0;color:#8a9a8a;font-size:14px;">${semanaStr}</p>
        </div>
        <div style="padding:28px 32px;">

          <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;">
            <div style="flex:1;min-width:140px;background:#0d1f0d;border-radius:10px;padding:16px;border:1px solid #00FF88;">
              <div style="font-size:11px;color:#8a9a8a;margin-bottom:4px;">USUÁRIOS TOTAIS</div>
              <div style="font-size:28px;font-weight:bold;color:#00FF88;">${totalUsuarios.toLocaleString('pt-BR')}</div>
            </div>
            <div style="flex:1;min-width:140px;background:#0d0d20;border-radius:10px;padding:16px;border:1px solid #9945FF;">
              <div style="font-size:11px;color:#8a9a8a;margin-bottom:4px;">CNB ENVIADOS</div>
              <div style="font-size:28px;font-weight:bold;color:#9945FF;">◎ ${totalCNBEnviado.toLocaleString('pt-BR')}</div>
            </div>
            <div style="flex:1;min-width:140px;background:#1a1200;border-radius:10px;padding:16px;border:1px solid #FFB800;">
              <div style="font-size:11px;color:#8a9a8a;margin-bottom:4px;">SAQUES PIX</div>
              <div style="font-size:28px;font-weight:bold;color:#FFB800;">${totalSaques}</div>
            </div>
          </div>

          <h3 style="color:#00FF88;margin-bottom:12px;">Atividade diária on-chain</h3>
          ${diasComAtividade > 0 ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#0d1f0d;color:#8a9a8a;">
                <th style="padding:8px;text-align:left;">Data</th>
                <th style="padding:8px;">Usuários</th>
                <th style="padding:8px;">Pontos</th>
                <th style="padding:8px;">Minutos</th>
                <th style="padding:8px;">Prova</th>
              </tr>
            </thead>
            <tbody>${linhasDias}</tbody>
          </table>` : '<p style="color:#8a9a8a;">Nenhuma atividade registrada esta semana.</p>'}

          <p style="margin-top:24px;font-size:12px;color:#555;">
            Relatório automático do CNB Mobile ·
            <a href="https://console.firebase.google.com/project/cnbmobile-2053c" style="color:#00FF88;">Firebase Console</a>
          </p>
        </div>
      </div>`;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser.value(), pass: smtpPass.value() },
    });

    await transporter.sendMail({
      from: `"CNB Mobile" <${smtpUser.value()}>`,
      to: DESTINATARIO,
      subject: `📊 CNB Mobile — Relatório Semanal (${semanaStr})`,
      html,
    });

    console.log(`[RelatorioSemanal] E-mail enviado para ${DESTINATARIO}`);
  }
);

// ─── Helper: carrega keypair do projeto a partir do secret ───────────────────
function carregarKeypair(secretValue) {
  const { Keypair } = require('@solana/web3.js');
  const bs58 = require('bs58');
  const value = secretValue.trim();
  try {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(value)));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(value));
  }
}

// ─── Proof of Activity: registra resumo diário na Solana ─────────────────────
// Roda todo dia às 03:00 horário de Brasília.
// Escreve um Memo na Solana com: data, usuários ativos, pontos e minutos do dia.
// Custo: ~0.000005 SOL por dia (~$0.001). Registro salvo em provas_onchain/{date}.
exports.registrarAtividadeDiaria = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo',
    secrets: [solanaPrivateKey],
    region: 'us-central1',
  },
  async () => {
    const { Connection, PublicKey, Transaction, TransactionInstruction } = require('@solana/web3.js');
    const db = getFirestore();

    // Data de ontem (a função roda às 3h, registra o dia anterior)
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dateStr = ontem.toISOString().split('T')[0]; // ex: "2026-04-20"

    // Evita duplicata
    const provaRef = db.collection('provas_onchain').doc(dateStr);
    const provaSnap = await provaRef.get();
    if (provaSnap.exists) {
      console.log(`[ActivityProof] ${dateStr} já registrado. Pulando.`);
      return;
    }

    // Agrega dados do dia: usuários com ultimoLogin ontem
    const inicioDia = new Date(ontem);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(ontem);
    fimDia.setHours(23, 59, 59, 999);

    const snap = await db.collection('usuarios')
      .where('ultimoLogin', '>=', inicioDia)
      .where('ultimoLogin', '<=', fimDia)
      .get();

    let totalPontos = 0;
    let totalMinutos = 0;
    const uids = [];

    snap.forEach(doc => {
      const d = doc.data();
      totalPontos += d.pontos ?? 0;
      totalMinutos += d.minutos ?? 0;
      uids.push(doc.id);
    });

    const usuariosAtivos = uids.length;
    const payload = {
      app: 'CNB Mobile',
      date: dateStr,
      activeUsers: usuariosAtivos,
      totalPoints: totalPontos,
      totalMinutes: totalMinutos,
    };

    // Hash SHA-256 do payload para integridade
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(payload) + uids.sort().join(','))
      .digest('hex');

    const memo = JSON.stringify({ ...payload, hash });

    // Escreve no Solana Memo Program
    const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const projectKeypair = carregarKeypair(solanaPrivateKey.value());

    const transaction = new Transaction();
    transaction.add(new TransactionInstruction({
      keys: [{ pubkey: projectKeypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM,
      data: Buffer.from(memo, 'utf8'),
    }));

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = projectKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [projectKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    // Salva no Firestore
    await provaRef.set({
      date: dateStr,
      activeUsers: usuariosAtivos,
      totalPoints: totalPontos,
      totalMinutes: totalMinutos,
      hash,
      signature,
      solscanUrl: `https://solscan.io/tx/${signature}`,
      criadoEm: FieldValue.serverTimestamp(),
    });

    console.log(`[ActivityProof] ${dateStr} | ${usuariosAtivos} usuários | sig: ${signature}`);
  }
);

// ─── Proof of Engagement: registra sessão individual na Solana ───────────────
// Chamado pelo app ao fim de cada sessão de carregamento.
// Escreve um Memo com: uidHash (privado), timestamp, duração e pontos da sessão.
exports.registrarProvasSessao = onCall(
  { secrets: [solanaPrivateKey], region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const uid = request.auth.uid;
    const { duracaoMinutos } = request.data;

    if (
      typeof duracaoMinutos !== 'number' ||
      !Number.isInteger(duracaoMinutos) ||
      duracaoMinutos < 1 ||
      duracaoMinutos > 1440
    ) {
      throw new HttpsError('invalid-argument', 'Duração inválida (1–1440 minutos).');
    }

    const { Connection, PublicKey, Transaction, TransactionInstruction } = require('@solana/web3.js');
    const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const db = getFirestore();

    // Hash do UID para preservar privacidade na blockchain pública
    const uidHash = crypto.createHash('sha256').update(uid).digest('hex').slice(0, 16);
    const pontos = duracaoMinutos * 10 + Math.floor(duracaoMinutos / 60) * 50;
    const ts = new Date().toISOString();

    const memo = JSON.stringify({
      app: 'CNB Mobile',
      event: 'session',
      uidHash,
      ts,
      dur: duracaoMinutos,
      pts: pontos,
    });

    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const projectKeypair = carregarKeypair(solanaPrivateKey.value());

      const transaction = new Transaction();
      transaction.add(new TransactionInstruction({
        keys: [{ pubkey: projectKeypair.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM,
        data: Buffer.from(memo, 'utf8'),
      }));

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = projectKeypair.publicKey;

      const signature = await connection.sendTransaction(transaction, [projectKeypair]);
      await connection.confirmTransaction(signature, 'confirmed');

      const provaData = {
        uidHash,
        duracaoMinutos,
        pontos,
        ts,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        criadoEm: FieldValue.serverTimestamp(),
      };

      // Salva na coleção global (anônima via uidHash) + subcoleção do usuário (acessível no app)
      await Promise.all([
        db.collection('provas_sessao').add(provaData),
        db.collection('usuarios').doc(uid).collection('provas').add({
          duracaoMinutos,
          pontos,
          signature,
          solscanUrl: `https://solscan.io/tx/${signature}`,
          criadoEm: FieldValue.serverTimestamp(),
        }),
      ]);

      console.log(`[SessionProof] ${uidHash} | ${duracaoMinutos}min | ${pontos}pts | sig: ${signature}`);

      // Dual-write: espelha pontos/minutos no Anchor program (devnet)
      try {
        const userSnap = await db.collection('usuarios').doc(uid).get();
        const referrerUid = userSnap.exists ? (userSnap.data().referidoPor ?? null) : null;
        const anchorSig = await acumularPontosOnChain(projectKeypair, uid, pontos, duracaoMinutos, referrerUid);
        console.log(`[Anchor] acumular_pontos ok | sig: ${anchorSig}`);
      } catch (anchorErr) {
        console.warn('[Anchor] acumular_pontos falhou (não crítico):', anchorErr.message);
      }

      return { signature };
    } catch (e) {
      console.warn('[SessionProof] Falha ao registrar on-chain (não crítico):', e.message);
      return { error: 'falha' };
    }
  }
);

// ─── Resgatar pontos como CNB Tokens na Solana ───────────────────────────────
// Phase 2: Firestore é source of truth; Anchor devnet recebe mirror do débito.
// 1 ponto = 1 CNB token (6 decimais). Mínimo: 100.000 pontos.
const CNB_MINT = 'Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4';
const MINIMO_RESGATE = 100000;

exports.resgatarCNB = onCall(
  { secrets: [solanaPrivateKey], region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const uid = request.auth.uid;
    const { walletAddress, quantidade } = request.data;

    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new HttpsError('invalid-argument', 'Endereço de carteira inválido.');
    }
    if (!quantidade || typeof quantidade !== 'number' || quantidade < MINIMO_RESGATE) {
      throw new HttpsError('invalid-argument', `Mínimo de ${MINIMO_RESGATE.toLocaleString()} pontos.`);
    }

    const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      createTransferInstruction,
      getAccount,
    } = require('@solana/spl-token');

    let userPublicKey;
    try {
      userPublicKey = new PublicKey(walletAddress);
    } catch {
      throw new HttpsError('invalid-argument', 'Endereço de carteira Solana inválido.');
    }

    const db = getFirestore();
    const usuarioRef = db.collection('usuarios').doc(uid);

    // ── 1. Débito atômico no Firestore (source of truth) ──────────────────────
    await db.runTransaction(async (t) => {
      const snap = await t.get(usuarioRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');
      const pontos = snap.data().pontos ?? 0;
      if (pontos < quantidade) throw new HttpsError('failed-precondition', 'Pontos insuficientes.');
      t.update(usuarioRef, {
        pontos: FieldValue.increment(-quantidade),
        saques: FieldValue.increment(1),
      });
    });

    // ── 2. Mirror: espelha débito no Anchor program (devnet) ──────────────────
    try {
      const projectKeypair = carregarKeypair(solanaPrivateKey.value());
      const anchorResult = await tentarResgatarTokensOnChain(projectKeypair, uid, quantidade);
      if (anchorResult.success) {
        console.log(`[Anchor] resgatar_tokens mirror | sig: ${anchorResult.signature}`);
      } else {
        console.warn(`[Anchor] mirror ignorado — ${anchorResult.reason}`);
      }
    } catch (anchorErr) {
      console.warn('[Anchor] mirror falhou (não crítico):', anchorErr.message);
    }

    // ── 3. Envia CNB tokens na Solana mainnet ──────────────────────────────────
    try {
      const projectKeypair = carregarKeypair(solanaPrivateKey.value());
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const mintPublicKey = new PublicKey(CNB_MINT);

      const projectATA = await getAssociatedTokenAddress(mintPublicKey, projectKeypair.publicKey);
      const userATA = await getAssociatedTokenAddress(mintPublicKey, userPublicKey);

      const transaction = new Transaction();
      try {
        await getAccount(connection, userATA);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            projectKeypair.publicKey, userATA, userPublicKey, mintPublicKey,
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          projectATA, userATA, projectKeypair.publicKey,
          BigInt(quantidade) * BigInt(1_000_000),
        )
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = projectKeypair.publicKey;

      const signature = await connection.sendTransaction(transaction, [projectKeypair]);
      await connection.confirmTransaction(signature, 'confirmed');

      await db.collection('resgates_cnb').add({
        uid,
        walletAddress,
        quantidade,
        signature,
        criadoEm: FieldValue.serverTimestamp(),
        status: 'confirmado',
      });

      console.log(`Resgate CNB: ${uid} → ${walletAddress} | ${quantidade} CNB | sig: ${signature}`);
      return { signature };

    } catch (e) {
      // Estorna pontos se o envio Solana falhar
      await usuarioRef.update({
        pontos: FieldValue.increment(quantidade),
        saques: FieldValue.increment(-1),
      });
      console.error('[resgatarCNB] Erro Solana:', e);
      throw new HttpsError('internal', 'Erro ao enviar tokens. Pontos estornados. Tente novamente.');
    }
  }
);

// ─── Resgate privado de pontos via Cloak (SOL shielded) ──────────────────────
// Fluxo: Firestore debit → Cloak deposit → relay private withdrawal → usuário recebe SOL
// Sem link on-chain entre carteira do projeto e carteira do usuário.
// Taxa de câmbio: 100.000 pontos = 0.01 SOL (depósito mínimo Cloak).
// Fee relay: ~0.005 SOL. Usuário recebe ~0.005 SOL líquido por 100.000 pontos.
const MINIMO_RESGATE_PRIVADO = PONTOS_POR_BLOCO; // 100.000

exports.resgatarPrivado = onCall(
  { secrets: [solanaPrivateKey], region: 'us-central1', invoker: 'public' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const uid = request.auth.uid;
    const { walletAddress, quantidade } = request.data;

    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new HttpsError('invalid-argument', 'Endereço de carteira inválido.');
    }
    if (!quantidade || typeof quantidade !== 'number' || quantidade < MINIMO_RESGATE_PRIVADO) {
      throw new HttpsError('invalid-argument', `Mínimo de ${MINIMO_RESGATE_PRIVADO.toLocaleString()} pontos.`);
    }
    // Deve ser múltiplo do bloco mínimo (100.000)
    if (quantidade % PONTOS_POR_BLOCO !== 0) {
      throw new HttpsError('invalid-argument', `Quantidade deve ser múltiplo de ${PONTOS_POR_BLOCO.toLocaleString()}.`);
    }

    const { PublicKey } = require('@solana/web3.js');
    try { new PublicKey(walletAddress); } catch {
      throw new HttpsError('invalid-argument', 'Endereço Solana inválido.');
    }

    const db = getFirestore();
    const usuarioRef = db.collection('usuarios').doc(uid);

    // ── 1. Débito atômico no Firestore ────────────────────────────────────────
    await db.runTransaction(async (t) => {
      const snap = await t.get(usuarioRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');
      const pontos = snap.data().pontos ?? 0;
      if (pontos < quantidade) throw new HttpsError('failed-precondition', 'Pontos insuficientes.');
      t.update(usuarioRef, {
        pontos: FieldValue.increment(-quantidade),
        saques: FieldValue.increment(1),
      });
    });

    // ── 2. Resgate privado via Cloak ─────────────────────────────────────────
    try {
      const projectKeypair = carregarKeypair(solanaPrivateKey.value());
      const result = await resgatarPontosPrivado(projectKeypair, quantidade, walletAddress);

      await db.collection('resgates_privados').add({
        uid,
        walletAddress: 'PRIVADO', // não salvar endereço real — resgate é privado
        quantidade,
        amountLamports: result.amountLamports,
        netLamports: result.netLamports,
        depositSignature: result.depositSignature,
        transferSignature: result.transferSignature,

        criadoEm: FieldValue.serverTimestamp(),
        status: 'confirmado',
      });

      console.log(`[resgatarPrivado] ${uid} | ${quantidade} pontos | ${result.amountLamports} lamports | sig: ${result.transferSignature}`);
      return {
        signature: result.transferSignature,
        amountLamports: result.amountLamports,
        netLamports: result.netLamports,
      };

    } catch (e) {
      // Estorna pontos se o Cloak falhar
      await usuarioRef.update({
        pontos: FieldValue.increment(quantidade),
        saques: FieldValue.increment(-1),
      });
      console.error('[resgatarPrivado] Erro Cloak:', e);
      throw new HttpsError('internal', 'Erro no resgate privado. Pontos estornados.');
    }
  }
);

// ─── Envio de push notification para todos os usuários ───────────────────────
// Só admins podem chamar. Tokens ficam em /push_tokens/{uid}.
const ADMIN_UIDS = ['X619NYBpp5OqXKTBomuFTISuQGY2'];

exports.enviarNotificacaoGlobal = onCall(
  { region: 'us-central1', invoker: 'public' },
  async (request) => {
    if (!request.auth || !ADMIN_UIDS.includes(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'Não autorizado.');
    }

    const { titulo, corpo } = request.data;
    if (!titulo || !corpo) throw new HttpsError('invalid-argument', 'titulo e corpo são obrigatórios.');

    const db = getFirestore();
    const snap = await db.collection('push_tokens').get();
    const tokens = snap.docs.map(d => d.data().token).filter(Boolean);

    if (tokens.length === 0) return { enviado: 0 };

    // Envia em lotes de 100 (limite da API do Expo)
    const LOTE = 100;
    let total = 0;
    for (let i = 0; i < tokens.length; i += LOTE) {
      const messages = tokens.slice(i, i + LOTE).map(to => ({
        to,
        title: titulo,
        body: corpo,
        sound: 'default',
        channelId: 'default',
      }));
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages),
      });
      total += messages.length;
    }

    console.log(`[Push] Notificação enviada para ${total} dispositivos`);
    return { enviado: total };
  }
);
