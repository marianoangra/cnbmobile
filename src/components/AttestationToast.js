import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onSessionAttested } from '../services/chargeEvents';

const NEON = '#00FF7F';
const AUTO_DISMISS_MS = 8000;

// Toast global de atestação on-chain. Montado uma vez no AppContent (App.js)
// pra persistir entre telas — antes vivia dentro do ChargingScreen, e o listener
// sumia no unmount, perdendo a notificação se o usuário navegasse antes do
// trigger SAS concluir.
export default function AttestationToast() {
  const insets = useSafeAreaInsets();
  const [att, setAtt] = useState(null);

  useEffect(() => {
    const off = onSessionAttested(payload => setAtt(payload));
    return off;
  }, []);

  useEffect(() => {
    if (!att) return;
    const timer = setTimeout(() => setAtt(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [att]);

  if (!att) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 96,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(0,255,127,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,127,0.35)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(0,255,127,0.18)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <BadgeCheck size={16} color={NEON} />
      </View>
      <TouchableOpacity
        onPress={() => att.solscanUrl && WebBrowser.openBrowserAsync(att.solscanUrl).catch(() => {})}
        activeOpacity={0.7}
        style={{ flex: 1 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
          Prova on-chain emitida
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
          {att.durationMinutes} min · {att.pontos.toLocaleString('pt-BR')} pts · toque pra ver
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setAtt(null)}
        hitSlop={8}
        activeOpacity={0.6}
        style={{ padding: 4 }}
      >
        <X size={14} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </View>
  );
}
