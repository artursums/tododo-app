import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme'
import { getSettings, saveSettings } from '../services/settings'

type ThemeColors = typeof LIGHT_COLORS

interface ThemeContextType {
  isDark: boolean
  colors: ThemeColors
  toggleTheme: () => void
  setDarkMode: (dark: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((settings) => {
      setIsDark(settings.darkMode)
      setIsLoaded(true)
    })
  }, [])

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS

  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  const toggleTheme = useCallback(async () => {
    const newValue = !isDarkRef.current
    setIsDark(newValue)
    const settings = await getSettings()
    await saveSettings({ ...settings, darkMode: newValue })
  }, [])

  const setDarkMode = useCallback(async (dark: boolean) => {
    setIsDark(dark)
    const settings = await getSettings()
    await saveSettings({ ...settings, darkMode: dark })
  }, [])

  const value = useMemo(
    () => ({ isDark, colors, toggleTheme, setDarkMode }),
    [isDark, colors, toggleTheme, setDarkMode],
  )

  // Don't render until the theme preference is loaded (avoids a flash).
  if (!isLoaded) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
