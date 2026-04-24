import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Linking, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getOrCreateWallet, getCNBBalance, getSOLBalance } from '../services/walletService';
import { useTheme } from '../context/ThemeContext';

const EXPLORER = (addr) =>
  `https://explorer.solana.com/address/${addr}`;

function shorten(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletScreen({ route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = route.params || {};
  const uid = user?.uid;

  const [wallet, setWallet]      = useState(null);
  const [cnbBalance, setCNB]     = useState(null);
  const [solBalance, setSOL]     = useState(null);
  const [provas, setProvas]      = useState([]);
  const [loading, setLoading]    = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [copied, setCopied]      = useState(false);
  const [error, setError]        = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true);
    setError(false);
    try {
      const { publicKey, isNew } = await getOrCreateWallet(uid);
      setWallet(publicKey);
      if (isNew) Alert.alert('🎉 Carteira criada!', 'Sua carteira Solana foi criada e vinculada à sua conta CNB.');
      const [cnb, sol] = await Promise.all([
        getCNBBalance(publicKey),
        getSOLBalance(publicKey),
      ]);
      setCNB(cnb);
      setSOL(sol);

      try {
        const q = query(
          collection(db, 'usuarios', uid, 'provas'),
          orderBy('criadoEm', 'desc'),
          limit(10),
        );
        const snap = await getDocs(q);
        setProvas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { setProvas([]); }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar a carteira.');
      setError(true);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  async function copiar() {
    await Clipboard.setStringAsync(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function abrirExplorer() {
    Linking.openURL(EXPLORER(wallet));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparando sua carteira...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>😕</Text>
        <Text style={styles.loadingText}>Não foi possível carregar a carteira.</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: colors.background, fontWeight: 'bold' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Minha Carteira CNB</Text>
        <Text style={styles.subtitle}>Carteira Solana gerada no seu dispositivo</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Endereço Solana</Text>
          <Text style={styles.address}>{shorten(wallet)}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={copiar}>
              <Text style={styles.btnText}>{copied ? '✓ Copiado' : 'Copiar endereço'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={abrirExplorer}>
              <Text style={styles.btnSecondaryText}>Ver no Explorer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Saldos</Text>

          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>
                {cnbBalance === null ? '—' : cnbBalance.toLocaleString('pt-BR')}
              </Text>
              <Text style={styles.balanceCoin}>CNB</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>
                {solBalance === null ? '—' : solBalance.toFixed(4)}
              </Text>
              <Text style={styles.balanceCoin}>SOL</Text>
            </View>
          </View>

          {cnbBalance === 0 && (
            <Text style={styles.hint}>
              Seus CNB tokens aparecerão aqui após o primeiro resgate.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Provas de Atividade On-Chain</Text>

          {provas.length === 0 ? (
            <Text style={styles.hint}>
              Suas sessões de carregamento aparecem aqui após serem registradas na Solana.
            </Text>
          ) : (
            provas.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.provaItem}
                onPress={() => Linking.openURL(p.solscanUrl)}
                activeOpacity={0.7}>
                <View style={styles.provaLeft}>
                  <Text style={styles.provaEmoji}>⚡</Text>
                  <View>
                    <Text style={styles.provaTitle}>{p.duracaoMinutos} min · {(p.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
                    <Text style={styles.provaSig}>
                      {p.signature ? `${p.signature.slice(0, 8)}...${p.signature.slice(-6)}` : '—'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.provaExplorer}>↗</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔒 Sua chave, seu controle</Text>
          <Text style={styles.infoText}>
            A chave privada desta carteira é gerada e armazenada com segurança no seu dispositivo.
            Nenhum servidor tem acesso a ela.
          </Text>
          <Text style={styles.infoText}>
            Ao resgatar CNB, os tokens são enviados diretamente para este endereço na rede Solana.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    scroll:    { padding: 20, paddingBottom: 40 },

    title:       { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
    subtitle:    { fontSize: 13, color: colors.secondary, marginBottom: 24 },
    loadingText: { color: colors.secondary, marginTop: 12, fontSize: 14 },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label:   { fontSize: 12, color: colors.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    address: { fontSize: 18, color: colors.white, fontWeight: '600', marginBottom: 16, fontFamily: 'monospace' },

    row: { flexDirection: 'row', gap: 10 },
    btn: {
      flex: 1, backgroundColor: colors.primary,
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    },
    btnText:          { color: colors.background, fontWeight: '600', fontSize: 13 },
    btnSecondary:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
    btnSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

    balanceRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    balanceItem: { flex: 1, alignItems: 'center' },
    balanceValue:{ fontSize: 28, fontWeight: '700', color: colors.white },
    balanceCoin: { fontSize: 12, color: colors.secondary, marginTop: 2 },
    divider:     { width: 1, height: 40, backgroundColor: colors.border },

    hint: { textAlign: 'center', color: colors.secondary, fontSize: 12, marginTop: 16 },

    provaItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    provaLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    provaEmoji:   { fontSize: 20 },
    provaTitle:   { fontSize: 14, fontWeight: '600', color: colors.white },
    provaSig:     { fontSize: 11, color: colors.secondary, marginTop: 2, fontFamily: 'monospace' },
    provaExplorer:{ fontSize: 18, color: colors.primary },

    infoCard:  { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
    infoTitle: { color: colors.white, fontWeight: '600', marginBottom: 10, fontSize: 15 },
    infoText:  { color: colors.secondary, fontSize: 13, lineHeight: 20, marginBottom: 6 },
  });
}
