import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { solicitarSaque } from '../services/pontos';
import { logSaqueSolicitado, logResgateCNB, logResgateCNBSucesso } from '../services/analytics';
import { getWalletAddress } from '../services/walletService';
import bs58 from 'bs58';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, CreditCard, Lock, DollarSign, Clock, Zap, Smartphone, Shield, AlertTriangle, Key } from 'lucide-react-native';

const functions = getFunctions();
const resgatarCNBFn = httpsCallable(functions, 'resgatarCNB');
const resgatarPrivadoFn = httpsCallable(functions, 'resgatarPrivado');

function solanaValido(addr) {
  try {
    const decoded = bs58.decode(addr.trim());
    return decoded.length === 32;
  } catch {
    return false;
  }
}

export default function WithdrawScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { perfil } = route.params || {};
  const [aba, setAba] = useState(route.params?.initialAba ?? 'pix');

  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [pix, setPix] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [loadingPix, setLoadingPix] = useState(false);

  const [wallet, setWallet] = useState('');
  const [walletNativa, setWalletNativa] = useState(null);
  const [quantidadeCNB, setQuantidadeCNB] = useState('');
  const [loadingCNB, setLoadingCNB] = useState(false);

  const [walletPrivado, setWalletPrivado] = useState('');
  const [quantidadePrivado, setQuantidadePrivado] = useState('');
  const [loadingPrivado, setLoadingPrivado] = useState(false);

  const pontosDisponiveis = perfil?.pontos ?? 0;

  useEffect(() => {
    if (!perfil?.uid) return;
    getWalletAddress(perfil.uid).then(addr => {
      if (addr) {
        setWalletNativa(addr);
        setWallet(addr);
      }
    }).catch(() => {});
  }, [perfil?.uid]);

  function formatarPontos(text) {
    const digits = text.replace(/\D/g, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  const qtdPix = parseInt(quantidade.replace(/\D/g, ''), 10) || 0;

  function pixValido(chave) {
    const v = chave.trim();
    if (!v) return false;
    if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
    const digits = v.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 14;
  }

  const podeConfirmarPix = pontosDisponiveis >= 100000 && qtdPix >= 100000 && qtdPix <= pontosDisponiveis && nome.trim() && pixValido(pix);

  async function handleSaquePix() {
    if (!perfil?.uid) return Alert.alert(t('common.error'), t('withdraw.errorProfile'));
    if (!nome.trim()) return Alert.alert(t('common.attention'), t('withdraw.errorMissingName'));
    if (!pixValido(pix)) return Alert.alert(t('common.attention'), t('withdraw.errorInvalidPix'));
    if (qtdPix < 100000) return Alert.alert(t('common.attention'), t('withdraw.errorMin'));
    if (qtdPix > pontosDisponiveis) return Alert.alert(t('common.attention'), t('withdraw.errorInsufficient'));

    Alert.alert(
      t('withdraw.confirmPixTitle'),
      t('withdraw.confirmPixMsg', { nome: nome.trim(), chave: pix.trim(), pontos: qtdPix.toLocaleString('pt-BR') }),
      [
        { text: t('withdraw.cancel'), style: 'cancel' },
        {
          text: t('withdraw.confirm'), onPress: async () => {
            setLoadingPix(true);
            try {
              await solicitarSaque(perfil.uid, nome.trim(), pix.trim(), qtdPix);
              logSaqueSolicitado(qtdPix);
              Alert.alert(t('withdraw.requestedTitle'), t('withdraw.requestedMsg'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
            } catch (e) {
              Alert.alert(t('common.error'), e.message ?? t('withdraw.tryAgain'));
            } finally { setLoadingPix(false); }
          },
        },
      ]
    );
  }

  const BLOCO_PRIVADO = 100000;
  const qtdPrivado = parseInt(quantidadePrivado.replace(/\D/g, ''), 10) || 0;
  const qtdPrivadoArredondado = Math.floor(qtdPrivado / BLOCO_PRIVADO) * BLOCO_PRIVADO;
  const solLiquido = (qtdPrivadoArredondado / BLOCO_PRIVADO) * 0.005;
  const podeConfirmarPrivado =
    pontosDisponiveis >= BLOCO_PRIVADO &&
    qtdPrivadoArredondado >= BLOCO_PRIVADO &&
    qtdPrivadoArredondado <= pontosDisponiveis &&
    solanaValido(walletPrivado);

  async function handleResgatePrivado() {
    if (!perfil?.uid) return Alert.alert(t('common.error'), t('withdraw.errorProfile'));
    if (!solanaValido(walletPrivado)) return Alert.alert(t('common.attention'), t('withdraw.errorInvalidSolana'));
    if (qtdPrivadoArredondado < BLOCO_PRIVADO) return Alert.alert(t('common.attention'), t('withdraw.errorMin'));
    if (qtdPrivadoArredondado > pontosDisponiveis) return Alert.alert(t('common.attention'), t('withdraw.errorInsufficient'));

    Alert.alert(
      t('withdraw.confirmPrivateTitle'),
      t('withdraw.confirmPrivateMsg', {
        wallet: `${walletPrivado.trim().slice(0, 8)}...${walletPrivado.trim().slice(-6)}`,
        pontos: qtdPrivadoArredondado.toLocaleString('pt-BR'),
        sol: solLiquido.toFixed(4),
      }),
      [
        { text: t('withdraw.cancel'), style: 'cancel' },
        {
          text: t('withdraw.confirm'), onPress: async () => {
            setLoadingPrivado(true);
            try {
              const result = await resgatarPrivadoFn({
                walletAddress: walletPrivado.trim(),
                quantidade: qtdPrivadoArredondado,
              });
              const sig = result.data?.signature ?? '';
              Alert.alert(
                t('withdraw.privateSentTitle'),
                t('withdraw.privateSentMsg', { sol: solLiquido.toFixed(4), sig: `${sig.slice(0, 16)}...` }),
                [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert(t('common.error'), e.message ?? t('withdraw.tryAgain'));
            } finally { setLoadingPrivado(false); }
          },
        },
      ]
    );
  }

  const qtdCNB = parseInt(quantidadeCNB.replace(/\D/g, ''), 10) || 0;
  const podeConfirmarCNB = pontosDisponiveis >= 100000 && qtdCNB >= 100000 && qtdCNB <= pontosDisponiveis && solanaValido(wallet);

  async function handleResgateCNB() {
    if (!perfil?.uid) return Alert.alert(t('common.error'), t('withdraw.errorProfile'));
    if (!solanaValido(wallet)) return Alert.alert(t('common.attention'), t('withdraw.errorInvalidSolana'));
    if (qtdCNB < 100000) return Alert.alert(t('common.attention'), t('withdraw.errorMin'));
    if (qtdCNB > pontosDisponiveis) return Alert.alert(t('common.attention'), t('withdraw.errorInsufficient'));

    Alert.alert(
      t('withdraw.confirmCNBTitle'),
      t('withdraw.confirmCNBMsg', {
        wallet: `${wallet.trim().slice(0, 8)}...${wallet.trim().slice(-6)}`,
        tokens: qtdCNB.toLocaleString('pt-BR'),
      }),
      [
        { text: t('withdraw.cancel'), style: 'cancel' },
        {
          text: t('withdraw.confirm'), onPress: async () => {
            setLoadingCNB(true);
            try {
              logResgateCNB(qtdCNB, wallet.trim());
              const result = await resgatarCNBFn({ walletAddress: wallet.trim(), quantidade: qtdCNB });
              const sig = result.data?.signature ?? '';
              logResgateCNBSucesso(qtdCNB, sig);
              Alert.alert(
                t('withdraw.cnbSentTitle'),
                t('withdraw.cnbSentMsg', { tokens: qtdCNB.toLocaleString('pt-BR'), sig: `${sig.slice(0, 16)}...` }),
                [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert(t('common.error'), e.message ?? t('withdraw.tryAgain'));
            } finally { setLoadingCNB(false); }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('common.back')}</Text>
        </TouchableOpacity>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}>
          <Text style={styles.title}>{t('withdraw.redeem')}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t('withdraw.yourAvailable')}</Text>
            <Text style={styles.pontos}>{pontosDisponiveis.toLocaleString('pt-BR')}</Text>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, aba === 'pix' && styles.tabAtiva]}
              onPress={() => setAba('pix')}
              activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CreditCard size={12} color={aba === 'pix' ? colors.white : colors.secondary} />
                <Text style={[styles.tabText, aba === 'pix' && styles.tabTextAtiva]}>PIX</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, aba === 'cnb' && styles.tabAtiva]}
              onPress={() => setAba('cnb')}
              activeOpacity={0.8}>
              <Text style={[styles.tabText, aba === 'cnb' && styles.tabTextAtiva]}>◎ CNB</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, aba === 'privado' && styles.tabAtivaPrivado]}
              onPress={() => setAba('privado')}
              activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Lock size={12} color={aba === 'privado' ? '#c084fc' : colors.secondary} />
                <Text style={[styles.tabText, aba === 'privado' && styles.tabTextPrivado]}>{t('withdraw.private')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {aba === 'pix' && (
            <>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <DollarSign size={13} color={colors.primary} />
                  <Text style={styles.infoLine}>{t('withdraw.minPoints')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Clock size={13} color={colors.primary} />
                  <Text style={styles.infoLine}>{t('withdraw.deadline')}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('withdraw.fullName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('withdraw.fullNamePlaceholder')}
                placeholderTextColor={colors.secondary}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>{t('withdraw.pixKey')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('withdraw.pixPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={pix}
                onChangeText={setPix}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>{t('withdraw.amountPoints')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('withdraw.amountPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={quantidade}
                onChangeText={v => setQuantidade(formatarPontos(v))}
                keyboardType="numeric"
              />
              {qtdPix > 0 && qtdPix < 100000 && <Text style={styles.erro}>{t('withdraw.errorMinShort')}</Text>}
              {qtdPix > pontosDisponiveis && qtdPix > 0 && <Text style={styles.erro}>{t('withdraw.errorInsufficientShort')}</Text>}

              <TouchableOpacity
                style={[styles.btn, !podeConfirmarPix && styles.btnDisabled]}
                onPress={handleSaquePix}
                disabled={loadingPix || !podeConfirmarPix}>
                {loadingPix ? <ActivityIndicator color={colors.background} /> : <Text style={styles.btnText}>{t('withdraw.confirmPixBtn')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {aba === 'cnb' && (
            <>
              <View style={styles.infoCardSolana}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLineSolana}>{t('withdraw.rate')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Key size={13} color="#9945FF" />
                  <Text style={styles.infoLineSolana}>{t('withdraw.minPoints')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Zap size={13} color="#9945FF" />
                  <Text style={styles.infoLineSolana}>{t('withdraw.instantSolana')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Smartphone size={13} color="#9945FF" />
                  <Text style={styles.infoLineSolana}>
                    {walletNativa ? t('withdraw.yourWalletSelected') : t('withdraw.useExternal')}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('withdraw.solanaAddress')}</Text>

              {walletNativa && (
                <TouchableOpacity
                  style={[styles.walletNativaTag, wallet === walletNativa && styles.walletNativaTagAtiva]}
                  onPress={() => setWallet(walletNativa)}
                  activeOpacity={0.8}>
                  <Text style={styles.walletNativaTagIcon}>◎</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.walletNativaTagTitle}>{t('withdraw.myCNBWallet')}</Text>
                    <Text style={styles.walletNativaTagAddr}>{walletNativa.slice(0, 8)}...{walletNativa.slice(-6)}</Text>
                  </View>
                  {wallet === walletNativa && <Text style={styles.walletNativaCheck}>✓</Text>}
                </TouchableOpacity>
              )}

              <TextInput
                style={styles.input}
                placeholder={t('withdraw.addressPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={wallet}
                onChangeText={setWallet}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {wallet.length > 0 && !solanaValido(wallet) && (
                <Text style={styles.erro}>{t('withdraw.invalidSolana')}</Text>
              )}

              <Text style={styles.fieldLabel}>{t('withdraw.amountPoints')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('withdraw.amountPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={quantidadeCNB}
                onChangeText={v => setQuantidadeCNB(formatarPontos(v))}
                keyboardType="numeric"
              />
              {qtdCNB > 0 && (
                <Text style={styles.conversao}>{t('withdraw.equalsCNB', { count: qtdCNB.toLocaleString('pt-BR') })}</Text>
              )}
              {qtdCNB > 0 && qtdCNB < 100000 && <Text style={styles.erro}>{t('withdraw.errorMinShort')}</Text>}
              {qtdCNB > pontosDisponiveis && qtdCNB > 0 && <Text style={styles.erro}>{t('withdraw.errorInsufficientShort')}</Text>}

              <TouchableOpacity
                style={[styles.btnSolana, !podeConfirmarCNB && styles.btnDisabled]}
                onPress={handleResgateCNB}
                disabled={loadingCNB || !podeConfirmarCNB}>
                {loadingCNB
                  ? <ActivityIndicator color="#0A0F1E" />
                  : <Text style={styles.btnSolanaText}>{t('withdraw.redeemCNBBtn')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {aba === 'privado' && (
            <>
              {/* Explicação do saque privado */}
              <View style={{ backgroundColor: 'rgba(192,132,252,0.07)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Lock size={14} color="#c084fc" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#c084fc' }}>{t('withdraw.whatIsPrivate')}</Text>
                </View>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: 12 }}>
                  {t('withdraw.privateDesc1')}
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20 }}>
                  {t('withdraw.privateDesc2')}
                </Text>
              </View>

              <View style={styles.infoCardPrivado}>
                <View style={styles.infoRow}>
                  <Lock size={13} color="#c4b5fd" />
                  <Text style={styles.infoLinePrivado}>{t('withdraw.privateBadge')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLinePrivado}>{t('withdraw.privateRate')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Shield size={13} color="#c4b5fd" />
                  <Text style={styles.infoLinePrivado}>{t('withdraw.privateNoLink')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Zap size={13} color="#c4b5fd" />
                  <Text style={styles.infoLinePrivado}>{t('withdraw.privateZK')}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('withdraw.solanaAddress')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('withdraw.addressPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={walletPrivado}
                onChangeText={setWalletPrivado}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {walletPrivado.length > 0 && !solanaValido(walletPrivado) && (
                <Text style={styles.erro}>{t('withdraw.invalidSolana')}</Text>
              )}

              <Text style={styles.fieldLabel}>{t('withdraw.amountMultiple')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('withdraw.amountPlaceholder')}
                placeholderTextColor={colors.secondary}
                value={quantidadePrivado}
                onChangeText={v => setQuantidadePrivado(formatarPontos(v))}
                keyboardType="numeric"
              />
              {qtdPrivadoArredondado > 0 && (
                <Text style={styles.conversaoPrivado}>
                  {t('withdraw.estimatedSol', { sol: solLiquido.toFixed(4) })}
                </Text>
              )}
              {qtdPrivado > 0 && qtdPrivadoArredondado < BLOCO_PRIVADO && (
                <Text style={styles.erro}>{t('withdraw.errorMinShort')}</Text>
              )}
              {qtdPrivadoArredondado > pontosDisponiveis && qtdPrivadoArredondado > 0 && (
                <Text style={styles.erro}>{t('withdraw.errorInsufficientShort')}</Text>
              )}

              <TouchableOpacity
                style={[styles.btnPrivado, !podeConfirmarPrivado && styles.btnDisabled]}
                onPress={handleResgatePrivado}
                disabled={loadingPrivado || !podeConfirmarPrivado}>
                {loadingPrivado
                  ? <ActivityIndicator color="#ffffff" />
                  : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Lock size={15} color="#fff" />
                      <Text style={styles.btnPrivadoText}>{t('withdraw.redeemPrivateBtn')}</Text>
                    </View>}
              </TouchableOpacity>

              <View style={styles.cloakBadge}>
                <Text style={styles.cloakBadgeText}>Powered by Cloak Protocol · ZK Privacy on Solana</Text>
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16 }}>
            <AlertTriangle size={12} color={colors.secondary} />
            <Text style={[styles.aviso, { marginTop: 0 }]}>{t('withdraw.debitNotice')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, padding: 24 },
    title: { fontSize: 24, fontWeight: 'bold', color: colors.white, marginBottom: 20 },

    card: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16 },
    label: { fontSize: 13, color: colors.secondary },
    pontos: { fontSize: 36, fontWeight: 'bold', color: colors.primary, marginTop: 4 },

    tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabAtiva: { backgroundColor: colors.background },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.secondary },
    tabTextAtiva: { color: colors.white },

    infoCard: { backgroundColor: '#0d1f0d', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.primary, marginBottom: 20 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    infoLine: { fontSize: 14, color: colors.secondary, flex: 1 },

    infoCardSolana: { backgroundColor: '#0d0d20', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#9945FF', marginBottom: 20 },
    infoLineSolana: { fontSize: 14, color: '#b8a0e0', flex: 1 },

    walletNativaTag: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#13102a', borderRadius: 12, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: '#3a2a6a',
    },
    walletNativaTagAtiva: { borderColor: '#9945FF', backgroundColor: '#1a1040' },
    walletNativaTagIcon:  { fontSize: 22, color: '#9945FF' },
    walletNativaTagTitle: { fontSize: 13, fontWeight: '700', color: colors.white },
    walletNativaTagAddr:  { fontSize: 11, color: '#888', marginTop: 2, fontFamily: 'monospace' },
    walletNativaCheck:    { fontSize: 18, color: '#9945FF', fontWeight: '700' },

    fieldLabel: { fontSize: 13, color: colors.secondary, marginBottom: 6, marginLeft: 2 },
    input: { backgroundColor: colors.card, borderRadius: 12, padding: 16, color: colors.white, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    erro: { fontSize: 12, color: '#ff4d4d', marginTop: -10, marginBottom: 12, marginLeft: 4 },
    conversao: { fontSize: 13, color: '#9945FF', marginTop: -10, marginBottom: 12, marginLeft: 4, fontWeight: '600' },

    btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
    btnSolana: { backgroundColor: '#9945FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
    btnSolanaText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },

    aviso: { fontSize: 12, color: colors.secondary, textAlign: 'center', marginTop: 16, lineHeight: 18 },

    tabAtivaPrivado: { backgroundColor: '#1a0a2e' },
    tabTextPrivado: { color: '#c084fc' },
    infoCardPrivado: { backgroundColor: '#0f0a1e', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#7c3aed', marginBottom: 20 },
    infoLinePrivado: { fontSize: 14, color: '#c4b5fd', flex: 1 },
    conversaoPrivado: { fontSize: 13, color: '#a78bfa', marginTop: -10, marginBottom: 12, marginLeft: 4, fontWeight: '600' },
    btnPrivado: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
    btnPrivadoText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
    cloakBadge: { marginTop: 16, alignItems: 'center' },
    cloakBadgeText: { fontSize: 11, color: '#6d28d9', fontWeight: '500' },
  });
}
