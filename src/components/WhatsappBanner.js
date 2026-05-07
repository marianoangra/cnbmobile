import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, TouchableOpacity, Image, View, Text, useWindowDimensions, Linking, Alert } from 'react-native';

const WHATSAPP_URL = 'https://chat.whatsapp.com/GsIEmnUPKsn2W95HEjPwW8';
const BANNER_H = 180;
const ICON_SIZE = 92;

export default function WhatsappBanner() {
  const { t } = useTranslation();
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
      t('components.whatsappAlertTitle'),
      t('components.whatsappAlertMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('components.whatsappOpen'), onPress: () => Linking.openURL(WHATSAPP_URL) },
      ],
    );
  }

  // Stretch the JPEG so the baked-in icon (right ~50% of source) is pushed off-screen,
  // leaving only the dark teal texture as background.
  const bgWidth = imgWidth * 2;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={{
          width: imgWidth, height: BANNER_H, borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#173a36',
        }}>
          <Image
            source={require('../../assets/whatsapp-banner.jpeg')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: bgWidth,
              height: BANNER_H,
            }}
            resizeMode="cover"
          />
          <View style={{
            position: 'absolute',
            right: 20,
            top: (BANNER_H - ICON_SIZE) / 2,
            shadowColor: '#25D366',
            shadowOpacity: 0.55,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
          }}>
            <Image
              source={require('../../assets/whatsapp-icon.png')}
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
              resizeMode="contain"
            />
          </View>
          <View style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: imgWidth * 0.62,
            justifyContent: 'center',
            paddingLeft: 18,
          }}>
            <Text style={{
              color: '#7CFFB7',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.4,
              marginBottom: 6,
            }}>
              {t('components.whatsappBadge')}
            </Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 21,
              fontWeight: '800',
              lineHeight: 25,
            }}>
              {t('components.whatsappLine')}
            </Text>
            <Text style={{
              color: '#7CFFB7',
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 6,
            }}>
              {t('components.whatsappPrize')}
            </Text>
            <Text style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 12,
              marginTop: 6,
            }}>
              {t('components.whatsappTap')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
