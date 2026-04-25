import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { Trophy, Users, Flame, Crown } from 'lucide-react-native';
import { getRanking, getRankingIndicacoes, getPosicaoRanking } from '../services/pontos';
import Avatar from '../components/Avatar';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIMARY = '#c6ff4a';

// ─── Pódio Top-3 ─────────────────────────────────────────────────────────────
// Ordem visual: 2º | 1º | 3º
const PODIUM_VISUAL = [
  { dataIdx: 1, rank: 2, gradient: ['#e4e4e7', '#71717a'], barH: 64 },
  { dataIdx: 0, rank: 1, gradient: ['#c6ff4a', '#2ecc71'], barH: 77 },
  { dataIdx: 2, rank: 3, gradient: ['#f59e0b', '#b45309'], barH: 51 },
];

function PodiumItem({ item, rank, gradient, barH, uid, modo }) {
  const isMe = item?.uid === uid;
  const big  = rank === 1;
  const sz   = big ? 64 : 48;
  const valor = modo === 'indicacoes'
    ? `${item?.referidos ?? 0} ind.`
    : (item?.pontos ?? 0).toLocaleString('pt-BR');

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      {/* Crown acima do 1º */}
      {big && (
        <View style={{ marginBottom: 4 }}>
          <Crown size={16} color={PRIMARY} fill={PRIMARY} />
        </View>
      )}

      {/* Avatar real com borda gradiente */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0.13, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          width: sz + 4, height: sz + 4, borderRadius: (sz + 4) / 2,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 6,
          borderWidth: isMe ? 2 : 0, borderColor: isMe ? '#fff' : 'transparent',
        }}
      >
        <Avatar
          uri={item?.avatarURL}
          nome={item?.nome}
          size={sz}
          style={{ borderWidth: 0 }}
        />
      </LinearGradient>

      <Text style={{ fontSize: big ? 11 : 10, fontWeight: '500', color: '#fff', textAlign: 'center', maxWidth: 72 }} numberOfLines={1}>
        {item?.nome ?? '—'}
      </Text>
      <Text style={{ fontSize: 10, color: PRIMARY, marginTop: 1 }}>
        {valor}
      </Text>

      {/* Pedestal */}
      <View style={{
        width: 36, height: barH,
        borderTopLeftRadius: 6, borderTopRightRadius: 6,
        marginTop: 8,
        alignItems: 'center', justifyContent: 'flex-start',
        paddingTop: 8,
        backgroundColor: rank === 1
          ? 'rgba(198,255,74,0.13)'
          : rank === 2
            ? 'rgba(228,228,231,0.10)'
            : 'rgba(245,158,11,0.12)',
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: rank === 1
          ? 'rgba(198,255,74,0.45)'
          : rank === 2
            ? 'rgba(228,228,231,0.30)'
            : 'rgba(245,158,11,0.40)',
      }}>
        <Text style={{
          color: rank === 1 ? PRIMARY : rank === 2 ? '#e4e4e7' : '#f59e0b',
          fontWeight: '700', fontSize: 13,
        }}>{rank}</Text>
      </View>
    </View>
  );
}

function Podium({ lista, uid, modo }) {
  if (lista.length < 3) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, marginBottom: 20 }}>
      {PODIUM_VISUAL.map((p) => (
        <PodiumItem
          key={p.rank}
          item={lista[p.dataIdx]}
          rank={p.rank}
          gradient={p.gradient}
          barH={p.barH}
          uid={uid}
          modo={modo}
        />
      ))}
    </View>
  );
}

// ─── Item de lista ────────────────────────────────────────────────────────────
const ITEM_HEIGHT = 68;

