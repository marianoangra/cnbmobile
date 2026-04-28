import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Cpu, Check } from 'lucide-react-native';
import { atualizarModo } from '../services/pontos';

const PRIMARY = '#c6ff4a';
const PURPLE  = '#c084fc';

function ModeCard({ tipo, selecionado, onPress }) {
  const isLite = tipo === 'lite';
  const accent = isLite ? PURPLE : PRIMARY;
  const Icon   = isLite ? Cpu : Zap;
  const titulo = isLite ? 'Lite' : 'Tech';
  const desc   = isLite
    ? 'O essencial: carregar, missões, ranking e saque PIX. Privacidade ZK fica acessível pelo perfil.'
    : 'Experiência completa: wallet, DePIN, dados on-chain, compra de tokens e CNB Privado em destaque.';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: selecionado ? `${accent}1A` : 'rgba(255,255,255,0.04)',
        borderWidth: selecionado ? 2 : 1,
        borderColor: selecionado ? accent : 'rgba(255,255,255,0.10)',
        borderRadius: 18, padding: 20, marginBottom: 14,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: `${accent}26`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color={accent} strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', flex: 1 }}>{titulo}</Text>
        {selecionado && (
          <View style={{
            width: 24, height: 24, borderRadius: 12, backgroundColor: accent,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={14} color="#000" strokeWidth={3} />
          </View>
        )}
      </View>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 }}>
        {desc}
      </Text>
    </TouchableOpacity>
  );
}

export default function ModoEscolhaScreen({ route, navigation }) {
  const { uid, currentMode, atualizarPerfil } = route?.params || {};
  const [selecionado, setSelecionado] = useState(currentMode ?? 'tech');
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    if (!uid) {
      Alert.alert('Erro', 'Sessão expirada. Faça login novamente.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarModo(uid, selecionado);
      // Atualiza state local no App.js — força re-render do AppNavigator,
      // que troca o stack pra MainTabs e desmonta esta tela.
      atualizarPerfil?.({ modo: selecionado });
      // Se for o caso de "trocar modo" via Perfil (não onboarding), volta.
      if (currentMode != null && navigation.canGoBack?.()) {
        navigation.goBack();
      }
      // Em todo caso, libera o estado pra evitar travamento se a troca de stack falhar.
      setSalvando(false);
    } catch (e) {
      console.warn('[ModoEscolha] erro:', e);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
      setSalvando(false);
    }
  }

  return (
    <LinearGradient colors={['#0b1310', '#0a0f0d', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 12 : 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 6 }}>
            Escolha seu modo
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 28 }}>
            Você pode trocar a qualquer momento no Perfil.
          </Text>

          <ModeCard tipo="tech" selecionado={selecionado === 'tech'} onPress={() => setSelecionado('tech')} />
          <ModeCard tipo="lite" selecionado={selecionado === 'lite'} onPress={() => setSelecionado('lite')} />

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={confirmar}
            disabled={salvando}
            activeOpacity={0.85}
            style={{
              backgroundColor: selecionado === 'lite' ? PURPLE : PRIMARY,
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center', marginBottom: 12, opacity: salvando ? 0.6 : 1,
            }}>
            {salvando
              ? <ActivityIndicator color="#000" />
              : <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Confirmar</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
