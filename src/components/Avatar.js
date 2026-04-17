import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { colors } from '../theme/colors';

export default function Avatar({ uri, nome, size = 56, borderColor, style }) {
  const [erro, setErro] = useState(false);
  const inicial = (nome ?? 'U')[0].toUpperCase();
  const fontSize = size * 0.38;
  const borderRadius = size / 2;
  const bc = borderColor ?? colors.border;

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

  return (
    <View style={[{
      width: size, height: size, borderRadius,
      backgroundColor: colors.card,
      borderWidth: 2, borderColor: bc,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Text style={{ fontSize, fontWeight: 'bold', color: colors.primary }}>{inicial}</Text>
    </View>
  );
}
