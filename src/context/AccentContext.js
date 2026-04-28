import React, { createContext, useContext } from 'react';

const ACCENT_TECH = '#c6ff4a';
const ACCENT_LITE = '#c084fc';

const AccentContext = createContext(ACCENT_TECH);

export function AccentProvider({ modo, children }) {
  const accent = modo === 'lite' ? ACCENT_LITE : ACCENT_TECH;
  return <AccentContext.Provider value={accent}>{children}</AccentContext.Provider>;
}

export function useAccent() {
  return useContext(AccentContext);
}

export const ACCENT = { TECH: ACCENT_TECH, LITE: ACCENT_LITE };
