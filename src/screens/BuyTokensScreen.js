import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, CheckCircle, AlertCircle } from 'lucide-react-native';

// ─── CONFIGURAÇÕES DO TIME CNB ────────────────────────────────────────────────
const PIX_KEY       = 'cnb@cnbtoken.io';     // ← Substituir pela chave PIX real
const PIX_KEY_TYPE  = 'E-mail';              // ← Tipo: E-mail / CNPJ / CPF / Telefone
const CONTATO_EMAIL = 'contato@cnbtoken.io'; // ← E-mail que recebe os comprovantes
const CNB_POR_REAL  = 100;                   // ← 1 BRL = 100 CNB (ajustar conforme cotação)
// ──────────────────────────────────────────────────────────────────────────────

const PRIMARY = '#c6ff4a';

function formatarCNB(valor) {
  if (!valor || isNaN(valor) || valor <= 0) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

const PASSOS = [
  {
    n: '1',
    titulo: 'Copie a chave PIX',
    desc: 'Use o botão acima para copiar a chave instantaneamente.',
  },
  {
    n: '2',
    titulo: 'Faça o pagamento',
    desc: 'Abra seu banco, cole a chave e realize o PIX no valor desejado.',
  },
  {
    n: '3',
    titulo: 'Envie o comprovante',
    desc: `Após o pagamento, encaminhe o comprovante para:\n${CONTATO_EMAIL}`,
  },
  {
    n: '4',
    titulo: 'Receba seus tokens',
    desc: 'Nossa equipe verificará e enviará os CNB para sua carteira em até 24h úteis.',
  },
];

export default function BuyTokensScreen({ navigation }) {
  const [valorBRL, setValorBRL] = useState('');
  const [copiado, setCopiado]   = useState(false);

  const valorNumerico = parseFloat(valorBRL.replace(',', '.'));
  const cnbCalculado  = valorNumerico * CNB_POR_REAL;

  async function copiarChavePIX() {
    await Clipboard.setStringAsync(PIX_KEY);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Voltar */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
          }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Voltar</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Header */}
          <Text style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', marginBottom: 4,
          }}>
            Comprar via PIX
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 4 }}>
            Comprar CNB
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            Calcule o valor, copie a chave PIX e envie o comprovante.
          </Text>

          {/* ── Calculadora ── */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CALCULADORA</Text>

            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
              Quanto você vai pagar?
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>R$</Text>
              <TextInput
                value={valorBRL}
                onChangeText={setValorBRL}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="rgba(255,255,255,0.2)"
                style={{ flex: 1, fontSize: 22, fontWeight: '700', color: '#fff' }}
                returnKeyType="done"
              />
            </View>

            {/* Resultado */}
            <View style={{
              backgroundColor: 'rgba(198,255,74,0.06)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.2)',
              borderRadius: 12, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                  Você receberá
                </Text>
                <Text style={{ fontSize: 28, fontWeight: '800', color: PRIMARY, letterSpacing: -0.5 }}>
                  {formatarCNB(cnbCalculado)}{' '}
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>CNB</Text>
                </Text>
              </View>
              <Text style={{ fontSize: 32 }}>⚡</Text>
            </View>

            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10, textAlign: 'center' }}>
              Taxa: 1 BRL = {CNB_POR_REAL.toLocaleString('pt-BR')} CNB
            </Text>
          </View>

          {/* ── Chave PIX ── */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CHAVE PIX</Text>

            <View style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12, padding: 14, marginBottom: 14,
            }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                {PIX_KEY_TYPE}
              </Text>
              <Text
                selectable
                style={{ fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: 0.3 }}
              >
                {PIX_KEY}
              </Text>
            </View>

            <TouchableOpacity
              onPress={copiarChavePIX}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderRadius: 12, paddingVertical: 14,
                backgroundColor: copiado ? 'rgba(198,255,74,0.12)' : PRIMARY,
                borderWidth: copiado ? 1.5 : 0,
                borderColor: copiado ? PRIMARY : 'transparent',
              }}
            >
              {copiado
                ? <CheckCircle size={18} color={PRIMARY} />
                : <Copy size={18} color="#000" />}
              <Text style={{ fontSize: 14, fontWeight: '700', color: copiado ? PRIMARY : '#000' }}>
                {copiado ? 'Copiado!' : 'Copiar chave PIX'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Como funciona ── */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>COMO FUNCIONA</Text>

            {PASSOS.map(({ n, titulo, desc }) => (
              <View key={n} style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 99, flexShrink: 0,
                  backgroundColor: 'rgba(198,255,74,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: PRIMARY }}>{n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 }}>
                    {titulo}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 }}>
                    {desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Aviso processo manual ── */}
          <View style={{
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            backgroundColor: 'rgba(255,200,0,0.05)',
            borderWidth: 1, borderColor: 'rgba(255,200,0,0.2)',
            borderRadius: 14, padding: 14,
          }}>
            <AlertCircle size={16} color="#ffd000" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>
              Processo manual. Após a confirmação do pagamento, a equipe CNB enviará os tokens para a carteira Solana vinculada à sua conta.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = {
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
};
