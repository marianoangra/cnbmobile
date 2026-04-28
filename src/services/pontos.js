import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit, where, getDocs, getCountFromServer,
  serverTimestamp, increment, runTransaction, writeBatch,
} from 'firebase/firestore';
import { logBonusHora } from './analytics';
import { deleteUser } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, auth } from './firebase';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Helpers ────────────────────────────────────────────────────────────────

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function mesmaData(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const hoje = new Date();
  return d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
}

// ─── Perfil ─────────────────────────────────────────────────────────────────

export async function getPerfil(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function criarPerfil(uid, nome, email, codigoIndicacao = null) {
  const codigo = gerarCodigo();
  const perfil = {
    nome,
    email,
    pontos: 0,
    minutos: 0,
    saques: 0,
    avatarURL: null,
    codigoAfiliado: codigo,
    referidoPor: null,
    referidos: 0,
    ultimoLogin: null,
    modo: null, // novo usuário escolhe na tela ModoEscolha; null = ainda não escolheu
    criadoEm: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'usuarios', uid), perfil);
  batch.set(doc(db, 'codigos', codigo), { uid });
  await batch.commit();

  // Processar indicação se houver
  let indicacaoOk = false;
  if (codigoIndicacao) {
    indicacaoOk = await processarIndicacao(uid, codigoIndicacao).then(() => true).catch(() => false);
  }

  return { uid, ...perfil, _indicacaoOk: indicacaoOk };
}

export async function atualizarNome(uid, nome) {
  await updateDoc(doc(db, 'usuarios', uid), { nome });
}

export async function atualizarAvatarURL(uid, url) {
  await updateDoc(doc(db, 'usuarios', uid), { avatarURL: url });
}

// Upload de avatar via expo-file-system (nativo) + Firebase Storage REST API.
// Evita o Firebase JS SDK Storage que tem incompatibilidades com React Native.
// Auth token vem do Firebase JS SDK Auth — mesma sessão do app.
const STORAGE_BUCKET = 'cnbmobile-2053c.firebasestorage.app';

export async function uploadAvatar(uid, uri) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');

  // Garante file:// — FileSystem.uploadAsync requer file:// no Android
  let fileUri = uri;
  if (!uri.startsWith('file://')) {
    fileUri = `${FileSystem.cacheDirectory}cnb_avatar_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: fileUri });
  }

  // Valida tamanho
  try {
    const info = await FileSystem.getInfoAsync(fileUri, { size: true });
    if (info.size && info.size > 5 * 1024 * 1024) {
      throw new Error('Imagem muito grande. Use uma imagem de até 5MB.');
    }
  } catch (e) {
    if (e.message.includes('5MB')) throw e;
  }

  // Token de autenticação do Firebase JS SDK Auth
  const token = await auth.currentUser.getIdToken();

  const filePath = `avatars/${uid}.jpg`;
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o` +
    `?name=${encodeURIComponent(filePath)}&uploadType=media`;

  const resultado = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
  });

  if (resultado.status < 200 || resultado.status >= 300) {
    throw new Error(`Upload falhou: HTTP ${resultado.status} — ${resultado.body}`);
  }

  const dados = JSON.parse(resultado.body);
  let downloadToken = dados.downloadTokens?.split(',')[0];

  // Se o upload não retornou token, busca via GET
  if (!downloadToken) {
    const metaRes = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(filePath)}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const meta = await metaRes.json();
    downloadToken = meta.downloadTokens?.split(',')[0];
  }

  if (!downloadToken) throw new Error('Não foi possível obter o link da foto. Tente novamente.');

  // Define Cache-Control público de 1 ano para que o iOS/Android cacheiem a imagem em disco
  await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(filePath)}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cacheControl: 'public, max-age=31536000' }),
    }
  ).catch(() => {}); // falha silenciosa — não impede o upload de concluir

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/` +
    `${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

  await atualizarAvatarURL(uid, url);
  return url;
}

