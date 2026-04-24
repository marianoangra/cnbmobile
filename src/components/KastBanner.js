import React, { useRef } from 'react';
import { Animated, TouchableOpacity, Image, StyleSheet, useWindowDimensions, Linking } from 'react-native';

const KAST_URL = 'https://join.kast.xyz/click?offer_id=6&pub_id=96';
const IMG_RATIO = 1200 / 630;

export default function KastBanner({ uid }) {
  const scale = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }
  function handlePress() {
    const url = uid ? `${KAST_URL}&sub1=${uid}` : KAST_URL;
    Linking.openURL(url);
  }

  const imgHeight = width / IMG_RATIO;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={styles.container}>
        <Image
          source={require('../../assets/kast-banner.png')}
          style={{ width, height: imgHeight }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
