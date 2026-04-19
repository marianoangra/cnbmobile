const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

initializeApp();

const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');

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
  { document: 'referral_events/{uid}', region: 'us-central1' },
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

    // Deleta o evento após processar (coleção é efêmera)
    await event.data.ref.delete();

    console.log(`Indicação: ${newUserUid} indicado por ${referrerUid} (+100 pts)`);
  }
);

// ─── Bônus de milestone: 50k pts por 5 indicações ativas, 100k por 10 ──────
// "Ativa" = indicado com minutos >= 1 (carregou pelo menos 1 vez).
// Transição detectada por onDocumentUpdated em usuarios/{uid}: minutos 0 → ≥1.
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
    if (minutosBefore >= 1 || minutosAfter < 1) return;

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
        if ((refereeData.minutos ?? 0) < 1) return;

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
