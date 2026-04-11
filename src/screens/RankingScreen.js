import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRanking, getPosicaoRanking } from '../services/pontos';
import { colors } from '../theme/colors';
import Avatar from '../components/Avatar';

const medalhas = { 1: '🥇', 2: '🥈', 3: '🥉' };
const medalhasBg = { 1: '#2a2000', 2: '#1c1c24', 3: '#201208' };

function RankingItem({ item, uid, onPress, index }) {
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
      <TouchableOpacity
        style={[styles.item, isMe && styles.itemMe, isTop3 && { backgroundColor: medalhasBg[item.posicao] }]}
        onPress={onPress}
        activeOpacity={0.75}>
        <View style={styles.posBox}>
          <Text style={[styles.pos, isTop3 && styles.posTop]}>{medalhas[item.posicao] ?? `#${item.posicao}`}</Text>
        </View>
        <Avatar uri={item.avatarURL} nome={item.nome} size={40} borderColor={isMe ? colors.primary : colors.border} />
        <View style={styles.info}>
          <Text style={[styles.nome, isMe && styles.nomeMe]} numberOfLines={1}>
            {item.nome}{isMe ? ' (você)' : ''}
          </Text>
          <Text style={styles.pts}>{(item.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RankingScreen({ route, navigation }) {
  const { uid, perfil } = route.params || {};
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(false);
  const [minhaPos, setMinhaPos] = useState(null);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const [lista, pos] = await Promise.all([
        getRanking(),
        uid ? getPosicaoRanking(uid) : null,
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
          <Text style={styles.subtitle}>Top {ranking.length} jogadores</Text>

          {minhaPos && (
            <View style={styles.minhaPosCard}>
              <View style={styles.minhaPosLeft}>
                <Avatar uri={perfil?.avatarURL} nome={perfil?.nome} size={42} borderColor={colors.primary} />
                <View>
                  <Text style={styles.minhaPosNome} numberOfLines={1}>
                    {perfil?.nome?.split(' ')[0] ?? 'Você'}
                  </Text>
                  <Text style={styles.minhaPosPts}>
                    {(minhaPos.pontos ?? 0).toLocaleString('pt-BR')} pts
                  </Text>
                </View>
              </View>
              <View style={styles.minhaPosRight}>
                <Text style={styles.minhaPosLabel}>Sua posição</Text>
                <Text style={styles.minhaPosNum}>
                  {minhaPos.posicao <= 3
                    ? medalhas[minhaPos.posicao]
                    : `#${minhaPos.posicao}`}
                </Text>
              </View>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <RankingItem
          item={item} uid={uid} index={index}
          onPress={() => navigation.navigate('RankingDetail', { item, isMe: item.uid === uid })}
        />
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
    backgroundColor: colors.card, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  minhaPosLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  minhaPosNome: { fontSize: 15, fontWeight: '700', color: colors.primary, maxWidth: 160 },
  minhaPosPts: { fontSize: 12, color: colors.secondary, marginTop: 2 },
  minhaPosRight: { alignItems: 'center', minWidth: 64 },
  minhaPosLabel: { fontSize: 10, color: colors.secondary, marginBottom: 2 },
  minhaPosNum: { fontSize: 28, fontWeight: 'bold', color: colors.primary },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, gap: 10 },
  itemMe: { borderColor: colors.primary, borderWidth: 1.5 },
  posBox: { width: 36, alignItems: 'center' },
  pos: { fontSize: 20 },
  posTop: { fontSize: 26 },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '600', color: colors.white },
  nomeMe: { color: colors.primary },
  pts: { fontSize: 13, color: colors.secondary, marginTop: 2 },
  arrow: { fontSize: 20, color: colors.secondary },
});
