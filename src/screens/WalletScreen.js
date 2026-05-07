import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Linking, ScrollView, RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getOrCreateWallet, getCNBBalance, getSOLBalance,
  getMnemonic, restoreWalletFromMnemonic, validarMnemonic,
} from '../services/walletService';
import { useTheme } from '../context/ThemeContext';
import { Zap, Lock, AlertCircle, Eye, EyeOff, RefreshCw, ArrowLeft, Send, ArrowDownUp } from 'lucide-react-native';

const EXPLORER = (addr) =>
  `https://explorer.solana.com/address/${addr}`;

function shorten(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = route.params || {};
  const uid = user?.uid;

  const [wallet, setWallet]           = useState(null);
  const [cnbBalance, setCNB]          = useState(null);
  const [solBalance, setSOL]          = useState(null);
  const [provas, setProvas]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefresh]      = useState(false);
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState(false);

  // ── Mnemonic — exibição (nova carteira) ──
  const [mnemonicParaExibir, setMnemonicParaExibir] = useState(null);
  const [mnemonicVisivel, setMnemonicVisivel]        = useState(false);
  const [mnemonicCopiado, setMnemonicCopiado]        = useState(false);

  // ── Mnemonic — restauração ──
  const [modalRestaurar, setModalRestaurar]         = useState(false);
  const [mnemonicInput, setMnemonicInput]           = useState('');
  const [loadingRestore, setLoadingRestore]         = useState(false);
  const [restoreErro, setRestoreErro]               = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true);
    setError(false);
    try {
      const { publicKey, isNew, mnemonic } = await getOrCreateWallet(uid);
      setWallet(publicKey);
      if (isNew && mnemonic) setMnemonicParaExibir(mnemonic);
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
      Alert.alert(t('common.error'), t('wallet.errorWallet'));
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

  async function copiarMnemonic() {
    if (!mnemonicParaExibir) return;
    await Clipboard.setStringAsync(mnemonicParaExibir);
    setMnemonicCopiado(true);
    setTimeout(() => setMnemonicCopiado(false), 2000);
  }

  async function verMnemonicSalvo() {
    const m = await getMnemonic(uid);
    if (!m) {
      Alert.alert(t('wallet.noSeedTitle'), t('wallet.noSeedMsg'));
      return;
    }
    setMnemonicParaExibir(m);
  }

  async function handleRestaurar() {
    setRestoreErro('');
    const palavras = mnemonicInput.trim().toLowerCase().split(/\s+/);
    if (palavras.length !== 12) {
      setRestoreErro(t('wallet.errorSeedLength'));
      return;
    }
    if (!validarMnemonic(mnemonicInput)) {
      setRestoreErro(t('wallet.errorSeedInvalid'));
      return;
    }
    setLoadingRestore(true);
    try {
      const { publicKey } = await restoreWalletFromMnemonic(uid, mnemonicInput);
      setWallet(publicKey);
      setModalRestaurar(false);
      setMnemonicInput('');
      Alert.alert(t('wallet.restoredTitle'), t('wallet.restoredMsg'));
      load(true);
    } catch (e) {
      setRestoreErro(e.message ?? t('wallet.restoreError'));
    } finally {
      setLoadingRestore(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>{t('wallet.preparing')}</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <AlertCircle size={32} color={colors.secondary} style={{ marginBottom: 12 }} />
        <Text style={styles.loadingText}>{t('wallet.loadError')}</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: colors.background, fontWeight: 'bold' }}>{t('wallet.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const palavrasMnemonic = mnemonicParaExibir?.split(' ') ?? [];

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Modal: exibição do mnemonic (nova carteira ou ver novamente) ── */}
      <Modal visible={!!mnemonicParaExibir} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>{t('wallet.seedTitle')}</Text>
            <Text style={styles.modalSubtitulo}>{t('wallet.seedDesc')}</Text>

            {mnemonicVisivel ? (
              <View style={styles.mnemonicGrid}>
                {palavrasMnemonic.map((p, i) => (
                  <View key={i} style={styles.mnemonicItem}>
                    <Text style={styles.mnemonicNum}>{i + 1}</Text>
                    <Text style={styles.mnemonicWord}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.mnemonicBlur}>
                <Text style={styles.mnemonicBlurText}>{t('wallet.tapReveal')}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setMnemonicVisivel(v => !v)}
              >
                {mnemonicVisivel
                  ? <EyeOff size={14} color={colors.primary} />
                  : <Eye size={14} color={colors.primary} />}
                <Text style={styles.modalBtnSecondaryText}>
                  {mnemonicVisivel ? t('wallet.hide') : t('wallet.reveal')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalBtnSecondary} onPress={copiarMnemonic}>
                <Text style={styles.modalBtnSecondaryText}>
                  {mnemonicCopiado ? t('wallet.copyDone') : t('wallet.copyBtn')}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={() => { setMnemonicParaExibir(null); setMnemonicVisivel(false); }}
            >
              <Text style={styles.modalBtnPrimaryText}>{t('wallet.gotItContinue')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: restaurar carteira com mnemonic ── */}
      <Modal visible={modalRestaurar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>{t('wallet.restoreTitle')}</Text>
            <Text style={styles.modalSubtitulo}>{t('wallet.restoreDesc')}</Text>
            <TextInput
              style={[styles.mnemonicInput, restoreErro ? styles.mnemonicInputErro : null]}
              placeholder={t('wallet.restorePlaceholder')}
              placeholderTextColor={colors.secondary}
              value={mnemonicInput}
              onChangeText={v => { setMnemonicInput(v); setRestoreErro(''); }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!restoreErro && <Text style={styles.erroText}>{restoreErro}</Text>}

            <TouchableOpacity
              style={[styles.modalBtnPrimary, loadingRestore && { opacity: 0.6 }]}
              onPress={handleRestaurar}
              disabled={loadingRestore}
            >
              {loadingRestore
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.modalBtnPrimaryText}>{t('wallet.restoreBtn')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnSecondary, { justifyContent: 'center', marginTop: 8 }]}
              onPress={() => { setModalRestaurar(false); setMnemonicInput(''); setRestoreErro(''); }}
            >
              <Text style={styles.modalBtnSecondaryText}>{t('wallet.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
        }}
      >
        <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('wallet.back')}</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>{t('wallet.title')}</Text>
        <Text style={styles.subtitle}>{t('wallet.subtitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('wallet.address')}</Text>
          <Text style={styles.address}>{shorten(wallet)}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={copiar}>
              <Text style={styles.btnText}>{copied ? t('wallet.copied') : t('wallet.copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={abrirExplorer}>
              <Text style={styles.btnSecondaryText}>{t('wallet.viewExplorer')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('wallet.balances')}</Text>

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
            <Text style={styles.hint}>{t('wallet.emptyHint')}</Text>
          )}

          {cnbBalance > 0 && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('TransferCNB', { user })}
              >
                <Send size={14} color={colors.background} />
                <Text style={styles.actionBtnText}>{t('wallet.send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => navigation.navigate('Swap', { user })}
              >
                <ArrowDownUp size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>{t('wallet.swap')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('wallet.proofsTitle')}</Text>

          {provas.length === 0 ? (
            <Text style={styles.hint}>{t('wallet.proofsHint')}</Text>
          ) : (
            provas.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.provaItem}
                onPress={() => Linking.openURL(p.solscanUrl)}
                activeOpacity={0.7}>
                <View style={styles.provaLeft}>
                  <Zap size={20} color={colors.primary} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Lock size={14} color={colors.white} />
            <Text style={[styles.infoTitle, { marginBottom: 0 }]}>{t('wallet.keyControl')}</Text>
          </View>
          <Text style={styles.infoText}>{t('wallet.keyDesc')}</Text>
          <Text style={styles.infoText}>{t('wallet.redeemDesc')}</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.btn, { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }]}
              onPress={verMnemonicSalvo}
            >
              <Eye size={14} color={colors.background} />
              <Text style={[styles.btnText, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{t('wallet.viewSeed')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSecondary, { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }]}
              onPress={() => setModalRestaurar(true)}
            >
              <RefreshCw size={14} color={colors.primary} />
              <Text style={styles.btnSecondaryText}>{t('wallet.restore')}</Text>
            </TouchableOpacity>
          </View>
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

    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 10, paddingVertical: 11,
    },
    actionBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
    actionBtnSecondary: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary,
    },
    actionBtnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

    provaItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    provaLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    provaTitle:   { fontSize: 14, fontWeight: '600', color: colors.white },
    provaSig:     { fontSize: 11, color: colors.secondary, marginTop: 2, fontFamily: 'monospace' },
    provaExplorer:{ fontSize: 18, color: colors.primary },

    infoCard:  { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
    infoTitle: { color: colors.white, fontWeight: '600', marginBottom: 10, fontSize: 15 },
    infoText:  { color: colors.secondary, fontSize: 13, lineHeight: 20, marginBottom: 6 },

    // ── Modais ──
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'flex-end',
    },
    modalBox: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
    },
    modalTitulo:    { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 8 },
    modalSubtitulo: { fontSize: 13, color: colors.secondary, lineHeight: 20, marginBottom: 20 },

    mnemonicGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
    },
    mnemonicItem: {
      width: '30%', flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.background,
      borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
    },
    mnemonicNum:  { fontSize: 10, color: colors.secondary, minWidth: 14 },
    mnemonicWord: { fontSize: 13, fontWeight: '600', color: colors.white },

    mnemonicBlur: {
      height: 120, borderRadius: 12, marginBottom: 20,
      backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    mnemonicBlurText: { fontSize: 14, color: colors.secondary },

    modalActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    modalBtnSecondary: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      borderWidth: 1, borderColor: colors.primary, borderRadius: 10,
      paddingVertical: 10, paddingHorizontal: 14,
    },
    modalBtnSecondaryText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    modalBtnPrimary: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
    },
    modalBtnPrimaryText: { color: colors.background, fontWeight: '700', fontSize: 15 },

    mnemonicInput: {
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 14,
      color: colors.white, fontSize: 14,
      lineHeight: 22, minHeight: 100,
      marginBottom: 8, textAlignVertical: 'top',
    },
    mnemonicInputErro: { borderColor: '#ff4d4d' },
    erroText: { fontSize: 12, color: '#ff4d4d', marginBottom: 12 },
  });
}