function RankingItem({ item, uid, index, modo }) {
  const isMe = item.uid === uid;

  const opacity    = useSharedValue(0);
  const translateX = useSharedValue(24);
  useEffect(() => {
    const delay = Math.min(index * 40, 500);
    const cfg   = { duration: 380, easing: Easing.out(Easing.cubic) };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateX.value = withDelay(delay, withTiming(0, cfg));
  }, [modo]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 12, marginBottom: 6, borderRadius: 14,
        backgroundColor: isMe ? 'rgba(198,255,74,0.06)' : 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: isMe ? 'rgba(198,255,74,0.25)' : 'rgba(255,255,255,0.07)',
        height: ITEM_HEIGHT,
      }}>
        {/* Posição */}
        <View style={{ width: 32, alignItems: 'center' }}>
          <Text style={{
            fontSize: item.posicao <= 3 ? 20 : 14,
            color: item.posicao <= 3 ? PRIMARY : 'rgba(255,255,255,0.4)',
            fontWeight: '700',
          }}>
            {item.posicao <= 3 ? ['🥇','🥈','🥉'][item.posicao - 1] : item.posicao}
          </Text>
        </View>

        <Avatar uri={item.avatarURL} nome={item.nome} size={40} borderColor={isMe ? PRIMARY : 'rgba(255,255,255,0.1)'} />

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: isMe ? '600' : '500', color: isMe ? PRIMARY : '#fff' }} numberOfLines={1}>
            {item.nome}{isMe ? ' · Você' : ''}
          </Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
            {modo === 'global'
              ? `${(item.pontos ?? 0).toLocaleString('pt-BR')} pontos`
              : `${item.referidos ?? 0} indicações`
            }
          </Text>
        </View>

        {/* Delta badge */}
        {item.delta !== undefined && item.delta !== null && (
          <View style={{
            paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99,
            backgroundColor:
              item.delta > 0  ? 'rgba(198,255,74,0.15)' :
              item.delta < 0  ? 'rgba(239,68,68,0.15)'  :
              'rgba(255,255,255,0.08)',
          }}>
            <Text style={{
              fontSize: 10, fontWeight: '600',
              color: item.delta > 0 ? PRIMARY : item.delta < 0 ? '#f87171' : 'rgba(255,255,255,0.4)',
            }}>
              {item.delta > 0 ? `+${item.delta}` : item.delta === 0 ? '0' : item.delta}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function RankingScreen({ route }) {
  const { uid } = route?.params || {};
  const [modo, setModo]                     = useState('global');
  const [ranking, setRanking]               = useState([]);
  const [rankingInd, setRankingInd]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [erro, setErro]                     = useState(false);
  const [minhaPos, setMinhaPos]             = useState(null);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
      const [lista, listaInd, pos] = await Promise.race([
        Promise.all([getRanking(), getRankingIndicacoes(), uid ? getPosicaoRanking(uid) : null]),
        timeout,
      ]);
      setRanking(lista);
      setRankingInd(listaInd);
      if (pos) setMinhaPos(pos);
    } catch { setErro(true); } finally { setLoading(false); setRefreshing(false); }
  }, [uid]);

  useEffect(() => { carregar(); }, [carregar]);

  const dadosAtivos    = modo === 'global' ? ranking : rankingInd;
  const minhaEntradaInd = rankingInd.find(u => u.uid === uid);
  // Top-3 apenas para o pódio (lista começa no 4º abaixo)
  const listaAbaixoPodium = dadosAtivos.slice(3);

  // ── Loading ──
  if (loading) return (
    <LinearGradient colors={['#0b1310', '#0a0f0d', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    </LinearGradient>
  );

  // ── Erro ──
  if (erro) return (
    <LinearGradient colors={['#0b1310', '#0a0f0d', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>😕</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 20 }}>
            Falha ao carregar o ranking
          </Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); carregar(); }}
            style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={['#0b1310', '#0a0f0d', '#000000']} locations={[0, 0.5, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FlatList
          data={listaAbaixoPodium}
          keyExtractor={i => i.uid}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT + 6, offset: (ITEM_HEIGHT + 6) * index, index })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); carregar(); }}
              tintColor={PRIMARY}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Header — "Top Miners" + badge Semanal */}
              <View style={{
                flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
                paddingTop: 16, paddingBottom: 20,
              }}>
                <View>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Ranking</Text>
                  <Text style={{ fontSize: 24, fontWeight: '600', color: '#fff', letterSpacing: -0.5, marginTop: 2 }}>
                    Global
                  </Text>
                </View>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: 'rgba(198,255,74,0.10)',
                  borderWidth: 1, borderColor: 'rgba(198,255,74,0.30)',
                  borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
                }}>
                  <Flame size={12} color={PRIMARY} />
                  <Text style={{ fontSize: 10, color: PRIMARY }}>Semanal</Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 12, padding: 3, marginBottom: 20,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              }}>
                {[
                  { id: 'global',     label: 'Global',    Icon: Trophy },
                  { id: 'indicacoes', label: 'Indicações', Icon: Users  },
                ].map(({ id, label, Icon }) => (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setModo(id)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      paddingVertical: 9, borderRadius: 10,
                      backgroundColor: modo === id ? PRIMARY : 'transparent',
                    }}
                  >
                    <Icon size={13} color={modo === id ? '#000' : 'rgba(255,255,255,0.5)'} />
                    <Text style={{
                      fontSize: 13, fontWeight: '600',
                      color: modo === id ? '#000' : 'rgba(255,255,255,0.5)',
                    }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Minha posição */}
              {modo === 'global' && minhaPos && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: 'rgba(198,255,74,0.07)',
                  borderWidth: 1.5, borderColor: 'rgba(198,255,74,0.25)',
                  borderRadius: 14, padding: 14, marginBottom: 20,
                }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Sua posição</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: PRIMARY }}>
                    {minhaPos.posicao}
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                    {(minhaPos.pontos ?? 0).toLocaleString('pt-BR')} pts
                  </Text>
                </View>
              )}

              {modo === 'indicacoes' && minhaEntradaInd && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: 'rgba(198,255,74,0.07)',
                  borderWidth: 1.5, borderColor: 'rgba(198,255,74,0.25)',
                  borderRadius: 14, padding: 14, marginBottom: 20,
                }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Suas indicações</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: PRIMARY }}>
                    {minhaEntradaInd.posicao}
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                    {minhaEntradaInd.referidos ?? 0} indicações
                  </Text>
                </View>
              )}

              {/* Pódio */}
              {dadosAtivos.length >= 3 && <Podium lista={dadosAtivos} uid={uid} modo={modo} />}

              {/* Espaçador antes da lista */}
              {listaAbaixoPodium.length > 0 && <View style={{ marginBottom: 10 }} />}

              {/* Ranking indicações vazio */}
              {modo === 'indicacoes' && dadosAtivos.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                  <Users size={36} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' }}>
                    Nenhuma indicação ainda.{'\n'}Compartilhe seu código e apareça aqui!
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <RankingItem item={item} uid={uid} index={index} modo={modo} />
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}
