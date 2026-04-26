import React, { useState, useEffect } from 'react';
import { View, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const CNB_LOGO = require('../../assets/cnb-logo.png');

export default function Avatar({ uri, nome, size = 56, borderColor, style }) {
  const { colors } = useTheme();
  const [erro, setErro] = useState(false);

  useEffect(() => { setErro(false); }, [uri]);

  const borderRadius = size / 2;
  const bc = borderColor ?? colors.border;

  // Avatar real do usuário
  if (uri && !erro) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius, borderWidth: 2, borderColor: bc }, style]}
        resizeMode="cover"
        onError={() => setErro(true)}
      />
    );
  }

  // Fallback: logo CNB com borda
  return (
    <View style={[{
      width: size, height: size, borderRadius,
      borderWidth: 2, borderColor: bc,
      overflow: 'hidden',
    }, style]}>
      <Image
        source={CNB_LOGO}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>
  );
}
