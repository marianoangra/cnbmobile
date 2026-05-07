import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Gift, CheckCircle, Zap, Star, Shield } from 'lucide-react-native';
import { addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const PRIMARY = '#c6ff4a';
const JUICE_COLOR = '#c6ff4a';

// 1.000 pontos = 1 $JUICE
const PONTOS_POR_JUICE = 1000;
const MINIMO_JUICE = 100; // 100.000 pontos

function formatarJuice(pontos) {
  const juice = Math.floor((pontos ?? 0) / PONTOS_POR_JUICE);
  return juice.toLocaleString('pt-BR');
}

export default function AirdropScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { perfil } = route?.params || {};
  const user = auth.currentUser;

  const [email, setEmail]       = useState(user?.email ?? '');
  const [wallet, setWallet]     = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso]   = useState(false);
  const [erro, setErro]         = useState('');

  const pontosAtuais  = perfil?.pontos ?? 0;
  const juiceEstimado = Math.floor(pontosAtuais / PONTOS_POR_JUICE);
  const elegivel      = juiceEstimado >= MINIMO_JUICE;

  async function entrarNaLista() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErro(t('airdrop.errorInvalidEmail'));
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      // Evita duplicatas por e-mail
      const q = query(collection(db, 'juice_waitlist'), where('email', '==', email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSucesso(true);
        return;
      }

      await addDoc(collection(db, 'juice_waitlist'), {
        email:         email.trim().toLowerCase(),
        walletSolana:  wallet.trim() || null,
        uid:           user?.uid ?? null,
        pontosApp:     pontosAtuais,
        juiceEstimado: juiceEstimado,
        source:        'app',
        locale:        i18n.language || 'pt',
        criadoEm:      serverTimestamp(),
      });
      setSucesso(true);
    } catch (e) {
      setErro(t('airdrop.errorRegister'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LinearGradient
      colors={['#0b1310', '#0a0f0d', '#000000']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('airdrop.back')}</Text>
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              marginBottom: 6,
            }}>
              <View style={{
                backgroundColor: 'rgba(198,255,74,0.12)',
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.25)',
                borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}>
                <Star size={10} color={PRIMARY} strokeWidth={2.5} />
                <Text style={{ fontSize: 10, color: PRIMARY, fontWeight: '700', letterSpacing: 1 }}>
                  {t('airdrop.waitlistBadge')}
                </Text>
              </View>
              {/* Badge do app */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                  {t('airdrop.priorityBadge')}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 4 }}>
              $JUICE Airdrop
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 19 }}>
              {t('airdrop.headlineSub')}
            </Text>

            {/* Card de estimativa */}
            <LinearGradient
              colors={['#182418', '#0c1410']}
              style={{
                borderRadius: 18, padding: 20,
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.20)',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
                {t('airdrop.yourPoints')}
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: PRIMARY, letterSpacing: -1 }}>
                {pontosAtuais.toLocaleString('pt-BR')}
                <Text style={{ fontSize: 14, fontWeight: '600', letterSpacing: 0 }}> pts</Text>
              </Text>

              <View style={{
                height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 14,
              }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>
                    {t('airdrop.estimateLabel')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>
                      {formatarJuice(pontosAtuais)}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: JUICE_COLOR }}>$JUICE</Text>
                  </View>
                </View>
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: 'rgba(198,255,74,0.10)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Gift size={22} color={PRIMARY} strokeWidth={2} />
                </View>
              </View>

              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
                {t('airdrop.conversionRate')}
              </Text>

              {!elegivel && pontosAtuais > 0 && (
                <View style={{
                  backgroundColor: 'rgba(255,160,0,0.08)',
                  borderWidth: 1, borderColor: 'rgba(255,160,0,0.2)',
                  borderRadius: 10, padding: 10, marginTop: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  <Zap size={13} color="#FFA500" />
                  <Text style={{ flex: 1, fontSize: 11, color: 'rgba(255,200,100,0.9)', lineHeight: 16 }}>
                    {t('airdrop.missingMin', {
                      pts: (MINIMO_JUICE * PONTOS_POR_JUICE - pontosAtuais).toLocaleString('pt-BR'),
                      min: MINIMO_JUICE,
                    })}
                  </Text>
                </View>
              )}
            </LinearGradient>

            {/* Formulário */}
            {!sucesso ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 18, padding: 20, marginBottom: 16,
              }}>
                {/* E-mail */}
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                  {t('airdrop.emailLabel')}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('airdrop.emailPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: 12, paddingHorizontal: 14, height: 50,
                    fontSize: 15, color: '#fff', marginBottom: 16,
                  }}
                />

                {/* Wallet Solana */}
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                  {t('airdrop.walletLabel')}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 6, lineHeight: 16 }}>
                  {t('airdrop.walletHint')}
                </Text>
                <TextInput
                  value={wallet}
                  onChangeText={setWallet}
                  placeholder={t('airdrop.walletPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: 12, paddingHorizontal: 14, height: 50,
                    fontSize: 14, color: '#fff', marginBottom: 16,
                  }}
                />

                {erro ? (
                  <Text style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 12 }}>{erro}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={entrarNaLista}
                  disabled={enviando}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: PRIMARY,
                    borderRadius: 12, paddingVertical: 16,
                    alignItems: 'center', justifyContent: 'center',
                    opacity: enviando ? 0.7 : 1,
                  }}
                >
                  {enviando
                    ? <ActivityIndicator color="#000" />
                    : <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>{t('airdrop.joinList')}</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              /* Estado de sucesso */
              <View style={{
                backgroundColor: 'rgba(198,255,74,0.06)',
                borderWidth: 1, borderColor: 'rgba(198,255,74,0.20)',
                borderRadius: 18, padding: 24, marginBottom: 16,
                alignItems: 'center',
              }}>
                <CheckCircle size={36} color={PRIMARY} strokeWidth={2} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 6 }}>
                  {t('airdrop.alreadyOnList')}
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19 }}>
                  {wallet.trim() ? t('airdrop.alreadyMsg') : t('airdrop.alreadyMsgNoWallet')}
                </Text>
              </View>
            )}

            {/* Reassurance */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              {[
                { icon: Shield, label: t('airdrop.noSpam') },
                { icon: Star,   label: t('airdrop.priorityAccess') },
                { icon: Gift,   label: t('airdrop.notPurchase') },
              ].map(({ icon: Icon, label }) => (
                <View
                  key={label}
                  style={{
                    flex: 1, alignItems: 'center', gap: 5,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 10,
                  }}
                >
                  <Icon size={14} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 13 }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Como funciona */}
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              borderRadius: 18, padding: 20,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: 0.5 }}>
                {t('airdrop.howItWorks')}
              </Text>
              {[
                { n: '1', titulo: t('airdrop.step1Title'), desc: t('airdrop.step1Desc') },
                { n: '2', titulo: t('airdrop.step2Title'), desc: t('airdrop.step2Desc') },
                { n: '3', titulo: t('airdrop.step3Title'), desc: t('airdrop.step3Desc') },
                { n: '4', titulo: t('airdrop.step4Title'), desc: t('airdrop.step4Desc') },
              ].map(({ n, titulo, desc }) => (
                <View key={n} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                  <View style={{
                    width: 26, height: 26, borderRadius: 99, flexShrink: 0,
                    backgroundColor: 'rgba(198,255,74,0.12)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: PRIMARY }}>{n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 }}>{titulo}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17 }}>{desc}</Text>
                  </View>
                </View>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