export async function excluirConta(uid, authUser) {
  // Busca o código de afiliado e avatarURL antes de deletar o perfil
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const codigo = snap.exists() ? snap.data().codigoAfiliado : null;
  const avatarURL = snap.exists() ? snap.data().avatarURL : null;

  // Deleta dados do Firestore
  await deleteDoc(doc(db, 'usuarios', uid));

  // Deleta o código de afiliado do lookup reverso
  if (codigo) {
    try { await deleteDoc(doc(db, 'codigos', codigo)); } catch { /* ignora */ }
  }

  // Tenta deletar avatar do Storage (extrai o path real da URL para suportar nomes com timestamp)
  if (avatarURL) {
    try {
      const pathMatch = avatarURL.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        const storagePath = decodeURIComponent(pathMatch[1]);
        await deleteObject(ref(storage, storagePath));
      }
    } catch { /* sem avatar, tudo bem */ }
  }

  // Deleta conta de autenticação Firebase
  if (authUser) await deleteUser(authUser);
}

// ─── Pontos ──────────────────────────────────────────────────────────────────

export function calcularPontosTotal(minutos) {
  return minutos * 10 + Math.floor(minutos / 60) * 50;
}

/**
 * Persiste a escolha do usuário entre 'lite' e 'tech'.
 * Default visual quando ausente é 'tech' (decidido no consumidor).
 */
export async function atualizarModo(uid, modo) {
  if (modo !== 'lite' && modo !== 'tech') throw new Error('modo inválido');
  await updateDoc(doc(db, 'usuarios', uid), { modo });
}

export async function adicionarPontos(uid, quantidade, minutosCarregando = 0) {
  await updateDoc(doc(db, 'usuarios', uid), {
    pontos: increment(quantidade),
    ...(minutosCarregando > 0 ? { minutos: increment(minutosCarregando) } : {}),
  });
}

/**
 * Adiciona 1 minuto de carregamento e calcula o bônus de hora automaticamente.
 * Usa transação para checar se o total de minutos cruzou um múltiplo de 60,
 * garantindo que sessões fragmentadas (30 min + 30 min) acumulem para o bônus.
 * Retorna true se o bônus de hora foi concedido neste minuto.
 */
export async function adicionarMinutoComBonus(uid, incluirHorarios = true) {
  let bonusConcedido = false;
  let minutosAoCompletar = 0;
  await runTransaction(db, async (t) => {
    const ref = doc(db, 'usuarios', uid);
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const minutosAtual = snap.data().minutos ?? 0;
    const novoMinutos = minutosAtual + 1;
    const bonus = Math.floor(novoMinutos / 60) > Math.floor(minutosAtual / 60) ? 50 : 0;
    bonusConcedido = bonus > 0;
    minutosAoCompletar = novoMinutos;
    const update = {
      pontos: increment(10 + bonus),
      minutos: increment(1),
    };
    if (incluirHorarios) {
      const d = new Date();
      const diaKey = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      update[`atividadeDias.${diaKey}`] = increment(10 + bonus);
    }
    t.update(ref, update);
  });
  if (bonusConcedido) logBonusHora(minutosAoCompletar);
  return bonusConcedido;
}

/**
 * Converte o mapa atividadeDias (armazenado no perfil do usuário) em
 * alturas percentuais (0–100) para os últimos `dias` dias, do mais
 * antigo ao mais recente. Dias sem atividade retornam 0.
 */
export function calcularAtividadeDiaria(atividadeDias = {}, dias = 10) {
  const hoje = new Date();
  const pontosPorDia = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    pontosPorDia.push(atividadeDias?.[key] ?? 0);
  }
  const maxPts = Math.max(...pontosPorDia, 1);
  return pontosPorDia.map(p => (p > 0 ? Math.max(Math.round((p / maxPts) * 100), 8) : 0));
}

