import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Animated, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getSaques, excluirConta, getAfiliados } from '../services/pontos';
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

export default function ProfileScreen({ route, navigation, onLogout }) {
  const { perfil, onAtualizar } = route.params || {};
  const [saques, setSaques] = useState([]);
  const [loadingSaques, setLoadingSaques] = useState(true);
  const [afiliados, setAfiliados] = useState({ codigo: '', total: 0 });
  const [perfilLocal, setPerfilLocal] = useState(perfil);

  useEffect(() => { if (perfil) setPerfilLocal(perfil); }, [perfil]);

  const a = useEntrada(0);
  const b = useEntrada(100);
  const c = useEntrada(180);
  const d = useEntrada(260);


  useEffect(() => {
    if (!perfil?.uid) return;
    getSaques(perfil.uid).then(setSaques).finally(() => setLoadingSaques(false));
  }, [perfil?.uid]);

  // Atualiza contador de afiliados sempre que a aba for focada
  useFocusEffect(useCallback(() => {
    if (!perfil?.uid) return;
    getAfiliados(perfil.uid).then(setAfiliados);
  }, [perfil?.uid]));

  function handleEditarPerfil() {
    navigation.navigate('EditProfile', {
      perfil: perfilLocal,
      onSalvar: (updates) => {
        setPerfilLocal(prev => ({ ...prev, ...updates }));
        onAtualizar?.(); // propaga para App.js → HomeScreen recebe avatar atualizado
      },
    });
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
    Alert.alert('Sair', 'Deseja mesmo sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut(auth) },
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + nome + botão editar */}
        <Animated.View style={[styles.avatarSection, a]}>
          <View style={styles.avatarRing}>
            <Avatar uri={perfilLocal?.avatarURL} nome={perfilLocal?.nome} size={84} borderColor={colors.primary} />
          </View>
          <Text style={styles.nome}>{perfilLocal?.nome ?? 'Usuário'}</Text>
          <Text style={styles.email}>{perfilLocal?.email ?? ''}</Text>

          <TouchableOpacity style={styles.editarPerfilBtn} onPress={handleEditarPerfil} activeOpacity={0.85}>
            <Text style={styles.editarPerfilIcon}>✏️</Text>
            <Text style={styles.editarPerfilText}>Editar Perfil</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Pontos */}
        <Animated.View style={[styles.pontosCard, b]}>
          <Text style={styles.pontosLabel}>Pontos totais</Text>
          <Text style={styles.pontos}>{(perfilLocal?.pontos ?? 0).toLocaleString('pt-BR')}</Text>
          {(perfilLocal?.pontos ?? 0) >= 100000 && <Text style={styles.podeSacarBadge}>🎉 Disponível para saque!</Text>}
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.row, b]}>
          <View style={[styles.statCard, styles.half]}>
            <Text style={styles.statIcon}>⏱</Text>
            <Text style={styles.statVal}>{perfilLocal?.minutos ?? 0}</Text>
            <Text style={styles.statLabel}>Min. carregando</Text>
          </View>
          <View style={[styles.statCard, styles.half]}>
            <Text style={styles.statIcon}>💸</Text>
            <Text style={styles.statVal}>{perfilLocal?.saques ?? 0}</Text>
            <Text style={styles.statLabel}>Saques realizados</Text>
          </View>
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
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
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

  pontosCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#1a3a1a' },
  pontosLabel: { fontSize: 13, color: colors.secondary, marginBottom: 4 },
  pontos: { fontSize: 44, fontWeight: 'bold', color: colors.primary },
  podeSacarBadge: { fontSize: 13, color: colors.primary, marginTop: 8, fontWeight: '600' },

  row: { flexDirection: 'row', gap: 12, marginBottom: 14, width: '100%' },
  half: { flex: 1 },
  statCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statVal: { fontSize: 26, fontWeight: 'bold', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.secondary, marginTop: 4, textAlign: 'center' },


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
});
