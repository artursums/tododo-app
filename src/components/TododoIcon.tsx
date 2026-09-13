import React, { memo, useEffect } from 'react'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

// Original 32-unit drawings. Open corners, offset dots and soft panels form
// tododo's visual vocabulary; these paths do not depend on a platform icon font.
const paths: Record<string, string> = {
  calendar: 'M23 7H10Q5 7 5 12V23Q5 27 10 27H22Q27 27 27 22V15M11 4V10M21 4V10M6 14H22M11 20H14M11 24H19',
  layers: 'M5 11Q3 10 5 8L14 4Q16 3 18 4L27 8Q29 10 27 11L18 15Q16 16 14 15ZM5 17L14 21Q16 22 18 21L27 17M5 23L14 27Q16 28 18 27L27 23',
  bell: 'M23 17V13Q23 6 16 6Q9 6 9 13V17L6 22Q5 24 9 24H24M13 28H19M16 3V6',
  settings: 'M6 9H13M21 9H27M6 23H11M19 23H27M17 5V13M15 19V27',
  users: 'M5 26V23Q5 17 11 17Q17 17 17 23V27M20 18Q27 17 27 24V26M8 9Q8 5 12 5Q16 5 16 9Q16 13 12 13Q8 13 8 9M22 7Q27 7 26 11Q26 14 22 14',
  user: 'M5 27V24Q5 17 16 17Q25 17 26 24M11 8Q11 3 16 3Q21 3 21 8Q21 13 16 13Q11 13 11 8',
  bookmark: 'M25 26L17 21Q16 20 15 21L7 26V9Q7 5 11 5H20Q25 5 25 10V18M12 11H20M12 15H17',
  moon: 'M25 20Q15 24 11 14Q9 9 12 5Q3 8 5 18Q7 29 18 27Q24 26 27 22',
  sun: 'M16 2V5M16 27V30M2 16H5M27 16H30M6 6L8 8M24 24L26 26M6 26L8 24M24 8L26 6',
  search: 'M22 22L28 28M24 14A10 10 0 1 1 4 14A10 10 0 1 1 24 14',
  clock: 'M27 14A11 11 0 1 1 20 6M16 9V17L22 20',
  heart: 'M16 27C12 23 4 18 4 11C4 3 13 3 16 10C19 3 28 3 28 11C28 18 20 24 16 27Z',
  home: 'M3 14L13 5Q16 2 19 5L29 14M7 13V24Q7 28 11 28H22Q26 28 26 24V17M14 28V20H19V28',
  work: 'M11 9V6Q11 4 14 4H19Q22 4 22 6V9M7 10H25Q28 10 28 13V22Q28 27 23 27H9Q4 27 4 22V14M5 17Q16 23 27 17M14 19V22H19V19',
  book: 'M16 27Q10 23 4 25V6Q11 4 16 8Q22 4 28 6V25Q22 23 16 27V8M8 11L12 12M21 11L25 10',
  school: 'M11 8V7Q11 3 16 3Q21 3 21 7V8M9 9H23Q27 9 27 15V24Q27 28 23 28H9Q5 28 5 24V15Q5 9 9 9ZM11 20H21V25H11ZM12 13H20',
  palette: 'M25 7Q15 0 7 9Q1 16 7 24Q13 30 18 26Q20 24 18 21Q16 17 22 17Q30 17 28 11',
  party: 'M5 27L10 12L22 24ZM18 5Q23 9 18 13M25 4L24 8M26 17L30 16M9 3L11 6',
  plane: 'M4 18L13 13L24 4Q28 2 28 6L19 18L15 28L11 22ZM14 13L7 7M19 18L25 25',
  activity: 'M3 19H9L14 7L20 26L24 16H29',
  image: 'M23 5H10Q5 5 5 10V22Q5 27 10 27H23Q27 27 27 22V12M6 23L13 16L19 23L23 19L27 23',
  lock: 'M10 14V9Q10 3 16 3Q22 3 22 9V14M8 14H24V23Q24 28 19 28H13Q8 28 8 23ZM16 19V23',
  tag: 'M6 6H17L28 17L17 28L6 17ZM11 11H12',
  link: 'M13 20L20 13M10 15L7 18Q3 23 7 27Q11 31 16 26L19 23M13 9L16 6Q21 1 26 6Q30 10 26 15L23 18',
  'map-pin': 'M16 29C12 24 6 18 6 12A10 10 0 0 1 26 12C26 18 20 24 16 29ZM20 12A4 4 0 1 1 12 12A4 4 0 1 1 20 12',
  'file-text': 'M23 27H10Q6 27 6 23V8Q6 4 10 4H20L27 11V21M20 4V11H27M11 16H21M11 21H18',
  list: 'M13 8H27M13 16H24M13 24H27M5 8H6M5 16H6M5 24H6',
  filter: 'M5 7H27L19 17V25L13 28V17Z',
  'trash-2': 'M5 9H27M12 9V5H20V9M8 13L10 28H22L24 13M14 14V23M19 14V23',
  'edit-2': 'M23 3L29 9L13 25L5 27L7 19ZM19 7L25 13',
  check: 'M6 17L13 24L27 8',
  plus: 'M16 5V27M5 16H27', minus: 'M6 16H26', x: 'M7 7L25 25M25 7L7 25',
  'chevron-right': 'M12 7L21 16L12 25', 'chevron-left': 'M20 7L11 16L20 25', 'chevron-down': 'M7 12L16 21L25 12', 'chevron-up': 'M7 20L16 11L25 20',
  'arrow-right': 'M5 16H27M19 8L27 16L19 24',
  'external-link': 'M18 5H27V14M27 5L15 17M12 7H9Q5 7 5 11V23Q5 27 9 27H23Q27 27 27 23V20',
  'log-out': 'M13 5H7V27H13M12 16H29M23 10L29 16L23 22',
  'log-in': 'M20 5H26V27H20M3 16H20M14 10L20 16L14 22',
  'refresh-cw': 'M27 6V14H19M27 14A11 11 0 1 0 26 23',
}
const aliases: Record<string, string> = { grid: 'layers', sliders: 'settings', 'check-square': 'check', 'check-circle': 'check', 'align-left': 'file-text', 'check-list': 'list', 'checklist': 'list', 'more-horizontal': 'settings' }

