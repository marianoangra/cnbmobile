import React, { useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Activity, TrendingUp, Zap } from 'lucide-react-native';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

const PRIMARY = '#c6ff4a';

// --- Skeleton ---
function SkeletonBar({ width, delay = 0 }) {
  const opacity = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          delay,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, delay]);

  return (
    <RNAnimated.View
      style={[styles.skeletonBar, { width, opacity }]}
    />
  );
}

function SkeletonContent() {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBar width={120} delay={0} />
      <View style={styles.skeletonRow}>
        <SkeletonBar width={72} delay={100} />
        <SkeletonBar width={72} delay={200} />
        <SkeletonBar width={72} delay={300} />
      </View>
    </View>
  );
}

// --- Live dot ---
function LiveDot() {
  const scale = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scale, {
          toValue: 1.6,
          duration: 600,
          useNativeDriver: true,
        }),
        RNAnimated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <View style={styles.liveDotWrapper}>
      <RNAnimated.View
        style={[
          styles.liveDotRing,
          { transform: [{ scale }] },
        ]}
      />
      <View style={styles.liveDot} />
    </View>
  );
}

// --- Metric item ---
function MetricItem({ icon: Icon, label, value }) {
  return (
    <View style={styles.metricItem}>
      <Icon size={18} color={PRIMARY} strokeWidth={2} />
      <Text style={styles.metricValue}>{value ?? '—'}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// --- Main component ---
export default function DePINLiveCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reanimated entry animation
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    const ref = doc(db, 'stats', 'dashboard');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setData(snap.data());
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Trigger entry animation once loaded
  useEffect(() => {
    if (!loading) {
      opacity.value = withDelay(100, withTiming(1, { duration: 500 }));
      translateY.value = withDelay(100, withSpring(0, { damping: 18, stiffness: 120 }));
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.card}>
        <SkeletonContent />
      </View>
    );
  }

  const formatNumber = (n) => {
    if (n == null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <Reanimated.View style={[styles.card, animatedStyle]}>
      {/* Header */}
      <View style={styles.header}>
        <LiveDot />
        <Text style={styles.title}>Rede CNB Mobile</Text>
        <Text style={styles.liveLabel}>ao vivo</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricItem
          icon={Activity}
          label="minutos"
          value={formatNumber(data?.totalMinutos)}
        />
        <View style={styles.metricDivider} />
        <MetricItem
          icon={Zap}
          label="sessões"
          value={formatNumber(data?.totalSessoes)}
        />
        <View style={styles.metricDivider} />
        <MetricItem
          icon={TrendingUp}
          label="pontos"
          value={formatNumber(data?.totalPontos)}
        />
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  liveLabel: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Live dot
  liveDotWrapper: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: `${PRIMARY}33`,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '400',
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Skeleton
  skeletonContainer: {
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  skeletonBar: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
