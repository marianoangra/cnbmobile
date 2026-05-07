import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ExternalLink, Zap, Sparkles } from 'lucide-react-native';
import { auth } from '../services/firebase';

// ─── Tela legacy: era a "Comprar CNB via PIX". Fluxo descontinuado em 2026-05.
// Agora redireciona pro JUICE Airdrop waitlist em cnbmobile.com/airdrop.
// Ver firestore.rules: /solicitacoes_compra agora é create:false.

const PRIMARY = '#c6ff4a';
const AIRDROP_URL = 'https://cnbmobile.com/airdrop';

function buildWaitlistUrl(user) {
  const params = ['from=app'];
  if (user?.email) params.push('email=' + encodeURIComponent(user.email));
  if (user?.uid) params.push('uid=' + encodeURIComponent(user.uid));
  return AIRDROP_URL + '?' + params.join('&');
}

export default function BuyTokensScreen({ navigation }) {
  const { t } = useTranslation();
  const u = auth.currentUser;

  function abrirWaitlist() {
    const url = buildWaitlistUrl(u);
    Linking.openURL(url).catch(err => console.warn('[Airdrop] erro abrir url:', err));
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
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('buyTokens.back')}</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Eyebrow */}
          <Text style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: PRIMARY, fontWeight: '700', marginBottom: 8,
          }}>
            JUICE Airdrop
          </Text>

          {/* Título */}
          <Text style={{
            fontSize: 28, fontWeight: '800', color: '#fff',
            letterSpacing: -0.5, lineHeight: 34, marginBottom: 12,
          }}>
            {t('buyTokens.deprecatedTitle')}
          </Text>

          {/* Subtítulo */}
          <Text style={{
            fontSize: 15, color: 'rgba(255,255,255,0.65)',
            lineHeight: 22, marginBottom: 28,
          }}>
            {t('buyTokens.deprecatedDesc')}
          </Text>

          {/* Card de destaque — por que agora */}
          <View style={{
            backgroundColor: 'rgba(198,255,74,0.06)',
            borderWidth: 1, borderColor: 'rgba(198,255,74,0.22)',
            borderRadius: 16, padding: 18, marginBottom: 28,
            flexDirection: 'row', gap: 14, alignItems: 'flex-start',
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 999,
              backgroundColor: 'rgba(198,255,74,0.15)',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sparkles size={18} color={PRIMARY} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                {t('buyTokens.whyPreTGE')}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 }}>
                {t('buyTokens.whyPreTGEDesc')}
              </Text>
            </View>
          </View>

          {/* CTA — Entrar na waitlist */}
          <TouchableOpacity
            onPress={abrirWaitlist}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 10, borderRadius: 14, paddingVertical: 16,
              backgroundColor: PRIMARY,
            }}
          >
            <Zap size={18} color="#000" strokeWidth={2.5} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#000', letterSpacing: 0.2 }}>
              {t('buyTokens.joinWaitlist')}
            </Text>
            <ExternalLink size={16} color="#000" strokeWidth={2} />
          </TouchableOpacity>

          {/* Nota técnica */}
          <Text style={{
            fontSize: 11, color: 'rgba(255,255,255,0.35)',
            textAlign: 'center', marginTop: 14, lineHeight: 16,
          }}>
            {t('buyTokens.redirectInfo')}
          </Text>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
