import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Animated, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { limparSessao } from '../services/session';
import { getSaques, excluirConta, getAfiliados, processarIndicacao } from '../services/pontos';
import { colors } from '../theme/colors';
import Avatar from '../components/Avatar';

const statusColor = { pendente: '#F5A623', aprovado: colors.primary, rejeitado: colors.danger };
const statusLabel = { pendente: '⏳ Pendente', aprovado: '✅ Aprovado', rejeitado: '❌ Rejeitado' };

function useEntrada(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 450, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

export default function ProfileScreen({ route, navigation }) {
  const { user, perfil, onAtualizar, atualizarPerfil } = route.params || {};
  const [saques, setSaques] = useState([]);
  const [loadingSaques, setLoadingSaques] = useState(true);
  const [afiliados, setAfiliados] = useState({ codigo: '', total: 0 });
  const [perfilLocal, setPerfilLocal] = useState(perfil);
  const [codigoParaAplicar, setCodigoParaAplicar] = useState('');
  const [aplicandoCodigo, setAplicandoCodigo] = useState(false);
  const afiliadosCacheRef = useRef({ data: null, ts: 0 });
  const CACHE_TTL = 5 * 60 * 1000;
  useEffect(() => { if (perfil) setPerfilLocal(perfil); }, [perfil]);

  const a = useEntrada(0);
  const b = useEntrada(100);
  const c = useEntrada(180);
  const d = useEntrada(260);


  useEffect(() => {
    if (!perfil?.uid) return;
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    Promise.race([getSaques(perfil.uid), timeout])
      .then(setSaques)
      .catch(() => setSaques([]))
      .finally(() => setLoadingSaques(false));
  }, [perfil?.uid]);

  // Sempre que a aba for focada: refaz fetch do perfil e dos afiliados (com cache de 5 min)
  useFocusEffect(useCallback(() => {
    if (!perfil?.uid) return;
    let active = true;
    onAtualizar?.();
    const now = Date.now();
    if (afiliadosCacheRef.current.data && (now - afiliadosCacheRef.current.ts) < CACHE_TTL) {
      setAfiliados(afiliadosCacheRef.current.data);
      return;
    }
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    Promise.race([getAfiliados(perfil.uid), timeout])
      .then(data => {
        if (active) {
          afiliadosCacheRef.current = { data, ts: Date.now() };
          setAfiliados(data);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [perfil?.uid]));

  function handleAbrirCarteira() {
    navigation.navigate('Wallet', { user: perfilLocal });
  }

  function handleEditarPerfil() {
    navigation.navigate('EditProfile', {
      perfil: perfilLocal,
      onSalvar: (updates) => {
        // Atualiza App.js diretamente (sem refetch Firestore) — evita race condition
        // A HomeScreen e demais telas recebem o perfil atualizado via prop
        atualizarPerfil?.(updates);
        // Atualiza estado local imediatamente (antes do re-render via prop)
        setPerfilLocal(prev => ({ ...prev, ...updates }));
      },
    });
  }

  async function handleAplicarCodigo() {
    const codigo = codigoParaAplicar.trim().toUpperCase();
    if (!codigo) return Alert.alert('Atenção', 'Digite um código de indicação.');
    setAplicandoCodigo(true);
    try {
      await processarIndicacao(perfil.uid, codigo);
      setCodigoParaAplicar('');
      afiliadosCacheRef.current = { data: null, ts: 0 }; // invalida cache
      Alert.alert('✅ Código aplicado!', 'Você foi indicado com sucesso. O indicador recebeu +100 pts.');
    } catch (e) {
      Alert.alert('Erro', e.message ?? 'Código inválido ou já utilizado.');
    } finally {
      setAplicandoCodigo(false);
    }
  }

  async function handleCompartilharCodigo() {
    if (!afiliados.codigo) return;
    const linkAndroid =
      `https://play.google.com/store/apps/details?id=com.cnb.cnbappv2&referrer=${afiliados.codigo}`;
    try {
      await Share.share({
        message:
          `⚡ Transforme o carregamento do seu celular em dinheiro real!\n\n` +
          `Baixe o CNB Mobile gratuitamente:\n${linkAndroid}\n\n` +
          `O código de indicação já vem preenchido automaticamente ao instalar pelo link! 🎁\n\n` +
          `Acumule pontos e saque via PIX. É grátis!`,
      });
    } catch { }
  }

  async function handleCopiarCodigo() {
    await Clipboard.setStringAsync(afiliados.codigo);
    Alert.alert('✅ Copiado!', 'Código copiado para a área de transferência.');
  }

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja mesmo sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { limparSessao(); signOut(auth); } },
    ]);
  }

  async function handleExcluirConta() {
    Alert.alert('⚠️ Excluir conta', 'Todos os seus dados e pontos serão apagados permanentemente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: () => {
          Alert.alert('Confirmar exclusão', 'Tem certeza? Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sim, excluir tudo', style: 'destructive', onPress: async () => {
                try {
                  await excluirConta(perfil.uid, auth.currentUser);
                } catch (e) {
                  if (e.code === 'auth/requires-recent-login') {
                    Alert.alert('Necessário re-login', 'Faça logout e login novamente para excluir a conta.');
                  } else {
                    Alert.alert('Erro', 'Não foi possível excluir a conta.');
                  }
                }
              },
            },
          ]);
        },
      },
    ]);
  }

  function formatarData(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR');
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loginGate}>
          <View style={styles.loginGateAvatar}>
            <Text style={styles.loginGateIcon}>👤</Text>
          </View>
          <Text style={styles.loginGateTitle}>Faça login para ver seu perfil</Text>
          <Text style={styles.loginGateSub}>Acesse sua conta para ver pontos, saques e programa de indicação.</Text>
          <TouchableOpacity
            style={styles.loginGateBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.loginGateBtnText}>Entrar / Cadastrar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + nome + botão editar */}
        <Animated.View style={[styles.avatarSection, a]}>
          <View style={styles.avatarTouchable}>
            <View style={styles.avatarRing}>
              <Avatar uri={perfilLocal?.avatarURL} nome={perfilLocal?.nome} size={84} borderColor={colors.primary} />
            </View>
          </View>
          <Text style={styles.nome}>{perfilLocal?.nome ?? 'Usuário'}</Text>
          <Text style={styles.email}>{perfilLocal?.email ?? ''}</Text>

          <TouchableOpacity style={styles.editarPerfilBtn} onPress={handleEditarPerfil} activeOpacity={0.85}>
            <Text style={styles.editarPerfilIcon}>✏️</Text>
            <Text style={styles.editarPerfilText}>Editar Perfil</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Carteira Solana */}
        <Animated.View style={[styles.pontosCard, b]}>
          <TouchableOpacity style={styles.walletBtn} onPress={handleAbrirCarteira} activeOpacity={0.85}>
            <Text style={styles.walletBtnIcon}>◎</Text>
            <View style={styles.walletBtnTexts}>
              <Text style={styles.walletBtnTitle}>Minha Carteira Solana</Text>
              <Text style={styles.walletBtnSub}>Ver saldo CNB e endereço</Text>
            </View>
            <Text style={styles.walletBtnArrow}>›</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Pontos */}
        <Animated.View style={[styles.pontosCard, b]}>
          <Text style={styles.pontosLabel}>Pontos totais</Text>
          <Text style={styles.pontos}>{(perfilLocal?.pontos ?? 0).toLocaleString('pt-BR')}</Text>
          {(perfilLocal?.pontos ?? 0) >= 100000 && <Text style={styles.podeSacarBadge}>🎉 Disponível para saque!</Text>}
        </Animated.View>

        {/* Afiliados */}
        <Animated.View style={[styles.afiliadoCard, c]}>
          <View style={styles.afiliadoHeader}>
            <Text style={styles.afiliadoTitle}>👥 Programa de Indicação</Text>
            <View style={styles.afiliadoBadge}>
              <Text style={styles.afiliadoBadgeText}>{afiliados.total} indicados</Text>
            </View>
          </View>
          <Text style={styles.afiliadoSub}>
            Indique amigos e ganhe <Text style={styles.destaque}>+100 pts</Text> por cada cadastro!
          </Text>

          <View style={styles.codigoRow}>
            <View style={styles.codigoBox}>
              <Text style={styles.codigoLabel}>Seu código</Text>
              <Text style={styles.codigoCodigo}>{afiliados.codigo || '...'}</Text>
            </View>
            <TouchableOpacity style={styles.copiarBtn} onPress={handleCopiarCodigo} activeOpacity={0.8}>
              <Text style={styles.copiarBtnText}>📋 Copiar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.compartilharBtn} onPress={handleCompartilharCodigo} activeOpacity={0.85}>
            <Text style={styles.compartilharBtnText}>🚀 Compartilhar código</Text>
          </TouchableOpacity>

          {/* Aplicar código de indicação — só aparece para quem ainda não foi indicado */}
          {!perfilLocal?.referidoPor && (
            <View style={styles.aplicarBox}>
              <Text style={styles.aplicarLabel}>🎁 Tem um código de referência?</Text>
              <View style={styles.aplicarRow}>
                <TextInput
                  style={styles.aplicarInput}
                  placeholder="Digite o código aqui"
                  placeholderTextColor={colors.secondary}
                  value={codigoParaAplicar}
                  onChangeText={v => setCodigoParaAplicar(v.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={[styles.aplicarBtn, aplicandoCodigo && { opacity: 0.5 }]}
                  onPress={handleAplicarCodigo}
                  disabled={aplicandoCodigo}
                  activeOpacity={0.85}>
                  {aplicandoCodigo
                    ? <ActivityIndicator color={colors.background} size="small" />
                    : <Text style={styles.aplicarBtnText}>Aplicar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Histórico saques */}
        <Animated.View style={[{ width: '100%' }, d]}>
          <Text style={styles.sectionTitle}>Histórico de Saques</Text>

          {loadingSaques ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : saques.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Nenhum saque realizado ainda</Text>
            </View>
          ) : (
            saques.map(s => (
              <View key={s.id} style={styles.saqueItem}>
                <View style={styles.saqueInfo}>
                  <Text style={styles.saqueData}>{formatarData(s.criadoEm)}</Text>
                  <Text style={styles.saquePix} numberOfLines={1}>{s.chavePix}</Text>
                </View>
                <View style={styles.saqueRight}>
                  <Text style={styles.saquePts}>-{(s.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
                  <Text style={[styles.saqueStatus, { color: statusColor[s.status] ?? colors.secondary }]}>
                    {statusLabel[s.status] ?? s.status}
                  </Text>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutBtnText}>Sair da conta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.excluirBtn} onPress={handleExcluirConta} activeOpacity={0.8}>
            <Text style={styles.excluirBtnText}>🗑 Excluir minha conta</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center', paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 24, width: '100%' },
  avatarTouchable: { alignItems: 'center', marginBottom: 12 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.primary,
    borderRadius: 16, width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  avatarCameraIcon: { fontSize: 13 },
  nome: { fontSize: 22, fontWeight: 'bold', color: colors.white, marginBottom: 4 },
  email: { fontSize: 13, color: colors.secondary, marginBottom: 14 },

  editarPerfilBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  editarPerfilIcon: { fontSize: 14 },
  editarPerfilText: { fontSize: 13, color: colors.white, fontWeight: '600' },

  walletBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, width: '100%',
    borderWidth: 1, borderColor: '#1a2a3a',
  },
  walletBtnIcon:  { fontSize: 28, color: '#9945FF' },
  walletBtnTexts: { flex: 1 },
  walletBtnTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  walletBtnSub:   { fontSize: 12, color: colors.secondary, marginTop: 2 },
  walletBtnArrow: { fontSize: 22, color: colors.secondary },

  pontosCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#1a3a1a' },
  pontosLabel: { fontSize: 13, color: colors.secondary, marginBottom: 4 },
  pontos: { fontSize: 44, fontWeight: 'bold', color: colors.primary },
  podeSacarBadge: { fontSize: 13, color: colors.primary, marginTop: 8, fontWeight: '600' },

  afiliadoCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#1a3a1a' },
  afiliadoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  afiliadoTitle: { fontSize: 15, fontWeight: 'bold', color: colors.white },
  afiliadoBadge: { backgroundColor: '#0d2a0d', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.primary },
  afiliadoBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  afiliadoSub: { fontSize: 13, color: colors.secondary, marginBottom: 14, lineHeight: 18 },
  destaque: { color: colors.primary, fontWeight: 'bold' },
  codigoRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
  codigoBox: { flex: 1, backgroundColor: '#0a1a0a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.primary },
  codigoLabel: { fontSize: 10, color: colors.secondary, marginBottom: 2 },
  codigoCodigo: { fontSize: 22, fontWeight: 'bold', color: colors.primary, letterSpacing: 3 },
  copiarBtn: { backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  copiarBtnText: { fontSize: 13, color: colors.white },
  compartilharBtn: { backgroundColor: '#0d2a0d', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.primary },
  compartilharBtnText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },

  aplicarBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#1a2a1a', paddingTop: 14 },
  aplicarLabel: { fontSize: 13, color: colors.secondary, marginBottom: 8, fontWeight: '600' },
  aplicarRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  aplicarInput: { flex: 1, backgroundColor: '#0a1a0a', borderRadius: 10, padding: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.border, letterSpacing: 2 },
  aplicarBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  aplicarBtnText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },

  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: colors.white, marginBottom: 12, alignSelf: 'flex-start' },
  emptyCard: { backgroundColor: colors.card, borderRadius: 14, padding: 24, width: '100%', alignItems: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyText: { color: colors.secondary, fontSize: 14 },
  saqueItem: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, width: '100%', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  saqueInfo: { flex: 1, marginRight: 12 },
  saqueData: { fontSize: 12, color: colors.secondary },
  saquePix: { fontSize: 14, color: colors.white, marginTop: 2 },
  saqueRight: { alignItems: 'flex-end' },
  saquePts: { fontSize: 14, fontWeight: 'bold', color: colors.danger },
  saqueStatus: { fontSize: 12, marginTop: 4 },

  logoutBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 14, padding: 16, alignItems: 'center', width: '100%', marginTop: 8, marginBottom: 8 },
  logoutBtnText: { color: colors.danger, fontWeight: 'bold', fontSize: 15 },
  excluirBtn: { padding: 12, alignItems: 'center', width: '100%' },
  excluirBtnText: { color: colors.secondary, fontSize: 13 },

  // Login gate
  loginGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loginGateAvatar: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  loginGateIcon: { fontSize: 44 },
  loginGateTitle: { fontSize: 20, fontWeight: 'bold', color: colors.white, textAlign: 'center', marginBottom: 10 },
  loginGateSub: { fontSize: 14, color: colors.secondary, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  loginGateBtn: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 16, width: '100%', alignItems: 'center',
  },
  loginGateBtnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
});
