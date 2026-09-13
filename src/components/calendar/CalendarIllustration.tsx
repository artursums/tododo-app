import React from 'react'
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg'

const ink = '#6256C7'
const pink = '#FB7185'
const pale = '#D9D2F6'
const paper = '#F8F7F4'

/** Original miniature scenes for calendar covers; deliberately separate from
 * the compact navigation glyphs so larger tiles have their own personality. */
export default function CalendarIllustration({ name, size }: { name: string; size: number }) {
  let scene: React.ReactNode
  switch (name) {
    case 'home': case 'users':
      scene = <><Path d="M19 34L46 13Q49 11 52 14L77 35V57Q77 62 71 62H25Q19 62 19 56Z" fill={ink} /><Path d="M12 34L45 8Q49 5 53 8L84 34" fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" /><Circle cx={38} cy={34} r={7} fill={paper} /><Path d="M26 62V53Q26 43 38 43Q50 43 50 53V62" fill={paper} /><Circle cx={58} cy={39} r={6} fill={pink} /><Path d="M48 62V55Q48 46 58 46Q68 46 68 55V62" fill={pink} /><Circle cx={49} cy={52} r={4} fill={pale} /><Path d="M42 63V61Q42 57 49 57Q56 57 56 61V63" fill={pale} /></>
      break
    case 'heart':
      scene = <><G rotation={-14} origin="37,38"><Rect x={16} y={19} width={34} height={42} rx={17} fill={ink} /><Circle cx={33} cy={30} r={7} fill={pale} /></G><G rotation={14} origin="61,38"><Rect x={48} y={19} width={34} height={42} rx={17} fill={pink} /><Circle cx={65} cy={30} r={7} fill={paper} /></G><Path d="M48 50C34 43 40 33 48 40C56 33 62 43 48 50Z" fill={paper} /></>
      break
    case 'work':
      scene = <><G rotation={-8} origin="46,40"><Path d="M34 23V17Q34 12 39 12H53Q58 12 58 17V23" fill="none" stroke={ink} strokeWidth={5} /><Rect x={17} y={23} width={59} height={39} rx={10} fill={ink} /><Path d="M18 35Q45 49 75 35" fill="none" stroke={pale} strokeWidth={2} /><Rect x={41} y={37} width={10} height={10} rx={3} fill={pink} /></G><Rect x={67} y={46} width={15} height={17} rx={4} fill={paper} /><Path d="M71 52H78M71 57H76" stroke={ink} strokeWidth={2} strokeLinecap="round" /></>
      break
    case 'party':
      scene = <><Circle cx={26} cy={32} r={8} fill={pink} /><Path d="M13 61V54Q13 42 26 42Q39 42 39 54V61" fill={pink} /><Circle cx={48} cy={25} r={9} fill={ink} /><Path d="M32 62V50Q32 36 48 36Q64 36 64 50V62" fill={ink} /><Circle cx={72} cy={36} r={7} fill={pale} /><Path d="M60 62V55Q60 45 72 45Q84 45 84 55V62" fill={pale} /><Path d="M23 11L26 16M70 12L67 18M80 21L85 20" stroke={pink} strokeWidth={3} strokeLinecap="round" /></>
      break
    case 'clock':
      scene = <><Rect x={25} y={9} width={46} height={56} rx={20} fill={ink} transform="rotate(13 48 37)" /><Circle cx={48} cy={36} r={23} fill={paper} /><Circle cx={48} cy={36} r={19} fill="none" stroke={pale} strokeWidth={2} /><Path d="M48 21V37L60 42" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" /><Circle cx={48} cy={37} r={4} fill={pink} /><Circle cx={75} cy={17} r={5} fill={pink} /></>
      break
    case 'book':
      scene = <><G rotation={-5} origin="48,39"><Path d="M12 17Q31 11 48 22Q65 11 84 17V56Q63 52 48 63Q31 52 12 56Z" fill={ink} /><Path d="M17 12Q33 10 48 20V57Q33 48 17 51Z" fill={paper} /><Path d="M48 20Q63 10 79 12V51Q63 48 48 57Z" fill={pale} /><Path d="M24 23L38 27M24 32L38 36M58 27L71 23M58 36L71 32" stroke={ink} strokeWidth={2} strokeLinecap="round" /><Path d="M63 14V39L69 34L75 36V12" fill={pink} /></G></>
      break
    case 'school':
      scene = <><Path d="M37 18V13Q37 6 48 6Q59 6 59 13V18" fill="none" stroke={ink} strokeWidth={4} /><Rect x={25} y={16} width={46} height={49} rx={15} fill={ink} /><Rect x={34} y={39} width={28} height={20} rx={7} fill={pink} /><Path d="M40 46H56" stroke={paper} strokeWidth={2} strokeLinecap="round" /><Rect x={41} y={24} width={14} height={7} rx={3} fill={pale} /><Path d="M20 32V53M76 32V53" stroke={pale} strokeWidth={5} strokeLinecap="round" /></>
      break
    case 'palette':
      scene = <><Path d="M69 15C47 1 12 16 14 42C16 64 46 73 51 59C56 47 44 46 51 40C56 36 70 46 78 36C85 26 79 20 69 15Z" fill={ink} /><Circle cx={29} cy={33} r={5} fill={pale} /><Circle cx={43} cy={21} r={5} fill={pink} /><Circle cx={61} cy={22} r={5} fill={paper} /><Circle cx={29} cy={49} r={5} fill={paper} /><Path d="M66 63L78 39" stroke={pink} strokeWidth={6} strokeLinecap="round" /><Path d="M77 41L83 29L86 39L81 44Z" fill={paper} /></>
      break
    case 'plane':
      scene = <><Path d="M12 45Q37 69 72 50" fill="none" stroke={pink} strokeWidth={3} strokeLinecap="round" strokeDasharray="3 6" /><Path d="M14 30L81 11L58 60L45 40Z" fill={ink} /><Path d="M45 40L81 11L38 34Z" fill={pale} /><Path d="M45 40L44 57L53 48Z" fill={pink} /></>
      break
    case 'activity':
      scene = <><Circle cx={57} cy={15} r={8} fill={pink} /><Path d="M30 32L45 23L59 35L75 37M45 26L38 43L55 48L60 62M38 43L26 58L15 59" fill="none" stroke={ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" /><Path d="M14 24H25M10 32H20" stroke={pink} strokeWidth={3} strokeLinecap="round" /></>
      break
    default:
      scene = <G rotation={-8} origin="48,36"><Rect x={23} y={14} width={51} height={49} rx={9} fill={ink} /><Rect x={19} y={9} width={51} height={49} rx={9} fill={paper} /><Path d="M20 23H69" stroke={pale} strokeWidth={2} /><Path d="M31 6V15M57 6V15" stroke={ink} strokeWidth={4} strokeLinecap="round" /><Rect x={28} y={31} width={11} height={10} rx={3} fill={pink} /><Path d="M46 34H59M29 48H39M46 48H59" stroke={ink} strokeWidth={3} strokeLinecap="round" /><Circle cx={74} cy={14} r={5} fill={pink} /></G>
  }
  return <Svg width={size * 1.9} height={size * 1.5} viewBox="0 0 96 72" accessible={false}><Ellipse cx={48} cy={39} rx={43} ry={30} fill="#EEEAFB" />{scene}</Svg>
}
