import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { SPACING, FONT_SIZES, BORDER_WIDTH } from '../constants/theme'
import { captureError } from '../services/monitoring'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

interface ErrorFallbackProps {
  error: Error | null
  onRetry: () => void
}

// The boundary is mounted OUTSIDE every provider (see App.tsx), so the fallback
// must not depend on any React context — if ThemeProvider itself crashes, this
// screen still has to render. Hardcoded neutrals tuned to theme.ts LIGHT/DARK.
const FALLBACK_PALETTES = {
  light: { bg: '#F7F7FB', text: '#1B1B2F', muted: '#5B5B72', surface: '#FFFFFF', border: '#E7E7F0' },
  dark: { bg: '#0E0E16', text: '#F2F2F7', muted: '#A6A6BD', surface: '#1A1A26', border: '#2A2A3A' },
} as const

const ErrorFallback = ({ onRetry }: ErrorFallbackProps) => {
  const scheme = useColorScheme()
  const palette = FALLBACK_PALETTES[scheme === 'dark' ? 'dark' : 'light']
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Feather name="alert-circle" size={48} color={palette.text} />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: palette.muted }]}>
          Don&apos;t worry, your data is safe. Try refreshing to continue.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onRetry}
        >
          <Feather name="refresh-cw" size={20} color={palette.text} />
          <Text style={[styles.buttonText, { color: palette.text }]}> Try Again</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    captureError(error, { componentStack: errorInfo.componentStack })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  content: { alignItems: 'center', maxWidth: 300 },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderCurve: 'continuous' as const,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: BORDER_WIDTH,
  },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', marginBottom: SPACING.sm, textAlign: 'center' },
  message: { fontSize: FONT_SIZES.md, textAlign: 'center', marginBottom: SPACING.xl, lineHeight: 22 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    borderWidth: BORDER_WIDTH,
  },
  buttonText: { fontSize: FONT_SIZES.md, fontWeight: '600' },
})
