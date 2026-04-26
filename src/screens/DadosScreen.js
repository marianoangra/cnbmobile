import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import {
  ArrowLeft, MapPin, Users, Clock, Smartphone,
  Camera, Wifi, BarChart3, CheckCircle2, Info, Mic, Download, ChevronRight,
} from 'lucide-react-native';

const PRIMARY   = '#c6ff4a';
const STORAGE_KEY = '@cnb_dados_consentimentos';

const PERMISSOES = [
  {
    id: 'localizacao',
    Icon: MapPin,
    titulo: 'Localização',
    desc: 'Mapeamento de pontos DePIN e validação de presença física na rede.',
    obrigatorio: false,
    cor: '#4FC3F7',
    bonus: 500,
  },
  {
    id: 'rede',
    Icon: Wifi,
    titulo: 'Dados de Rede',
    desc: 'Monitoramento da contribuição na infraestrutura DePIN (tipo de conexão, qualidade).',
    obrigatorio: false,
    cor: '#4DB6AC',
    bonus: 400,
  },
  {
    id: 'horarios',
    Icon: Clock,
    titulo: 'Horários de uso',
    desc: 'Otimização da distribuição de pontos por período e hábitos de carregamento.',
    obrigatorio: false,
    cor: '#f9a825',
    bonus: 300,
  },
  {
    id: 'redes_sociais',
    Icon: Users,
    titulo: 'Redes Sociais',
    desc: 'Missões de engajamento e verificação de conta para desafios.',
    obrigatorio: false,
    cor: '#c084fc',
    bonus: 200,
  },
  {
    id: 'contatos',
    Icon: Users,
    titulo: 'Contatos',
    desc: 'Programa de indicação e convites para amigos participarem da rede.',
    obrigatorio: false,
    cor: '#81C784',
    bonus: 150,
  },
  {
    id: 'camera',
    Icon: Camera,
    titulo: 'Câmera',
    desc: 'Leitura de QR Code e atualização de foto de perfil.',
    obrigatorio: false,
    cor: '#FF8A65',
    bonus: 100,
  },
  {
    id: 'som',
    Icon: Mic,
    titulo: 'Som',
    desc: 'Áudio do microfone para validação de presença e missões de campo.',
    obrigatorio: false,
    cor: '#F06292',
    bonus: 100,
  },
  {
    id: 'analiticos',
    Icon: BarChart3,
    titulo: 'Dados Analíticos',
    desc: 'Melhoria contínua da experiência no app. Nenhum dado pessoal identificável é coletado.',
    obrigatorio: true,
    cor: PRIMARY,
    bonus: null,
  },
];

function useEntrada(delayMs = 0) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(16);
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

