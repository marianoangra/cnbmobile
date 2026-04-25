import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path } from 'react-native-svg';

/**
 * Logo oficial CNB — fundo degradê verde-limão → esmeralda → petróleo
 * com raio branco e highlight de volume. Fiel ao Figma Make.
 */
export default function CnbLogo({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      <Defs>
        {/* Fundo: verde-limão → esmeralda → azul-petróleo */}
        <LinearGradient id="cnbBgGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor="#c6ff4a" />
          <Stop offset="55%"  stopColor="#2ecc71" />
          <Stop offset="100%" stopColor="#1f7a8c" />
        </LinearGradient>

        {/* Highlight superior (efeito 3D) */}
        <RadialGradient id="cnbHighlight" cx="0.3" cy="0.15" r="0.9">
          <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.35" />
          <Stop offset="50%"  stopColor="#ffffff" stopOpacity="0.05" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>

        {/* Sombra interna inferior */}
        <RadialGradient id="cnbShade" cx="0.7" cy="0.95" r="0.9">
          <Stop offset="0%"   stopColor="#000000" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>

        {/* Raio: branco com leve verde */}
        <LinearGradient id="cnbBolt" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%"   stopColor="#ffffff" />
          <Stop offset="100%" stopColor="#eafff0" />
        </LinearGradient>
      </Defs>

      {/* Fundo arredondado */}
      <Rect x="0" y="0" width="300" height="300" rx="64" ry="64" fill="url(#cnbBgGrad)" />
      <Rect x="0" y="0" width="300" height="300" rx="64" ry="64" fill="url(#cnbHighlight)" />
      <Rect x="0" y="0" width="300" height="300" rx="64" ry="64" fill="url(#cnbShade)" />

      {/* Raio principal */}
      <Path
        d="M 168 58 Q 178 58 174 68 L 148 130 Q 145 138 153 138 L 188 138 Q 200 138 192 148 L 132 240 Q 122 252 126 238 L 144 178 Q 147 170 139 170 L 108 170 Q 96 170 104 160 L 158 64 Q 162 58 168 58 Z"
        fill="url(#cnbBolt)"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Highlight de volume no raio */}
      <Path
        d="M 165 70 L 152 100 Q 149 106 154 106 L 162 106 L 168 70 Z"
        fill="#ffffff"
        opacity="0.55"
      />
    </Svg>
  );
}
