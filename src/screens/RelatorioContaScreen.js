import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { ArrowLeft, FileText, Mail, CheckCircle2, Clock } from 'lucide-react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../services/firebase';

const solicitarRelatoriofn = httpsCallable(getFunctions(), 'solicitarRelatorio');

const PRIMARY = '#c6ff4a';

function useEntrada(delayMs = 0) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(20);
  useEffect(() => {
    const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
    opacity.value    = withDelay(delayMs, withTiming(1, cfg));
    translateY.value = withDelay(delayMs, withTiming(0, cfg));
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export default function RelatorioContaScreen({ navigation }) {
  const [solicitado, setSolicitado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const email = auth.currentUser?.email ?? '—';

  const a0 = useEntrada(0);
  const a1 = useEntrada(80);
  const a2 = useEntrada(160);
  const a3 = useEntrada(240);

  async function handleSolicitar() {
    setCarregando(true);
    try {
      await solicitarRelatoriofn();
      setSolicitado(true);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar o relatório. Tente novamente.');
      console.warn('[RelatorioContaScreen]', e?.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Cabeçalho */}
        <Animated.View style={a0}>
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

          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
              Pedir Relatório da Conta
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              Exportação dos seus dados pessoais
            </Text>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Card explicativo */}
          <Animated.View style={[{ marginBottom: 16 }, a1]}>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 20, gap: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(100,160,255,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={20} color="#64A0FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                    Relatório completo da conta
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                    Configurações, atividade e dados da CNB
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 }}>
                Crie um relatório com as configurações e os dados da sua conta da CNB. Essa ação gerará um arquivo com os dados e será enviado para o email cadastrado do usuário em até{' '}
                <Text style={{ color: '#fff', fontWeight: '600' }}>72 horas</Text>.
              </Text>

              {/* O que será incluído */}
              <View style={{ gap: 8 }}>
                {[
                  'Dados de perfil e configurações',
                  'Histórico de pontos e resgates',
                  'Preferências de privacidade',
                  'Registros de atividade na rede',
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 5, height: 5, borderRadius: 3,
                      backgroundColor: 'rgba(198,255,74,0.5)',
                    }} />
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Email de destino */}
          <Animated.View style={[{ marginBottom: 24 }, a2]}>
            <View style={{
              backgroundColor: 'rgba(198,255,74,0.05)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.15)',
              borderRadius: 14, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Mail size={16} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                  Será enviado para
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{email}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Estado: sucesso */}
          {solicitado && (
            <Animated.View style={[{ marginBottom: 20 }, a3]}>
              <View style={{
                backgroundColor: 'rgba(198,255,74,0.06)',
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.25)',
                borderRadius: 14, padding: 16,
                flexDirection: 'row', alignItems: 'flex-start', gap: 12,
              }}>
                <CheckCircle2 size={18} color={PRIMARY} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: PRIMARY, marginBottom: 4 }}>
                    Solicitação enviada
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18 }}>
                    Você receberá o relatório em <Text style={{ color: '#fff', fontWeight: '600' }}>{email}</Text> em até 72 horas.
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Prazo */}
          <Animated.View style={[{ marginBottom: 28 }, a2]}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 4,
            }}>
              <Clock size={13} color="rgba(255,255,255,0.25)" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flex: 1 }}>
                O prazo de entrega é de até 72 horas após a solicitação. Verifique sua caixa de spam caso não receba.
              </Text>
            </View>
          </Animated.View>

          {/* Botão */}
          <Animated.View style={a3}>
            <TouchableOpacity
              onPress={solicitado ? undefined : handleSolicitar}
              activeOpacity={solicitado ? 1 : 0.85}
              style={{
                backgroundColor: solicitado
                  ? 'rgba(198,255,74,0.12)'
                  : PRIMARY,
                borderRadius: 14, paddingVertical: 15,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
                borderWidth: solicitado ? 1 : 0,
                borderColor: solicitado ? PRIMARY : 'transparent',
                opacity: solicitado ? 0.7 : 1,
              }}
            >
              {carregando ? (
                <ActivityIndicator size="small" color="#000" />
              ) : solicitado ? (
                <>
                  <CheckCircle2 size={16} color={PRIMARY} />
                  <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 15 }}>
                    Solicitação enviada
                  </Text>
                </>
              ) : (
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
                  Solicitar relatório
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
