import React, { useRef, useState, useEffect } from 'react';
import { Animated as RNAnimated, View, StyleSheet } from 'react-native';
import KastBanner from './KastBanner';
import SolflareBanner from './SolflareBanner';

const PRIMARY = '#c6ff4a';

export default function BannerCarousel({ uid }) {
  const bannerFade = useRef(new RNAnimated.Value(1)).current;
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      RNAnimated.timing(bannerFade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setBannerIdx(prev => (prev === 0 ? 1 : 0));
          RNAnimated.timing(bannerFade, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        }
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [bannerFade]);

  return (
    <View>
      <RNAnimated.View style={{ opacity: bannerFade }}>
        {bannerIdx === 0 ? (
          <KastBanner uid={uid} />
        ) : (
          <SolflareBanner />
        )}
      </RNAnimated.View>

      <View style={styles.dotsContainer}>
        {[0, 1].map(i => (
          <View
            key={i}
            style={[
              styles.dotBase,
              i === bannerIdx ? styles.dotActive : styles.dotInactive,
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
