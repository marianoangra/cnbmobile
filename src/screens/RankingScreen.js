import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Animated } from 'react-native'; // TouchableOpacity kept for error retry button
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRanking, getPosicaoRanking } from '../services/pontos';
import { colors } from '../theme/colors';
import Avatar from '../components/Avatar';

const medalhas = { 1: '🥇', 2: '🥈', 3: '🥉' };
const medalhasBg = { 1: '#2a2000', 2: '#1c1c24', 3: '#201208' };

function RankingItem({ item, uid, index }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: Math.min(index * 45, 600), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 400, delay: Math.min(index * 45, 600), useNativeDriver: true }),
    ]).start();
  }, []);

  const isMe = item.uid === uid;
  const isTop3 = item.posicao <= 3;

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <View style={[styles.item, isMe && styles.itemMe, isTop3 && { backgroundColor: medalhasBg[item.posicao] }]}>
        <View style={styles.posBox}>
          <Text style={[styles.pos, isTop3 && styles.posTop]}>{medalhas[item.posicao] ?? item.posicao}</Text>
        </View>
        <Avatar uri={item.avatarURL} nome={item.nome} size={40} borderColor={isMe ? colors.primary : colors.border} />
        <View style={styles.info}>
          <Text style={[styles.nome, isMe && styles.nomeMe]} numberOfLines={1}>
            {item.nome}{isMe ? ' (você)' : ''}
          </Text>
          <Text style={styles.pts}>{(item.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function RankingScreen({ route }) {
  const { uid, perfil } = route.params || {};
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(false);
  const [minhaPos, setMinhaPos] = useState(null);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 15000)
      );
      const [lista, pos] = await Promise.race([
        Promise.all([getRanking(), uid ? getPosicaoRanking(uid) : null]),
        timeout,
      ]);
      setRanking(lista);
      if (pos) setMinhaPos(pos);
    } catch { setErro(true); } finally { setLoading(false); setRefreshing(false); }
  }, [uid]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
  );

  if (erro) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>😕</Text>
        <Text style={{ color: colors.secondary, fontSize: 15, marginBottom: 20 }}>Falha ao carregar o ranking</Text>
        <TouchableOpacity onPress={() => { setLoading(true); carregar(); }} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: colors.background, fontWeight: 'bold' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <FlatList
      data={ranking}
      keyExtractor={i => i.uid}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>🏆 Ranking Global</Text>

          {minhaPos && (
            <View style={styles.minhaPosCard}>
              <Text style={styles.minhaPosLabel}>Sua posição</Text>
              <Text style={styles.minhaPosNum}>
                {minhaPos.posicao <= 3 ? medalhas[minhaPos.posicao] : minhaPos.posicao}
              </Text>
              <Text style={styles.minhaPosPts}>{(minhaPos.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <RankingItem item={item} uid={uid} index={index} />
      )}
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.white },
  subtitle: { fontSize: 13, color: colors.secondary, marginTop: 2, marginBottom: 14 },

  minhaPosCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1.5, borderColor: colors.primary, marginTop: 10,
  },
  minhaPosLabel: { fontSize: 11, color: colors.secondary, marginBottom: 2 },
  minhaPosNum: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
  minhaPosPts: { fontSize: 13, color: colors.secondary },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, gap: 10 },
  itemMe: { borderColor: colors.primary, borderWidth: 1.5 },
  posBox: { width: 36, alignItems: 'center' },
  pos: { fontSize: 20, color: colors.white },
  posTop: { fontSize: 26 },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '600', color: colors.white },
  nomeMe: { color: colors.primary },
  pts: { fontSize: 13, color: colors.secondary, marginTop: 2 },
});
