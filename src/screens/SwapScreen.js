import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowDownUp, Zap } from 'lucide-react-native';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

import { useTheme } from '../context/ThemeContext';
import {
  getCNBBalance, getKeypairBytes, getOrCreateWallet,
} from '../services/walletService';
import {
  sendSponsoredV0, getKoraPubkey,
} from '../services/kora';

const CNB_MINT = 'Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const DECIMALS_CNB = 6;

const JUP_QUOTE = 'https://quote-api.jup.ag/v6/quote';
const JUP_SWAP  = 'https://quote-api.jup.ag/v6/swap';

async function getQuote(amountMicros, slippageBps = 100) {
  const url = `${JUP_QUOTE}?inputMint=${CNB_MINT}&outputMint=${SOL_MINT}&amount=${amountMicros}&slippageBps=${slippageBps}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jupiter quote ${res.status}`);
  return res.json();
}

async function getSwapTx({ quote, userPubkey, koraPubkey }) {
  const res = await fetch(JUP_SWAP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPubkey,
      wrapAndUnwrapSol: true,
      feeAccount: undefined,
      // Faz o Jupiter usar o Kora como feePayer da tx final
      payer: koraPubkey,
    }),
  });
  if (!res.ok) throw new Error(`Jupiter swap ${res.status}`);
  const json = await res.json();
  return json.swapTransaction;
}