export const TododoIcon = memo(function TododoIcon({ name, size = 24, color = '#6256C7', selected = false }: { name: string; size?: number; color?: string; selected?: boolean }) {
  const key = aliases[name] ?? name
  return <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
    {['calendar', 'bell', 'bookmark', 'work', 'home', 'book', 'school', 'heart', 'users', 'image', 'file-text', 'lock'].includes(key) && <Rect x={8} y={10} width={17} height={16} rx={6} fill={color} opacity={selected ? 0.22 : 0.12} />}
    <G fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {key === 'circle' || key === 'alert-circle' ? <Circle cx={16} cy={16} r={12} /> : key === 'square' ? <Rect x={5} y={5} width={22} height={22} rx={7} /> : <Path d={paths[key] ?? paths.list} />}
      {key === 'sun' && <Circle cx={16} cy={16} r={7} />}
      {key === 'settings' && <><Circle cx={17} cy={9} r={4} fill={color} fillOpacity={0.14} /><Circle cx={15} cy={23} r={4} fill={color} fillOpacity={0.14} /></>}
    </G>
    {['calendar', 'bell', 'layers', 'bookmark', 'image', 'palette', 'clock'].includes(key) && <Circle cx={26} cy={6} r={2.8} fill={selected ? '#FB7185' : color} />}
  </Svg>
})

export function AnimatedTododoIcon({ focused, ...props }: React.ComponentProps<typeof TododoIcon> & { focused: boolean }) {
  const scale = useSharedValue(1)
  useEffect(() => { scale.value = withSpring(focused ? 1.09 : 1, { damping: 12, stiffness: 220 }) }, [focused, scale])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return <Animated.View style={style}><TododoIcon {...props} selected={focused} /></Animated.View>
}
