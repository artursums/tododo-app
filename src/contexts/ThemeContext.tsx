import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme'
import { DEFAULT_SETTINGS, getSettings, saveSettings, Settings } from '../services/settings'

interface ThemeContextType {
  isDark: boolean
  colors: typeof LIGHT_COLORS
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  toggleTheme: () => void
  setDarkMode: (dark: boolean) => void
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const latest = useRef(settings)
  const writes = useRef(Promise.resolve())
  useEffect(() => { getSettings().then(value => { latest.current = value; setSettings(value); setLoaded(true) }) }, [])
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setSettings(next)
    // Serialize full snapshots so a slow earlier write cannot undo a later choice.
    writes.current = writes.current.then(() => saveSettings(next))
  }, [])
  const setDarkMode = useCallback((darkMode: boolean) => updateSettings({ darkMode }), [updateSettings])
  const toggleTheme = useCallback(() => setDarkMode(!latest.current.darkMode), [setDarkMode])
  const value = useMemo(() => ({ settings, updateSettings, isDark: settings.darkMode, colors: settings.darkMode ? DARK_COLORS : LIGHT_COLORS, setDarkMode, toggleTheme }), [settings, updateSettings, setDarkMode, toggleTheme])
  return loaded ? <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider> : null
}
export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within a ThemeProvider')
  return value
}