export async function registrarLoginDiario(uid) {
  let concedido = false;
  await runTransaction(db, async (t) => {
    const snap = await t.get(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    if (mesmaData(snap.data().ultimoLogin)) return;
    t.update(doc(db, 'usuarios', uid), {
      pontos: increment(10),
      ultimoLogin: serverTimestamp(),
    });
    concedido = true;
  });
  return concedido;
}

// ─── Saques ──────────────────────────────────────────────────────────────────

export async function getSaques(uid) {
  const q = query(
    collection(db, 'saques'),
    where('uid', '==', uid),
    orderBy('criadoEm', 'desc'),
    limit(20),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function solicitarSaque(uid, nome, chavePix, quantidade) {
  const MINIMO = 100000;
  if (quantidade < MINIMO) throw new Error('Mínimo de 100.000 pontos.');
  const usuarioRef = doc(db, 'usuarios', uid);
  await runTransaction(db, async (t) => {
    const snap = await t.get(usuarioRef);
    if (!snap.exists() || snap.data().pontos < quantidade) throw new Error('Pontos insuficientes.');
    t.update(usuarioRef, { pontos: increment(-quantidade), saques: increment(1) });
    t.set(doc(collection(db, 'saques')), {
      uid, nome, chavePix, pontos: quantidade, status: 'pendente', criadoEm: serverTimestamp(),
    });
  });
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export async function getRanking(limiteDocs = 100) {
  const q = query(collection(db, 'usuarios'), orderBy('pontos', 'desc'), limit(limiteDocs));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ uid: d.id, posicao: i + 1, ...d.data() }));
}

export async function getRankingIndicacoes(limiteDocs = 100) {
  const q = query(collection(db, 'usuarios'), orderBy('referidos', 'desc'), limit(limiteDocs));
  const snap = await getDocs(q);
  return snap.docs
    .map((d, i) => ({ uid: d.id, posicao: i + 1, ...d.data() }))
    .filter(u => (u.referidos ?? 0) > 0);
}

export async function getPosicaoRanking(uid, pontosConhecidos) {
  let pontos = pontosConhecidos;
  if (pontos === undefined) {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    pontos = snap.data().pontos ?? 0;
  }
  const [acima, total] = await Promise.all([
    getCountFromServer(query(collection(db, 'usuarios'), where('pontos', '>', pontos))),
    getCountFromServer(collection(db, 'usuarios')),
  ]);
  return { posicao: acima.data().count + 1, pontos, total: total.data().count };
}

// ─── Afiliados ───────────────────────────────────────────────────────────────

async function garantirCodigoAfiliado(uid) {
  const codigo = gerarCodigo();
  await updateDoc(doc(db, 'usuarios', uid), { codigoAfiliado: codigo });
  await setDoc(doc(db, 'codigos', codigo), { uid });
  return codigo;
}

export async function getAfiliados(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return { codigo: '', total: 0, ativas: 0, bonus5k: false, bonus10k: false };
  let {
    codigoAfiliado = '',
    referidos = 0,
    indicacoesAtivas = 0,
    bonus5kGranted = false,
    bonus10kGranted = false,
  } = snap.data();

  // Gera código retroativamente para usuários antigos
  if (!codigoAfiliado) {
    codigoAfiliado = await garantirCodigoAfiliado(uid);
  }

  return { codigo: codigoAfiliado, total: referidos, ativas: indicacoesAtivas, bonus5k: bonus5kGranted, bonus10k: bonus10kGranted };
}

export async function processarIndicacao(novoUid, codigo) {
  await runTransaction(db, async (t) => {
    // Garante que o usuário ainda não foi indicado
    const userSnap = await t.get(doc(db, 'usuarios', novoUid));
    if (userSnap.exists() && userSnap.data().referidoPor) throw new Error('Você já usou um código de indicação.');

    // Valida o código na coleção de lookup
    const codeSnap = await t.get(doc(db, 'codigos', codigo));
    if (!codeSnap.exists()) throw new Error('Código inválido.');
    const { uid: referrerUid } = codeSnap.data();
    if (referrerUid === novoUid) throw new Error('Você não pode usar seu próprio código.');

    // Registra quem indicou o novo usuário
    t.update(doc(db, 'usuarios', novoUid), { referidoPor: referrerUid });

    // Cria evento para a Cloud Function onReferralCreated creditar o indicador.
    // O credito (+100 pts, +1 referido) é feito via Admin SDK — sem regra uid!=uid necessária.
    t.set(doc(db, 'referral_events', novoUid), {
      referrerUid,
      criadoEm: serverTimestamp(),
    });
  });
}
