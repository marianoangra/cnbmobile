import React, { useRef } from 'react';
import { Animated, TouchableOpacity, Image, View, useWindowDimensions, Linking, Alert } from 'react-native';

const BINGX_URL = 'https://bingxdao.com/partner/rafaelmariano/';
const BANNER_H  = 180;

export default function BingXBanner() {
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
        { text: 'Abrir', onPress: () => Linking.openURL(BINGX_URL) },
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
        <View style={{
          width: imgWidth, height: BANNER_H, borderRadius: 16,
          overflow: 'hidden',
        }}>
          <Image
            source={require('../../assets/bingx-banner.jpg')}
            style={{ width: imgWidth, height: BANNER_H }}
            resizeMode="cover"
            resizeMethod="resize"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
