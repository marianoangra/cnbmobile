import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Linking, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getOrCreateWallet, getCNBBalance, getSOLBalance } from '../services/walletService';
import { colors } from '../theme/colors';

const EXPLORER = (addr) =>
  `https://explorer.solana.com/address/${addr}`;

function shorten(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletScreen({ route }) {
  const { user } = route.params || {};
  const uid = user?.uid;

  const [wallet, setWallet]       = useState(null);
  const [cnbBalance, setCNB]      = useState(null);
  const [solBalance, setSOL]      = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [copied, setCopied]       = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true);
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
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar a carteira.');
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        {/* Header */}
        <Text style={styles.title}>Minha Carteira CNB</Text>
        <Text style={styles.subtitle}>Carteira Solana gerada no seu dispositivo</Text>

        {/* Endereço */}
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

        {/* Saldos */}
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

        {/* Info */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background ?? '#0D0D0D' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background ?? '#0D0D0D' },
  scroll:    { padding: 20, paddingBottom: 40 },

  title:     { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  subtitle:  { fontSize: 13, color: '#888', marginBottom: 24 },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  label:   { fontSize: 12, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  address: { fontSize: 18, color: '#FFF', fontWeight: '600', marginBottom: 16, fontFamily: 'monospace' },

  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, backgroundColor: colors.primary ?? '#9945FF',
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  btnText:          { color: '#FFF', fontWeight: '600', fontSize: 13 },
  btnSecondary:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary ?? '#9945FF' },
  btnSecondaryText: { color: colors.primary ?? '#9945FF', fontWeight: '600', fontSize: 13 },

  balanceRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceValue:{ fontSize: 28, fontWeight: '700', color: '#FFF' },
  balanceCoin: { fontSize: 12, color: '#888', marginTop: 2 },
  divider:     { width: 1, height: 40, backgroundColor: '#333' },

  hint: { textAlign: 'center', color: '#555', fontSize: 12, marginTop: 16 },

  infoCard:  { backgroundColor: '#111', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#222' },
  infoTitle: { color: '#FFF', fontWeight: '600', marginBottom: 10, fontSize: 15 },
  infoText:  { color: '#666', fontSize: 13, lineHeight: 20, marginBottom: 6 },
});
