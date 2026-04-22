import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { solicitarSaque } from '../services/pontos';
import { logSaqueSolicitado, logResgateCNB, logResgateCNBSucesso } from '../services/analytics';
import { colors } from '../theme/colors';

const functions = getFunctions();
const resgatarCNBFn = httpsCallable(functions, 'resgatarCNB');

// Validação básica de endereço Solana (base58, 32-44 chars)
function solanaValido(addr) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

export default function WithdrawScreen({ route, navigation }) {
  const { perfil } = route.params || {};
  const [aba, setAba] = useState('pix'); // 'pix' | 'cnb'

  // PIX
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [pix, setPix] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [loadingPix, setLoadingPix] = useState(false);

  // CNB
  const [wallet, setWallet] = useState('');
  const [quantidadeCNB, setQuantidadeCNB] = useState('');
  const [loadingCNB, setLoadingCNB] = useState(false);

  const pontosDisponiveis = perfil?.pontos ?? 0;

  function formatarPontos(text) {
    const digits = text.replace(/\D/g, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // ── PIX ───────────────────────────────────────────────────────────────────
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
    if (!perfil?.uid) return Alert.alert('Erro', 'Dados do perfil não carregados.');
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe seu nome completo.');
    if (!pixValido(pix)) return Alert.alert('Atenção', 'Informe uma chave PIX válida (CPF, e-mail, telefone ou chave aleatória).');
    if (qtdPix < 100000) return Alert.alert('Atenção', 'Mínimo de 100.000 pontos.');
    if (qtdPix > pontosDisponiveis) return Alert.alert('Atenção', 'Pontos insuficientes.');

    Alert.alert(
      'Confirmar Saque PIX',
      `Nome: ${nome.trim()}\nChave PIX: ${pix.trim()}\nPontos: ${qtdPix.toLocaleString('pt-BR')}\n\nPagamento em até 72h.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            setLoadingPix(true);
            try {
              await solicitarSaque(perfil.uid, nome.trim(), pix.trim(), qtdPix);
              logSaqueSolicitado(qtdPix);
              Alert.alert('Saque solicitado!', 'Processaremos em até 72 horas.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } catch (e) {
              Alert.alert('Erro', e.message ?? 'Tente novamente.');
            } finally { setLoadingPix(false); }
          },
        },
      ]
    );
  }

  // ── CNB Token ─────────────────────────────────────────────────────────────
  const qtdCNB = parseInt(quantidadeCNB.replace(/\D/g, ''), 10) || 0;
  const podeConfirmarCNB = pontosDisponiveis >= 100000 && qtdCNB >= 100000 && qtdCNB <= pontosDisponiveis && solanaValido(wallet);

  async function handleResgateCNB() {
    if (!perfil?.uid) return Alert.alert('Erro', 'Dados do perfil não carregados.');
    if (!solanaValido(wallet)) return Alert.alert('Atenção', 'Informe um endereço de carteira Solana válido.');
    if (qtdCNB < 100000) return Alert.alert('Atenção', 'Mínimo de 100.000 pontos.');
    if (qtdCNB > pontosDisponiveis) return Alert.alert('Atenção', 'Pontos insuficientes.');

    Alert.alert(
      'Confirmar Resgate CNB',
      `Carteira: ${wallet.trim().slice(0, 8)}...${wallet.trim().slice(-6)}\nTokens CNB: ${qtdCNB.toLocaleString('pt-BR')}\n\nOs tokens serão enviados diretamente na Solana.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            setLoadingCNB(true);
            logResgateCNB(qtdCNB, wallet.trim());
            try {
              const result = await resgatarCNBFn({ walletAddress: wallet.trim(), quantidade: qtdCNB });
              const sig = result.data?.signature ?? '';
              logResgateCNBSucesso(qtdCNB, sig);
              Alert.alert(
                '✅ CNB enviado!',
                `${qtdCNB.toLocaleString('pt-BR')} CNB tokens enviados para sua carteira Solana.\n\nSignature: ${sig.slice(0, 16)}...`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert('Erro', e.message ?? 'Tente novamente.');
            } finally { setLoadingCNB(false); }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}>
          <Text style={styles.title}>Resgatar</Text>

          {/* Saldo */}
          <View style={styles.card}>
            <Text style={styles.label}>Seus pontos disponíveis</Text>
            <Text style={styles.pontos}>{pontosDisponiveis.toLocaleString('pt-BR')}</Text>
          </View>

          {/* Abas */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, aba === 'pix' && styles.tabAtiva]}
              onPress={() => setAba('pix')}
              activeOpacity={0.8}>
              <Text style={[styles.tabText, aba === 'pix' && styles.tabTextAtiva]}>💳 PIX</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, aba === 'cnb' && styles.tabAtiva]}
              onPress={() => setAba('cnb')}
              activeOpacity={0.8}>
              <Text style={[styles.tabText, aba === 'cnb' && styles.tabTextAtiva]}>◎ CNB Token</Text>
            </TouchableOpacity>
          </View>

          {/* ── Aba PIX ── */}
          {aba === 'pix' && (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoLine}>💰 Mínimo: 100.000 pontos</Text>
                <Text style={styles.infoLine}>📧 Pagamento: contato@criptonobolso.com.br</Text>
                <Text style={styles.infoLine}>⏱ Prazo: até 72 horas</Text>
              </View>

              <Text style={styles.fieldLabel}>Nome completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Seu nome completo"
                placeholderTextColor={colors.secondary}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Chave PIX</Text>
              <TextInput
                style={styles.input}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                placeholderTextColor={colors.secondary}
                value={pix}
                onChangeText={setPix}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Quantidade de pontos</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 100.000"
                placeholderTextColor={colors.secondary}
                value={quantidade}
                onChangeText={v => setQuantidade(formatarPontos(v))}
                keyboardType="numeric"
              />
              {qtdPix > 0 && qtdPix < 100000 && <Text style={styles.erro}>Mínimo de 100.000 pontos.</Text>}
              {qtdPix > pontosDisponiveis && qtdPix > 0 && <Text style={styles.erro}>Você não tem pontos suficientes.</Text>}

              <TouchableOpacity
                style={[styles.btn, !podeConfirmarPix && styles.btnDisabled]}
                onPress={handleSaquePix}
                disabled={loadingPix || !podeConfirmarPix}>
                {loadingPix ? <ActivityIndicator color={colors.background} /> : <Text style={styles.btnText}>Confirmar Saque PIX</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── Aba CNB Token ── */}
          {aba === 'cnb' && (
            <>
              <View style={styles.infoCardSolana}>
                <Text style={styles.infoLineSolana}>◎ 1 ponto = 1 CNB Token</Text>
                <Text style={styles.infoLineSolana}>🔑 Mínimo: 100.000 pontos</Text>
                <Text style={styles.infoLineSolana}>⚡ Envio imediato na Solana</Text>
                <Text style={styles.infoLineSolana}>📱 Use Phantom ou Solflare</Text>
              </View>

              <Text style={styles.fieldLabel}>Endereço da carteira Solana</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 8Zrt5KwcFzmH..."
                placeholderTextColor={colors.secondary}
                value={wallet}
                onChangeText={setWallet}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {wallet.length > 0 && !solanaValido(wallet) && (
                <Text style={styles.erro}>Endereço Solana inválido.</Text>
              )}

              <Text style={styles.fieldLabel}>Quantidade de pontos</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 100.000"
                placeholderTextColor={colors.secondary}
                value={quantidadeCNB}
                onChangeText={v => setQuantidadeCNB(formatarPontos(v))}
                keyboardType="numeric"
              />
              {qtdCNB > 0 && (
                <Text style={styles.conversao}>= {qtdCNB.toLocaleString('pt-BR')} CNB Tokens</Text>
              )}
              {qtdCNB > 0 && qtdCNB < 100000 && <Text style={styles.erro}>Mínimo de 100.000 pontos.</Text>}
              {qtdCNB > pontosDisponiveis && qtdCNB > 0 && <Text style={styles.erro}>Você não tem pontos suficientes.</Text>}

              <TouchableOpacity
                style={[styles.btnSolana, !podeConfirmarCNB && styles.btnDisabled]}
                onPress={handleResgateCNB}
                disabled={loadingCNB || !podeConfirmarCNB}>
                {loadingCNB
                  ? <ActivityIndicator color="#0A0F1E" />
                  : <Text style={styles.btnSolanaText}>Resgatar CNB Tokens ◎</Text>}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.aviso}>⚠️ Os pontos serão debitados da sua conta ao confirmar.</Text>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  infoLine: { fontSize: 14, color: colors.secondary, marginBottom: 6 },

  infoCardSolana: { backgroundColor: '#0d0d20', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#9945FF', marginBottom: 20 },
  infoLineSolana: { fontSize: 14, color: '#b8a0e0', marginBottom: 6 },

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
});
