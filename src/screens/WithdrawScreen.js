import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { solicitarSaque } from '../services/pontos';
import { colors } from '../theme/colors';

export default function WithdrawScreen({ route, navigation }) {
  const { perfil } = route.params || {};
  const [pix, setPix] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSaque() {
    if (!pix.trim()) return Alert.alert('Atenção', 'Informe sua chave PIX.');
    Alert.alert('Confirmar Saque', `Debitar 100.000 pts e enviar para:\n${pix.trim()}\n\nPagamento em até 72h.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          setLoading(true);
          try {
            await solicitarSaque(perfil.uid, perfil.nome, pix.trim());
            Alert.alert('Saque solicitado!', 'Processaremos em até 72 horas.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch (e) {
            Alert.alert('Erro', e.message ?? 'Tente novamente.');
          } finally { setLoading(false); }
        }
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Solicitar Saque</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Seus pontos</Text>
          <Text style={styles.pontos}>{(perfil?.pontos ?? 0).toLocaleString('pt-BR')}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLine}>💰 Mínimo: 100.000 pontos</Text>
          <Text style={styles.infoLine}>📧 Pagamento: contato@rafaelmariano.com.br</Text>
          <Text style={styles.infoLine}>⏱ Prazo: até 72 horas</Text>
        </View>

        <TextInput style={styles.input} placeholder="Sua chave PIX" placeholderTextColor={colors.secondary}
          value={pix} onChangeText={setPix} autoCapitalize="none" />

        <TouchableOpacity
          style={[styles.btn, (perfil?.pontos ?? 0) < 100000 && styles.btnDisabled]}
          onPress={handleSaque}
          disabled={loading || (perfil?.pontos ?? 0) < 100000}>
          {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.btnText}>Confirmar Saque</Text>}
        </TouchableOpacity>

        <Text style={styles.aviso}>⚠️ 100.000 pts serão debitados da sua conta ao confirmar.</Text>
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
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 16, color: colors.white, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.background, fontWeight: 'bold', fontSize: 16 },
  aviso: { fontSize: 12, color: colors.secondary, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
