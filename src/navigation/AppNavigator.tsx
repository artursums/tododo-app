import React, { memo, useEffect, useState } from 'react'
import { NavigationContainer, DefaultTheme, Theme, NavigatorScreenParams } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import * as Linking from 'expo-linking'
import { AnimatedTododoIcon } from '../components/TododoIcon'

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
import HouseholdScreen from '../screens/HouseholdScreen'
import JoinCalendarScreen from '../screens/JoinCalendarScreen'
import SettingsScreen from '../screens/SettingsScreen'

export type RootStackParamList = {
  Onboarding: undefined
  Main: NavigatorScreenParams<MainTabParamList> | undefined
  Auth: undefined
  Household: undefined
  Join: { token?: string } | undefined
}

// Shared calendar membership is managed in the root People screen.
export type MainTabParamList = {
  Calendar: { view?: 'month' | 'week' | 'year' | 'memos'; request?: number } | undefined
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
        options={{ tabBarIcon: ({ color, size, focused }) => <AnimatedTododoIcon focused={focused} name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Calendars"
        component={CalendarListTab}
        options={{ tabBarIcon: ({ color, size, focused }) => <AnimatedTododoIcon focused={focused} name="layers" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityTab}
        options={{ tabBarIcon: ({ color, size, focused }) => <AnimatedTododoIcon focused={focused} name="bell" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTab}
        options={{ tabBarIcon: ({ color, size, focused }) => <AnimatedTododoIcon focused={focused} name="settings" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  )
}

const linking = {
  prefixes: [Linking.createURL('/'), 'tododo://'],
  config: {
    screens: {
      Join: 'join',
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
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'Main' }] })
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
      <Stack.Navigator initialRouteName={onboarded ? 'Main' : 'Onboarding'} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding">{() => <OnboardingScreen onDone={handleOnboardingDone} />}</Stack.Screen>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="Household" component={HouseholdScreen} />
        <Stack.Screen name="Join" component={JoinCalendarScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
