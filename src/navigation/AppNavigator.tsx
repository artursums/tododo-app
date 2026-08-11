import React, { memo, useEffect, useState } from 'react'
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import * as Linking from 'expo-linking'
import { Feather } from '@expo/vector-icons'

import { useTheme } from '../contexts/ThemeContext'
import { navigationRef } from './navigationRef'
import { isOnboardingComplete, setOnboardingComplete } from '../services/settings'
import FadeScreen from '../components/FadeScreen'
import AnimatedTabBar from '../components/AnimatedTabBar'

import OnboardingScreen from '../screens/OnboardingScreen'
import AuthScreen from '../screens/AuthScreen'
import CalendarScreen from '../screens/CalendarScreen'
import CalendarListScreen from '../screens/CalendarListScreen'
import ActivityScreen from '../screens/ActivityScreen'
import SettingsScreen from '../screens/SettingsScreen'

export type RootStackParamList = {
  Onboarding: undefined
  Main: undefined
  Auth: undefined
}

// TimeTree-style tab set: the calendar itself, the calendar list, the activity
// feed, settings. (The M0 Household tab folded into the Calendars list — a
// shared calendar IS the household once the backend wiring lands.)
export type MainTabParamList = {
  Calendar: undefined
  Calendars: undefined
  Activity: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

// Each tab wrapped in a focus-fade so switches feel calm (ported pattern).
const CalendarTab = memo(() => (
  <FadeScreen>
    <CalendarScreen />
  </FadeScreen>
))
CalendarTab.displayName = 'CalendarTab'

const CalendarListTab = memo(() => (
  <FadeScreen>
    <CalendarListScreen />
  </FadeScreen>
))
CalendarListTab.displayName = 'CalendarListTab'

const ActivityTab = memo(() => (
  <FadeScreen>
    <ActivityScreen />
  </FadeScreen>
))
ActivityTab.displayName = 'ActivityTab'

const SettingsTab = memo(() => (
  <FadeScreen>
    <SettingsScreen />
  </FadeScreen>
))
SettingsTab.displayName = 'SettingsTab'

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, lazy: false }}
      tabBar={(props) => <AnimatedTabBar {...props} />}
    >
      <Tab.Screen
        name="Calendar"
        component={CalendarTab}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Calendars"
        component={CalendarListTab}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="layers" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityTab}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="bell" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTab}
        options={{ tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  )
}

const linking = {
  prefixes: [Linking.createURL('/'), 'tododo://'],
  config: {
    screens: {
      Main: {
        screens: {
          Calendar: 'calendar',
          Calendars: 'calendars',
          Activity: 'activity',
          Settings: 'settings',
        },
      },
    },
  },
}

export default function AppNavigator() {
  const { colors, isDark } = useTheme()
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    isOnboardingComplete().then(setOnboarded)
  }, [])

  const handleOnboardingDone = async () => {
    await setOnboardingComplete()
    setOnboarded(true)
  }

  // Themed navigation container so screen backgrounds match the palette.
  const navTheme: Theme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  }

  // Wait until we know whether onboarding is complete (avoids a flash).
  if (onboarded === null) return null

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!onboarded ? (
          <Stack.Screen name="Onboarding">
            {() => <OnboardingScreen onDone={handleOnboardingDone} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'fullScreenModal' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
