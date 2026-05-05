import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Shield, Zap } from 'lucide-react-native';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

import { useTheme } from '../context/ThemeContext';
import {
  getCNBBalance, getKeypairBytes, getOrCreateWallet,
} from '../services/walletService';
import {
  sendSponsored, getConnection, getKoraPubkey,
} from '../services/kora';

const CNB_MINT = new PublicKey('Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4');
const DECIMALS = 6;

function isValidSolanaAddress(addr) {
  try {
    const pk = new PublicKey(addr.trim());
    // PublicKey aceita 32 bytes mas não valida que está na curva — checagem extra
    return pk.toBase58() === addr.trim();
  } catch {
    return false;
  }
}

function shorten(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

export default function TransferCNBScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = route.params || {};
  const uid = user?.uid;

  const [walletAddr, setWalletAddr] = useState(null);
  const [saldo, setSaldo]           = useState(null);
  const [destino, setDestino]       = useState('');
  const [valor, setValor]           = useState('');
  const [privacidade, setPriv]      = useState(false);
  const [enviando, setEnviando]     = useState(false);
  const [signature, setSignature]   = useState(null);
  const [erro, setErro]             = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { publicKey } = await getOrCreateWallet(uid);
        setWalletAddr(publicKey);
        setSaldo(await getCNBBalance(publicKey));
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível carregar a carteira.');
      }
    })();
  }, [uid]);

  const valorNumero = parseFloat(valor.replace(',', '.')) || 0;
  const podeEnviar = (
    !!destino && isValidSolanaAddress(destino) &&
    valorNumero > 0 && saldo !== null && valorNumero <= saldo &&
    !enviando
  );

  async function handleEnviar() {
    setErro('');
    setSignature(null);
    if (!isValidSolanaAddress(destino)) {
      setErro('Endereço Solana inválido.');
      return;
    }
    if (valorNumero <= 0 || valorNumero > saldo) {
      setErro('Quantidade inválida.');
      return;
    }

    setEnviando(true);
    try {
      const userKpBytes = await getKeypairBytes(uid);
      const userKp      = nacl.sign.keyPair.fromSecretKey(userKpBytes);
      const userPk      = new PublicKey(bs58.encode(userKp.publicKey));
      const destPk      = new PublicKey(destino.trim());
      const koraPk      = getKoraPubkey();
      const conn        = getConnection();
      const amountRaw   = BigInt(Math.round(valorNumero * 10 ** DECIMALS));

      const sig = privacidade
        ? await enviarComHop({ conn, koraPk, userKp, userPk, destPk, amountRaw, userKpBytes })
        : await enviarDireto({ conn, koraPk, userPk, destPk, amountRaw, userKpBytes });

      setSignature(sig);
      // Atualiza saldo
      setSaldo(await getCNBBalance(walletAddr));
    } catch (e) {
      setErro(e?.message || 'Falha ao enviar. Tente novamente.');
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
        <Text style={styles.title}>Enviar CNB</Text>
        <Text style={styles.subtitle}>
          Transferência gasless via Kora — não precisa de SOL na sua carteira.
        </Text>

        {/* Badge gasless */}
        <View style={styles.badge}>
          <Zap size={12} color={colors.primary} fill={colors.primary} />
          <Text style={styles.badgeText}>SPONSORED BY KORA</Text>
        </View>

        {/* Saldo */}
        <View style={styles.card}>
          <Text style={styles.label}>Saldo disponível</Text>
          <Text style={styles.balance}>
            {saldo === null ? '—' : `${saldo.toLocaleString('pt-BR')} CNB`}
          </Text>
          {!!walletAddr && (
            <Text style={styles.fromAddr}>De: {shorten(walletAddr)}</Text>
          )}
        </View>

        {/* Destino */}
        <View style={styles.card}>
          <Text style={styles.label}>Endereço de destino</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 7xKXt...vFs3"
            placeholderTextColor={colors.secondary}
            value={destino}
            onChangeText={setDestino}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!destino && !isValidSolanaAddress(destino) && (
            <Text style={styles.erroInline}>Endereço inválido.</Text>
          )}
        </View>

        {/* Valor */}
        <View style={styles.card}>
          <Text style={styles.label}>Quantidade</Text>
          <View style={styles.valorRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="0"
              placeholderTextColor={colors.secondary}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              onPress={() => saldo && setValor(String(saldo))}
              style={styles.maxBtn}
            >
              <Text style={styles.maxBtnText}>MÁX</Text>
            </TouchableOpacity>
          </View>
          {valorNumero > 0 && saldo !== null && valorNumero > saldo && (
            <Text style={styles.erroInline}>Saldo insuficiente.</Text>
          )}
        </View>

        {/* Privacidade */}
        <View style={styles.card}>
          <View style={styles.privRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Shield size={14} color={colors.primary} />
                <Text style={styles.privTitulo}>Privacidade básica</Text>
              </View>
              <Text style={styles.privDesc}>
                Envia através de uma carteira intermediária descartável (2 hops).
                Esconde o link direto entre você e o destino, mas não é privacidade ZK total.
              </Text>
            </View>
            <Switch
              value={privacidade}
              onValueChange={setPriv}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Erro / sucesso */}
        {!!erro && <Text style={styles.erroBox}>{erro}</Text>}
        {!!signature && (
          <TouchableOpacity style={styles.sucessoBox} onPress={abrirNoExplorer}>
            <Text style={styles.sucessoTitulo}>✓ Transferência enviada</Text>
            <Text style={styles.sucessoSig}>
              Tx: {signature.slice(0, 8)}...{signature.slice(-6)}
            </Text>
            <Text style={styles.sucessoLink}>Toque para ver no Solana Explorer ↗</Text>
          </TouchableOpacity>
        )}

        {/* Botão enviar */}
        <TouchableOpacity
          style={[styles.btnEnviar, !podeEnviar && styles.btnEnviarDisabled]}
          onPress={handleEnviar}
          disabled={!podeEnviar}
        >
          {enviando
            ? <ActivityIndicator color={colors.background} />
            : (
              <>
                <Send size={16} color={colors.background} />
                <Text style={styles.btnEnviarText}>
                  {privacidade ? 'Enviar com privacidade' : 'Enviar CNB'}
                </Text>
              </>
            )}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          A taxa de rede (~$0.0001) é coberta pelo JUICE Mobile via paymaster Kora.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Fluxos de transferência ────────────────────────────────────────────────

async function enviarDireto({ conn, koraPk, userPk, destPk, amountRaw, userKpBytes }) {
  const fromATA = await getAssociatedTokenAddress(CNB_MINT, userPk);
  const toATA   = await getAssociatedTokenAddress(CNB_MINT, destPk);

  const instructions = [];

  // Cria ATA do destino se não existir — Kora paga
  let toExists = false;
  try { await getAccount(conn, toATA); toExists = true; } catch {}
  if (!toExists) {
    instructions.push(createAssociatedTokenAccountInstruction(
      koraPk,    // payer = Kora
      toATA,     // ata
      destPk,    // owner
      CNB_MINT,  // mint
    ));
  }

  instructions.push(createTransferInstruction(
    fromATA, toATA, userPk, amountRaw,
  ));

  return sendSponsored(instructions, userKpBytes);
}

async function enviarComHop({ conn, koraPk, userKp, userPk, destPk, amountRaw, userKpBytes }) {
  // Gera carteira efêmera local
  const tempKp = Keypair.generate();
  const tempPk = tempKp.publicKey;

  // Hop 1: user → temp
  const userATA = await getAssociatedTokenAddress(CNB_MINT, userPk);
  const tempATA = await getAssociatedTokenAddress(CNB_MINT, tempPk);

  const ix1 = [];
  let tempExists = false;
  try { await getAccount(conn, tempATA); tempExists = true; } catch {}
  if (!tempExists) {
    ix1.push(createAssociatedTokenAccountInstruction(
      koraPk, tempATA, tempPk, CNB_MINT,
    ));
  }
  ix1.push(createTransferInstruction(userATA, tempATA, userPk, amountRaw));
  await sendSponsored(ix1, userKpBytes);

  // Pequeno delay para garantir confirmação antes do hop 2
  await new Promise(r => setTimeout(r, 1500));

  // Hop 2: temp → destino — agora o signer é a tempKp
  const destATA = await getAssociatedTokenAddress(CNB_MINT, destPk);
  const ix2 = [];
  let destExists = false;
  try { await getAccount(conn, destATA); destExists = true; } catch {}
  if (!destExists) {
    ix2.push(createAssociatedTokenAccountInstruction(
      koraPk, destATA, destPk, CNB_MINT,
    ));
  }
  ix2.push(createTransferInstruction(tempATA, destATA, tempPk, amountRaw));

  // Reutiliza sendSponsored mas o signer principal é a tempKp
  return sendSponsored(ix2, tempKp.secretKey);
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
      borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    label: {
      fontSize: 11, color: colors.secondary, marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: 0.8,
    },
    balance:  { fontSize: 26, fontWeight: '700', color: colors.white },
    fromAddr: { fontSize: 12, color: colors.secondary, marginTop: 4, fontFamily: 'monospace' },

    input: {
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      color: colors.white, fontSize: 14,
      marginBottom: 4,
    },

    valorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    maxBtn: {
      backgroundColor: 'rgba(198,255,74,0.1)',
      borderWidth: 1, borderColor: 'rgba(198,255,74,0.3)',
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    },
    maxBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },

    privRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    privTitulo: { fontSize: 14, fontWeight: '600', color: colors.white },
    privDesc:   { fontSize: 12, color: colors.secondary, marginTop: 4, lineHeight: 18 },

    erroInline: { fontSize: 11, color: '#ff4d4d', marginTop: 4 },
    erroBox: {
      fontSize: 13, color: '#ff4d4d',
      backgroundColor: 'rgba(255,77,77,0.1)',
      borderWidth: 1, borderColor: 'rgba(255,77,77,0.3)',
      borderRadius: 12, padding: 12, marginBottom: 12,
    },

    sucessoBox: {
      backgroundColor: 'rgba(198,255,74,0.08)',
      borderWidth: 1, borderColor: 'rgba(198,255,74,0.3)',
      borderRadius: 12, padding: 14, marginBottom: 12,
    },
    sucessoTitulo: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 4 },
    sucessoSig:    { fontSize: 12, color: colors.white, fontFamily: 'monospace' },
    sucessoLink:   { fontSize: 11, color: colors.secondary, marginTop: 4 },

    btnEnviar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14, paddingVertical: 16, marginTop: 8,
    },
    btnEnviarDisabled: { opacity: 0.4 },
    btnEnviarText: { fontSize: 15, fontWeight: '700', color: colors.background },

    footnote: {
      fontSize: 11, color: colors.secondary, textAlign: 'center', marginTop: 16, lineHeight: 16,
    },
  });
}
