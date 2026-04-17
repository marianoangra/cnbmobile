import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { solicitarSaque } from '../services/pontos';
import { logSaqueSolicitado } from '../services/analytics';
import { colors } from '../theme/colors';

export default function WithdrawScreen({ route, navigation }) {
  const { perfil } = route.params || {};
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [pix, setPix] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [loading, setLoading] = useState(false);

  const pontosDisponiveis = perfil?.pontos ?? 0;
  const qtd = parseInt(quantidade.replace(/\D/g, ''), 10) || 0;

  function pixValido(chave) {
    const v = chave.trim();
    if (!v) return false;
    if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
    const digits = v.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 14;
  }

  const podeConfirmar = pontosDisponiveis >= 100000 && qtd >= 100000 && qtd <= pontosDisponiveis && nome.trim() && pixValido(pix);

  async function handleSaque() {
    if (!perfil?.uid) return Alert.alert('Erro', 'Dados do perfil não carregados.');
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe seu nome completo.');
    if (!pixValido(pix)) return Alert.alert('Atenção', 'Informe uma chave PIX válida (CPF, e-mail, telefone ou chave aleatória).');
    if (qtd < 100000) return Alert.alert('Atenção', 'Mínimo de 100.000 pontos.');
    if (qtd > pontosDisponiveis) return Alert.alert('Atenção', 'Pontos insuficientes.');

    Alert.alert(
      'Confirmar Saque',
      `Nome: ${nome.trim()}\nChave PIX: ${pix.trim()}\nPontos: ${qtd.toLocaleString('pt-BR')}\n\nPagamento em até 72h.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            setLoading(true);
            try {
              await solicitarSaque(perfil.uid, nome.trim(), pix.trim(), qtd);
              logSaqueSolicitado(qtd);
              Alert.alert('Saque solicitado!', 'Processaremos em até 72 horas.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } catch (e) {
              Alert.alert('Erro', e.message ?? 'Tente novamente.');
            } finally { setLoading(false); }
          }
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Solicitar Saque</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Seus pontos disponíveis</Text>
            <Text style={styles.pontos}>{pontosDisponiveis.toLocaleString('pt-BR')}</Text>
          </View>

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
            onChangeText={setQuantidade}
            keyboardType="numeric"
          />
          {qtd > 0 && qtd < 100000 && (
            <Text style={styles.erro}>Mínimo de 100.000 pontos.</Text>
          )}
          {qtd > pontosDisponiveis && qtd > 0 && (
            <Text style={styles.erro}>Você não tem pontos suficientes.</Text>
          )}

          <TouchableOpacity
            style={[styles.btn, !podeConfirmar && styles.btnDisabled]}
            onPress={handleSaque}
            disabled={loading || !podeConfirmar}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.btnText}>Confirmar Saque</Text>}
          </TouchableOpacity>

          <Text style={styles.aviso}>⚠️ Os pontos serão debitados da sua conta ao confirmar.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  infoCard: { backgroundColor: '#0d1f0d', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.primary, marginBottom: 20 },
  infoLine: { fontSize: 14, color: colors.secondary, marginBottom: 6 },
  fieldLabel: { fontSize: 13, color: colors.secondary, marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 16, color: colors.white, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  erro: { fontSize: 12, color: '#ff4d4d', marginTop: -10, marginBottom: 12, marginLeft: 4 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
  aviso: { fontSize: 12, color: colors.secondary, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
