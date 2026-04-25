import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dimensions, ScrollView, View, StyleSheet } from 'react-native';
import FrontierBanner from './FrontierBanner';
import KastBanner from './KastBanner';
import SolflareBanner from './SolflareBanner';
import BingXBanner from './BingXBanner';

const PRIMARY = '#c6ff4a';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNERS = ['kast', 'frontier', 'solflare', 'bingx'];

export default function BannerCarousel({ uid }) {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);

  const scrollTo = useCallback((idx) => {
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  }, []);

  // Auto-avanço a cada 6s
  useEffect(() => {
    const interval = setInterval(() => {
      const next = (activeIdxRef.current + 1) % BANNERS.length;
      scrollTo(next);
    }, 6000);
    return () => clearInterval(interval);
  }, [scrollTo]);

  function handleScroll(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeIdxRef.current) {
      activeIdxRef.current = idx;
      setActiveIdx(idx);
    }
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        // Compensa o paddingHorizontal do ScrollView pai
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
      >
        <View style={{ width: SCREEN_WIDTH - 40 }}>
          <KastBanner uid={uid} />
        </View>
        <View style={{ width: SCREEN_WIDTH - 40, marginLeft: 40 }}>
          <FrontierBanner />
        </View>
        <View style={{ width: SCREEN_WIDTH - 40, marginLeft: 40 }}>
          <SolflareBanner />
        </View>
        <View style={{ width: SCREEN_WIDTH - 40, marginLeft: 40 }}>
          <BingXBanner />
        </View>
      </ScrollView>

      <View style={styles.dotsContainer}>
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dotBase,
              i === activeIdx ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  dotBase: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    backgroundColor: PRIMARY,
    width: 16,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 8,
  },
});
