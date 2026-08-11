import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Small local-settings + first-run store. Self-contained (no cloud) so the theme
 * and onboarding gate work before any account/backend exists.
 */

const SETTINGS_KEY = 'settings'
const ONBOARDING_KEY = 'onboardingComplete'

export interface Settings {
  darkMode: boolean
}

const DEFAULT_SETTINGS: Settings = {
  darkMode: false,
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Non-fatal — a failed preference write shouldn't crash the app.
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true'
  } catch {
    return false
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
  } catch {
    // Non-fatal.
  }
}
