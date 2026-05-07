import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  { id: 'localizacao',   Icon: MapPin,    tituloKey: 'dados.permLocationTitle',  descKey: 'dados.permLocationDesc',  obrigatorio: false, cor: '#4FC3F7', bonus: 500 },
  { id: 'rede',          Icon: Wifi,      tituloKey: 'dados.permNetworkTitle',   descKey: 'dados.permNetworkDesc',   obrigatorio: false, cor: '#4DB6AC', bonus: 400 },
  { id: 'horarios',      Icon: Clock,     tituloKey: 'dados.permHoursTitle',     descKey: 'dados.permHoursDesc',     obrigatorio: false, cor: '#f9a825', bonus: 300 },
  { id: 'redes_sociais', Icon: Users,     tituloKey: 'dados.permSocialTitle',    descKey: 'dados.permSocialDesc',    obrigatorio: false, cor: '#c084fc', bonus: 200 },
  { id: 'contatos',      Icon: Users,     tituloKey: 'dados.permContactsTitle',  descKey: 'dados.permContactsDesc',  obrigatorio: false, cor: '#81C784', bonus: 150 },
  { id: 'camera',        Icon: Camera,    tituloKey: 'dados.permCameraTitle',    descKey: 'dados.permCameraDesc',    obrigatorio: false, cor: '#FF8A65', bonus: 1000 },
  { id: 'som',           Icon: Mic,       tituloKey: 'dados.permSoundTitle',     descKey: 'dados.permSoundDesc',     obrigatorio: false, cor: '#F06292', bonus: 1000 },
  { id: 'analiticos',    Icon: BarChart3, tituloKey: 'dados.permAnalyticsTitle', descKey: 'dados.permAnalyticsDesc', obrigatorio: true,  cor: PRIMARY,   bonus: null },
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
  const { t } = useTranslation();
  const anim = useEntrada(delay);
  const { Icon, tituloKey, descKey, obrigatorio, cor, bonus } = item;
  const titulo = t(tituloKey);
  const desc = t(descKey);

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
                  <Text style={{ fontSize: 9, color: PRIMARY, fontWeight: '700' }}>{t('dados.sectionEssential')}</Text>
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
                {t('dados.perWeek')}
              </Text>
            </View>
            {!valor && (
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                {t('dados.activateToEarn')}
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function SecaoConta({ navigation, delay }) {
  const { t } = useTranslation();
  const anim = useEntrada(delay);
  return (
    <Animated.View style={[{ marginTop: 24, marginBottom: 4 }, anim]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10 }}>
        {t('dados.sectionAccount')}
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
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{t('dados.downloadData')}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {t('dados.downloadDataDesc')}
          </Text>
        </View>
        <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DadosScreen({ navigation }) {
  const { t } = useTranslation();
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
        t('dados.savedTitle'),
        t('dados.savedMsg'),
        [{ text: t('common.ok') }]
      );
    } catch {
      Alert.alert(t('common.error'), t('dados.errorSave'));
    }
  }

  function handleRevogarTodos() {
    Alert.alert(
      t('dados.revokeTitle'),
      t('dados.revokeMsg'),
      [
        { text: t('dados.cancel'), style: 'cancel' },
        {
          text: t('dados.revokeBtn'),
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
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('dados.back')}</Text>
          </TouchableOpacity>

          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>{t('dados.title')}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                  {t('dados.optionalActive', { active: totalAtivos, total: totalOpc })}
                </Text>
              </View>
              <TouchableOpacity onPress={handleRevogarTodos} activeOpacity={0.7} style={{ paddingTop: 4 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.8)' }}>{t('dados.revokeAll')}</Text>
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
                  {t('dados.weekBonusActive')}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: bonusAtivo > 0 ? PRIMARY : 'rgba(255,255,255,0.25)' }}>
                  +{bonusAtivo.toLocaleString('pt-BR')} pts
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
                  {t('dados.maxPotential')}
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
                {t('dados.zkInfo')}
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
              {t('dados.neverSold')}
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
                {salvo ? t('dados.savedTitle') : t('dados.save')}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
