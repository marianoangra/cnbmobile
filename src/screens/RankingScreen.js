import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRanking, getRankingIndicacoes, getPosicaoRanking } from '../services/pontos';
import { colors } from '../theme/colors';
import Avatar from '../components/Avatar';

const medalhas = { 1: '🥇', 2: '🥈', 3: '🥉' };
const medalhasBg = { 1: '#2a2000', 2: '#1c1c24', 3: '#201208' };

function RankingItem({ item, uid, index, modo }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(30);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: Math.min(index * 45, 600), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 400, delay: Math.min(index * 45, 600), useNativeDriver: true }),
    ]).start();
  }, [modo]);

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
          {modo === 'global' ? (
            <Text style={styles.pts}>{(item.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
          ) : (
            <Text style={styles.pts}>{item.referidos ?? 0} indicação{(item.referidos ?? 0) !== 1 ? 'ões' : ''}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function TabToggle({ modo, onChange }) {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, modo === 'global' && styles.tabAtivo]}
        onPress={() => onChange('global')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, modo === 'global' && styles.tabTextAtivo]}>🏆 Ranking Global</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, modo === 'indicacoes' && styles.tabAtivo]}
        onPress={() => onChange('indicacoes')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, modo === 'indicacoes' && styles.tabTextAtivo]}>👥 Indicações</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RankingScreen({ route }) {
  const { uid } = route.params || {};
  const [modo, setModo] = useState('global');
  const [ranking, setRanking] = useState([]);
  const [rankingIndicacoes, setRankingIndicacoes] = useState([]);
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
      const [lista, listaInd, pos] = await Promise.race([
        Promise.all([
          getRanking(),
          getRankingIndicacoes(),
          uid ? getPosicaoRanking(uid) : null,
        ]),
        timeout,
      ]);
      setRanking(lista);
      setRankingIndicacoes(listaInd);
      if (pos) setMinhaPos(pos);
    } catch { setErro(true); } finally { setLoading(false); setRefreshing(false); }
  }, [uid]);

  useEffect(() => { carregar(); }, [carregar]);

  const dadosAtivos = modo === 'global' ? ranking : rankingIndicacoes;

  const minhaEntradaInd = rankingIndicacoes.find(u => u.uid === uid);

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
        data={dadosAtivos}
        keyExtractor={i => i.uid}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <TabToggle modo={modo} onChange={setModo} />

            {modo === 'global' && minhaPos && (
              <View style={styles.minhaPosCard}>
                <Text style={styles.minhaPosLabel}>Sua posição</Text>
                <Text style={styles.minhaPosNum}>
                  {minhaPos.posicao <= 3 ? medalhas[minhaPos.posicao] : minhaPos.posicao}
                </Text>
                <Text style={styles.minhaPosPts}>{(minhaPos.pontos ?? 0).toLocaleString('pt-BR')} pts</Text>
              </View>
            )}

            {modo === 'indicacoes' && minhaEntradaInd && (
              <View style={styles.minhaPosCard}>
                <Text style={styles.minhaPosLabel}>Suas indicações</Text>
                <Text style={styles.minhaPosNum}>
                  {minhaEntradaInd.posicao <= 3 ? medalhas[minhaEntradaInd.posicao] : `#${minhaEntradaInd.posicao}`}
                </Text>
                <Text style={styles.minhaPosPts}>{minhaEntradaInd.referidos ?? 0} indicações</Text>
              </View>
            )}

            {modo === 'indicacoes' && dadosAtivos.length === 0 && (
              <View style={styles.vazio}>
                <Text style={styles.vazioCopy}>Nenhuma indicação ainda.</Text>
                <Text style={styles.vazioCopy}>Compartilhe seu código e apareça aqui!</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <RankingItem item={item} uid={uid} index={index} modo={modo} />
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

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabAtivo: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  tabTextAtivo: {
    color: colors.background,
  },

  minhaPosCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1.5, borderColor: colors.primary, marginTop: 2,
  },
  minhaPosLabel: { fontSize: 11, color: colors.secondary, marginBottom: 2 },
  minhaPosNum: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
  minhaPosPts: { fontSize: 13, color: colors.secondary },

  vazio: { alignItems: 'center', paddingVertical: 40 },
  vazioCopy: { color: colors.secondary, fontSize: 14, marginBottom: 4 },

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
