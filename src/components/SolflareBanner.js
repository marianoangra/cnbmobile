import React, { useRef } from 'react';
import { Animated, TouchableOpacity, Image, View, useWindowDimensions, Linking, Alert } from 'react-native';

const SOLFLARE_URL = 'https://solflare.com';
const BANNER_H = 127;

export default function SolflareBanner() {
  const scale = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const imgWidth = width - 40;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }
  function handlePress() {
    Alert.alert(
      'Abrir link externo',
      'Você será redirecionado para fora do app.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir', onPress: () => Linking.openURL(SOLFLARE_URL) },
      ],
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}>
        {/* cover preenche o banner inteiro — sem letterboxing, sem problema de cor */}
        <View style={{
          width: imgWidth, height: BANNER_H, borderRadius: 16,
          overflow: 'hidden',
        }}>
          <Image
            source={require('../../assets/solflare-banner.jpg')}
            style={{ width: imgWidth, height: BANNER_H }}
            resizeMode="cover"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