export default function SwapScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = route.params || {};
  const uid = user?.uid;

  const [walletAddr, setWalletAddr] = useState(null);
  const [saldo, setSaldo]           = useState(null);
  const [valor, setValor]           = useState('');
  const [quote, setQuote]           = useState(null);
  const [loadingQuote, setLQ]       = useState(false);
  const [enviando, setEnviando]     = useState(false);
  const [signature, setSignature]   = useState(null);
  const [erro, setErro]             = useState('');

  const debounceRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { publicKey } = await getOrCreateWallet(uid);
        setWalletAddr(publicKey);
        setSaldo(await getCNBBalance(publicKey));
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar a carteira.');
      }
    })();
  }, [uid]);

  // Cota a cada mudança de valor (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuote(null);
    setErro('');
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return;

    debounceRef.current = setTimeout(async () => {
      setLQ(true);
      try {
        const micros = Math.floor(v * 10 ** DECIMALS_CNB);
        const q = await getQuote(micros);
        setQuote(q);
      } catch (e) {
        setErro('Sem liquidez ou erro de cotação.');
      } finally {
        setLQ(false);
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [valor]);

  const valorNumero = parseFloat(valor.replace(',', '.')) || 0;
  const podeEnviar = (
    !!quote && valorNumero > 0 && saldo !== null && valorNumero <= saldo && !enviando
  );

  const solOut = quote?.outAmount ? Number(quote.outAmount) / 1e9 : null;
  const priceImpact = quote?.priceImpactPct ? parseFloat(quote.priceImpactPct) * 100 : null;

  async function handleSwap() {
    setErro('');
    setSignature(null);
    if (!quote) return;

    setEnviando(true);
    try {
      const userKpBytes = await getKeypairBytes(uid);
      const userKp      = nacl.sign.keyPair.fromSecretKey(userKpBytes);
      const userPubkey  = bs58.encode(userKp.publicKey);
      const koraPubkey  = getKoraPubkey().toBase58();

      const swapTxB64 = await getSwapTx({ quote, userPubkey, koraPubkey });
      const sig       = await sendSponsoredV0(swapTxB64, userKpBytes);
      setSignature(sig);
      setSaldo(await getCNBBalance(walletAddr));
    } catch (e) {
      setErro(e?.message || 'Falha no swap. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function abrirNoExplorer() {
    if (!signature) return;
    Linking.openURL(`https://explorer.solana.com/tx/${signature}`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        style={styles.backBtn}
      >
        <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Swap CNB → SOL</Text>
        <Text style={styles.subtitle}>
          Convert seus CNB direto em SOL via Jupiter, sem taxa de rede.
        </Text>

        <View style={styles.badge}>
          <Zap size={12} color={colors.primary} fill={colors.primary} />
          <Text style={styles.badgeText}>POWERED BY JUPITER · GASLESS KORA</Text>
        </View>

        {/* Input CNB */}
        <View style={styles.card}>
          <Text style={styles.label}>Você envia</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="0"
              placeholderTextColor={colors.secondary}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
            <View style={styles.tokenChip}>
              <Text style={styles.tokenChipText}>CNB</Text>
            </View>
          </View>
          <View style={styles.saldoRow}>
            <Text style={styles.saldoText}>
              Saldo: {saldo === null ? '—' : `${saldo.toLocaleString('pt-BR')} CNB`}
            </Text>
            <TouchableOpacity onPress={() => saldo && setValor(String(saldo))}>
              <Text style={styles.maxLink}>MÁX</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.arrowWrap}>
          <View style={styles.arrowCircle}>
            <ArrowDownUp size={16} color={colors.primary} />
          </View>
        </View>

        {/* Output SOL */}
        <View style={styles.card}>
          <Text style={styles.label}>Você recebe (estimado)</Text>
          <View style={styles.row}>
            <Text style={styles.outValue}>
              {loadingQuote
                ? '...'
                : solOut !== null
                  ? solOut.toFixed(6)
                  : '0'}
            </Text>
            <View style={styles.tokenChip}>
              <Text style={styles.tokenChipText}>SOL</Text>
            </View>
          </View>
          {quote && (
            <View style={styles.quoteInfo}>
              <Text style={styles.quoteInfoText}>
                Slippage: 1% · Impacto:{' '}
                {priceImpact !== null ? `${priceImpact.toFixed(2)}%` : '—'}
              </Text>
            </View>
          )}
        </View>

        {!!erro && <Text style={styles.erroBox}>{erro}</Text>}
        {!!signature && (
          <TouchableOpacity style={styles.sucessoBox} onPress={abrirNoExplorer}>
            <Text style={styles.sucessoTitulo}>✓ Swap enviado</Text>
            <Text style={styles.sucessoSig}>
              Tx: {signature.slice(0, 8)}...{signature.slice(-6)}
            </Text>
            <Text style={styles.sucessoLink}>Toque para ver no Solana Explorer ↗</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btnEnviar, !podeEnviar && styles.btnEnviarDisabled]}
          onPress={handleSwap}
          disabled={!podeEnviar}
        >
          {enviando
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.btnEnviarText}>Trocar agora</Text>}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Cotação ao vivo via Jupiter. Taxa de rede coberta pelo Kora.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll:    { padding: 20, paddingBottom: 60 },

    backBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
    },
    backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

    title:    { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.secondary, marginBottom: 16 },

    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(198,255,74,0.1)',
      borderWidth: 1, borderColor: 'rgba(198,255,74,0.3)',
      borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
      marginBottom: 16,
    },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.primary },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16, padding: 16, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    label: {
      fontSize: 11, color: colors.secondary, marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: 0.8,
    },

    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      color: colors.white, fontSize: 18, fontWeight: '600',
    },
    outValue: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.white },

    tokenChip: {
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10,
    },
    tokenChipText: { fontSize: 13, fontWeight: '700', color: colors.white },

    saldoRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginTop: 8,
    },
    saldoText: { fontSize: 12, color: colors.secondary },
    maxLink:   { fontSize: 12, color: colors.primary, fontWeight: '700' },

    arrowWrap:   { alignItems: 'center', marginVertical: 4 },
    arrowCircle: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },

    quoteInfo: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    quoteInfoText: { fontSize: 11, color: colors.secondary },

    erroBox: {
      fontSize: 13, color: '#ff4d4d',
      backgroundColor: 'rgba(255,77,77,0.1)',
      borderWidth: 1, borderColor: 'rgba(255,77,77,0.3)',
      borderRadius: 12, padding: 12, marginVertical: 8,
    },

    sucessoBox: {
      backgroundColor: 'rgba(198,255,74,0.08)',
      borderWidth: 1, borderColor: 'rgba(198,255,74,0.3)',
      borderRadius: 12, padding: 14, marginVertical: 8,
    },
    sucessoTitulo: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 4 },
    sucessoSig:    { fontSize: 12, color: colors.white, fontFamily: 'monospace' },
    sucessoLink:   { fontSize: 11, color: colors.secondary, marginTop: 4 },

    btnEnviar: {
      backgroundColor: colors.primary,
      borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12,
    },
    btnEnviarDisabled: { opacity: 0.4 },
    btnEnviarText: { fontSize: 15, fontWeight: '700', color: colors.background },

    footnote: {
      fontSize: 11, color: colors.secondary, textAlign: 'center', marginTop: 16, lineHeight: 16,
    },
  });
}
