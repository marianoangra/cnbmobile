import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import { Clock, ArrowUpRight, AlertCircle } from 'lucide-react-native';

const medalhasCor = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

export default function RankingDetailScreen({ route }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { item, isMe } = route.params || {};

  if (!item) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <AlertCircle size={32} color={colors.secondary} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.secondary, textAlign: 'center' }}>{t('rankingDetail.noData')}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarRow}>
        <Avatar uri={item?.avatarURL} nome={item?.nome} size={90} borderColor={isMe ? colors.primary : colors.border} />
        <Text style={[styles.posicao, { color: medalhasCor[item?.posicao] ?? colors.primary }]}>
          {item?.posicao <= 3 ? item?.posicao : `#${item?.posicao}`}
        </Text>
      </View>

      <Text style={styles.nome}>{item?.nome}{isMe ? t('rankingDetail.you') : ''}</Text>

      <View style={styles.pontosCard}>
        <Text style={styles.label}>{t('rankingDetail.totalPoints')}</Text>
        <Text style={styles.pontos}>{(item?.pontos ?? 0).toLocaleString('pt-BR')}</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.card, styles.half]}>
          <Clock size={20} color={colors.secondary} style={{ marginBottom: 6 }} />
          <Text style={styles.statVal}>{item?.minutos ?? 0}</Text>
          <Text style={styles.statLabel}>{t('rankingDetail.minutesCharging')}</Text>
        </View>
        <View style={[styles.card, styles.half]}>
          <ArrowUpRight size={20} color={colors.secondary} style={{ marginBottom: 6 }} />
          <Text style={styles.statVal}>{item?.saques ?? 0}</Text>
          <Text style={styles.statLabel}>{t('rankingDetail.withdrawals')}</Text>
        </View>
      </View>

      <View style={styles.rankCard}>
        <Text style={styles.rankLabel}>{t('rankingDetail.globalPosition')}</Text>
        <Text style={[styles.rankPos, { color: medalhasCor[item?.posicao] ?? colors.primary }]}>
          {item?.posicao <= 3 ? item?.posicao : `#${item?.posicao}`}
        </Text>
        <Text style={styles.rankSub}>{t('rankingDetail.title')}</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, alignItems: 'center', paddingBottom: 32 },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 },
    posicao: { fontSize: 52 },
    nome: { fontSize: 22, fontWeight: 'bold', color: colors.white, marginBottom: 24, textAlign: 'center' },
    pontosCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#1a3a1a' },
    label: { fontSize: 13, color: colors.secondary },
    pontos: { fontSize: 44, fontWeight: 'bold', color: colors.primary, marginTop: 4 },
    row: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 14 },
    half: { flex: 1 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    statVal: { fontSize: 26, fontWeight: 'bold', color: colors.primary },
    statLabel: { fontSize: 12, color: colors.secondary, marginTop: 4, textAlign: 'center' },
    rankCard: { backgroundColor: '#0d1f0d', borderRadius: 16, padding: 20, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.primary },
    rankLabel: { fontSize: 13, color: colors.secondary, marginBottom: 6 },
    rankPos: { fontSize: 52 },
    rankSub: { fontSize: 12, color: colors.secondary, marginTop: 4 },
  });
}