function PermissaoCard({ item, valor, onChange, delay }) {
  const anim = useEntrada(delay);
  const { Icon, titulo, desc, obrigatorio, cor, bonus } = item;

  return (
    <Animated.View style={anim}>
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: valor ? `${cor}33` : 'rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
      }}>
        {/* Linha principal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Ícone */}
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: valor ? `${cor}20` : 'rgba(255,255,255,0.05)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={valor ? cor : 'rgba(255,255,255,0.35)'} />
          </View>

          {/* Texto */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{titulo}</Text>
              {obrigatorio && (
                <View style={{
                  backgroundColor: 'rgba(198,255,74,0.12)',
                  borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2,
                  borderWidth: 1, borderColor: 'rgba(198,255,74,0.25)',
                }}>
                  <Text style={{ fontSize: 9, color: PRIMARY, fontWeight: '700' }}>ESSENCIAL</Text>
                </View>
              )}
            </View>
            <Text style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)',
              marginTop: 3, lineHeight: 16,
            }}>
              {desc}
            </Text>
          </View>

          {/* Toggle */}
          <Switch
            value={valor}
            onValueChange={obrigatorio ? undefined : onChange}
            disabled={obrigatorio}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${cor}60` }}
            thumbColor={valor ? cor : 'rgba(255,255,255,0.5)'}
            ios_backgroundColor="rgba(255,255,255,0.1)"
          />
        </View>

        {/* Bônus semanal */}
        {bonus !== null && (
          <View style={{
            marginTop: 10,
            marginLeft: 52,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: valor ? `${cor}18` : 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: valor ? `${cor}40` : 'rgba(255,255,255,0.08)',
              borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: valor ? cor : 'rgba(255,255,255,0.3)',
              }}>
                +{bonus.toLocaleString('pt-BR')} pts
              </Text>
              <Text style={{
                fontSize: 10,
                color: valor ? `${cor}99` : 'rgba(255,255,255,0.2)',
              }}>
                / semana
              </Text>
            </View>
            {!valor && (
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                Ative para ganhar
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function SecaoConta({ navigation, delay }) {
  const anim = useEntrada(delay);
  return (
    <Animated.View style={[{ marginTop: 24, marginBottom: 4 }, anim]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10 }}>
        CONTA
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('RelatorioConta')}
        activeOpacity={0.75}
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          borderRadius: 16, padding: 16,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: 'rgba(100,160,255,0.12)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Download size={18} color="#64A0FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Baixar meus Dados</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            Solicite um relatório completo da sua conta
          </Text>
        </View>
        <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DadosScreen({ navigation }) {
  const [consentimentos, setConsentimentos] = useState(
    Object.fromEntries(PERMISSOES.map(p => [p.id, p.obrigatorio]))
  );
  const [salvo, setSalvo] = useState(false);
  const carregouRef = useRef(false);

  const aHeader = useEntrada(0);
  const aInfo   = useEntrada(60);
  const aCards  = useEntrada(120);
  const aBtn    = useEntrada(200);

  // Carrega consentimentos salvos
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(json => {
        if (json) {
          const salvos = JSON.parse(json);
          setConsentimentos(prev => ({
            ...prev,
            ...salvos,
            // essenciais sempre true
            ...Object.fromEntries(PERMISSOES.filter(p => p.obrigatorio).map(p => [p.id, true])),
          }));
        }
      })
      .catch(() => {})
      .finally(() => { carregouRef.current = true; });
  }, []);

  function toggle(id) {
    setConsentimentos(prev => ({ ...prev, [id]: !prev[id] }));
    setSalvo(false);
  }

  async function handleSalvar() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(consentimentos));

      // Sincroniza com Firestore para que o backend respeite os consentimentos
      const uid = auth.currentUser?.uid;
      if (uid) {
        await updateDoc(doc(db, 'usuarios', uid), { consentimentos });
      }

      setSalvo(true);
      Alert.alert(
        'Preferências salvas',
        'Suas escolhas de privacidade foram registradas com sucesso.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    }
  }

  function handleRevogarTodos() {
    Alert.alert(
      'Revogar todos',
      'Isso desativará todos os dados opcionais. Algumas funcionalidades podem ficar limitadas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: () => {
            setConsentimentos(
              Object.fromEntries(
                PERMISSOES.map(p => [p.id, p.obrigatorio ? true : false])
              )
            );
            setSalvo(false);
          },
        },
      ]
    );
  }

  const totalAtivos   = PERMISSOES.filter(p => !p.obrigatorio && consentimentos[p.id]).length;
  const totalOpc      = PERMISSOES.filter(p => !p.obrigatorio).length;
  const bonusAtivo    = PERMISSOES.filter(p => p.bonus && consentimentos[p.id]).reduce((acc, p) => acc + p.bonus, 0);
  const bonusMaximo   = PERMISSOES.filter(p => p.bonus).reduce((acc, p) => acc + p.bonus, 0);

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Cabeçalho */}
        <Animated.View style={aHeader}>
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

          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>Meus Dados</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                  {totalAtivos} de {totalOpc} opcionais ativos
                </Text>
              </View>
              <TouchableOpacity onPress={handleRevogarTodos} activeOpacity={0.7} style={{ paddingTop: 4 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.8)' }}>Revogar todos</Text>
              </TouchableOpacity>
            </View>

            {/* Bônus total */}
            <View style={{
              marginTop: 14,
              backgroundColor: bonusAtivo > 0 ? 'rgba(198,255,74,0.06)' : 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: bonusAtivo > 0 ? 'rgba(198,255,74,0.2)' : 'rgba(255,255,255,0.07)',
              borderRadius: 12, padding: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
                  Bônus semanal ativo
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: bonusAtivo > 0 ? PRIMARY : 'rgba(255,255,255,0.25)' }}>
                  +{bonusAtivo.toLocaleString('pt-BR')} pts
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
                  Potencial máximo
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                  +{bonusMaximo.toLocaleString('pt-BR')} pts
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Aviso ZK */}
          <Animated.View style={[{ marginBottom: 20, marginTop: 4 }, aInfo]}>
            <View style={{
              backgroundColor: 'rgba(198,255,74,0.05)',
              borderWidth: 1, borderColor: 'rgba(198,255,74,0.18)',
              borderRadius: 14, padding: 14,
              flexDirection: 'row', alignItems: 'flex-start', gap: 10,
            }}>
              <Info size={16} color={PRIMARY} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>
                O CNB Mobile usa <Text style={{ color: PRIMARY, fontWeight: '600' }}>Zero-Knowledge Proofs</Text> para validar sua atividade sem expor seus dados pessoais. Você controla o que compartilha.
              </Text>
            </View>
          </Animated.View>

          {/* Cards de permissão */}
          <Animated.View style={aCards}>
            {PERMISSOES.map((item, i) => (
              <PermissaoCard
                key={item.id}
                item={item}
                valor={consentimentos[item.id]}
                onChange={() => toggle(item.id)}
                delay={120 + i * 40}
              />
            ))}
          </Animated.View>

          {/* Seção Conta */}
          <SecaoConta navigation={navigation} delay={220} />

          {/* Rodapé legal */}
          <Animated.View style={[{ marginTop: 24, marginBottom: 20 }, aBtn]}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 17, textAlign: 'center' }}>
              Seus dados nunca são vendidos a terceiros. Para mais informações, consulte nossa{' '}
              <Text style={{ color: 'rgba(198,255,74,0.6)' }}>Política de Privacidade</Text>.
            </Text>
          </Animated.View>

          {/* Botão salvar */}
          <Animated.View style={aBtn}>
            <TouchableOpacity
              onPress={handleSalvar}
              activeOpacity={0.85}
              style={{
                backgroundColor: salvo ? 'rgba(198,255,74,0.15)' : PRIMARY,
                borderRadius: 14, paddingVertical: 15,
                alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
                borderWidth: salvo ? 1 : 0,
                borderColor: salvo ? PRIMARY : 'transparent',
              }}
            >
              {salvo && <CheckCircle2 size={16} color={PRIMARY} />}
              <Text style={{
                color: salvo ? PRIMARY : '#000',
                fontWeight: '700', fontSize: 15,
              }}>
                {salvo ? 'Preferências salvas' : 'Salvar preferências'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
