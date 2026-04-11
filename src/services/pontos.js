import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, query, orderBy, limit, where, getDocs, getCountFromServer,
  serverTimestamp, increment, runTransaction, Timestamp,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

// ─── Helpers ────────────────────────────────────────────────────────────────

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
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
    criadoEm: serverTimestamp(),
  };
  await setDoc(doc(db, 'usuarios', uid), perfil);

  // Registrar código de afiliado para lookup reverso
  await setDoc(doc(db, 'codigos', codigo), { uid });

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

export async function excluirConta(uid, authUser) {
  // Busca o código de afiliado antes de deletar o perfil
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const codigo = snap.exists() ? snap.data().codigoAfiliado : null;

  // Deleta dados do Firestore
  await deleteDoc(doc(db, 'usuarios', uid));

  // Deleta o código de afiliado do lookup reverso
  if (codigo) {
    try { await deleteDoc(doc(db, 'codigos', codigo)); } catch { /* ignora */ }
  }

  // Tenta deletar avatar do Storage
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`));
  } catch { /* sem avatar, tudo bem */ }

  // Deleta conta de autenticação
  await deleteUser(authUser);
}

// ─── Pontos ──────────────────────────────────────────────────────────────────

export async function adicionarPontos(uid, quantidade, minutosCarregando = 0) {
  await updateDoc(doc(db, 'usuarios', uid), {
    pontos: increment(quantidade),
    ...(minutosCarregando > 0 ? { minutos: increment(minutosCarregando) } : {}),
  });
}

export async function registrarLoginDiario(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return false;
  const { ultimoLogin } = snap.data();
  if (mesmaData(ultimoLogin)) return false; // Já recebeu hoje
  await updateDoc(doc(db, 'usuarios', uid), {
    pontos: increment(10),
    ultimoLogin: serverTimestamp(),
  });
  return true; // Novo dia, pontos concedidos
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

export async function solicitarSaque(uid, nome, chavePix) {
  const CUSTO = 100000;
  const usuarioRef = doc(db, 'usuarios', uid);
  await runTransaction(db, async (t) => {
    const snap = await t.get(usuarioRef);
    if (!snap.exists() || snap.data().pontos < CUSTO) throw new Error('Pontos insuficientes.');
    t.update(usuarioRef, { pontos: increment(-CUSTO), saques: increment(1) });
    t.set(doc(collection(db, 'saques')), {
      uid, nome, chavePix, pontos: CUSTO, status: 'pendente', criadoEm: serverTimestamp(),
    });
  });
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export async function getRanking() {
  const q = query(collection(db, 'usuarios'), orderBy('pontos', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ uid: d.id, posicao: i + 1, ...d.data() }));
}

export async function getPosicaoRanking(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return null;
  const pontos = snap.data().pontos ?? 0;
  // Conta quantos usuários têm mais pontos que o atual
  const q = query(collection(db, 'usuarios'), where('pontos', '>', pontos));
  const contagem = await getCountFromServer(q);
  return { posicao: contagem.data().count + 1, pontos };
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
  if (!snap.exists()) return { codigo: '', total: 0 };
  let { codigoAfiliado = '', referidos = 0 } = snap.data();

  // Gera código retroativamente para usuários antigos
  if (!codigoAfiliado) {
    codigoAfiliado = await garantirCodigoAfiliado(uid);
  }

  return { codigo: codigoAfiliado, total: referidos };
}

export async function processarIndicacao(novoUid, codigo) {
  // Busca quem tem esse código
  const codeSnap = await getDoc(doc(db, 'codigos', codigo));
  if (!codeSnap.exists()) throw new Error('Código inválido.');
  const { uid: referrerUid } = codeSnap.data();
  if (referrerUid === novoUid) throw new Error('Você não pode usar seu próprio código.');

  // Marca o novo usuário como referido
  await updateDoc(doc(db, 'usuarios', novoUid), { referidoPor: referrerUid });

  // Premia o indicador: +100 pontos + incrementa contador
  await updateDoc(doc(db, 'usuarios', referrerUid), {
    pontos: increment(100),
    referidos: increment(1),
  });
}
