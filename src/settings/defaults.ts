export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'normal' | 'comfortable'
export type ShadowPreset = 'none' | 'soft' | 'strong'
export type ExportFormat = 'png' | 'svg'

export type ColorToken =
  | 'bg'
  | 'panel'
  | 'panel2'
  | 'text'
  | 'muted'
  | 'border'
  | 'accent'
  | 'accentSoft'
  | 'good'
  | 'bad'

export interface AppearanceSettings {
  mode: ThemeMode
  colors: Partial<Record<ColorToken, string>>
  /** null 表示使用默认圆角 */
  radius: number | null
  density: Density
  shadow: ShadowPreset
}

export interface TableSettings {
  headerBg: string | null
  border: string | null
  zebra: boolean
  /** 表格字号（px） */
  fontSize: number | null
}

export interface HeatmapColors {
  neg: string
  mid: string
  pos: string
  low: string
  high: string
}

export interface ChartSize {
  width?: number
  height?: number
}

export interface ChartSettings {
  palette: string[]
  heatmap: HeatmapColors
  grid: boolean
  transparent: boolean
  /** 全局图表宽度上限；null = 自适应 */
  defaultWidth: number | null
  /** chartId → 单图尺寸覆盖 */
  sizes: Record<string, ChartSize>
  /** chartId → 系列名（无名为 __default__）→ 颜色 */
  series: Record<string, Record<string, string>>
}

export interface ExportSettings {
  format: ExportFormat
  /** PNG 导出倍数 */
  scale: number
}

export interface TextSettings {
  /** 界面文案覆盖：key → 自定义文字（第 2 期启用） */
  overrides: Record<string, string>
}

export interface DataSettings {
  /** 原始列名 → 显示名（第 2 期启用） */
  columnAliases: Record<string, string>
  /** 原始列名 → 原始取值 → 显示值（第 2 期启用） */
  valueAliases: Record<string, Record<string, string>>
}

export interface Settings {
  version: 1
  appearance: AppearanceSettings
  table: TableSettings
  charts: ChartSettings
  exportSettings: ExportSettings
  text: TextSettings
  data: DataSettings
}

export const TOKEN_VARS: Record<ColorToken, string> = {
  bg: '--bg',
  panel: '--panel',
  panel2: '--panel-2',
  text: '--text',
  muted: '--muted',
  border: '--border',
  accent: '--accent',
  accentSoft: '--accent-soft',
  good: '--good',
  bad: '--bad',
}

export interface PalettePreset {
  id: string
  name: string
  colors: string[]
}

export const PALETTES: PalettePreset[] = [
  {
    id: 'default',
    name: '默认',
    colors: [
      '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f',
      '#e5c494', '#b3b3b3', '#80b1d3', '#fb8072', '#bebada', '#1b9e77',
    ],
  },
  {
    id: 'soft',
    name: '柔和',
    colors: [
      '#8ecae6', '#ffb703', '#90be6d', '#f4a261', '#a78bfa', '#f28482',
      '#84a59d', '#c9ada7', '#9db4c0', '#e8c1a0', '#b8c0ff', '#a3c4bc',
    ],
  },
  {
    id: 'vivid',
    name: '鲜明',
    colors: [
      '#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#457b9d', '#7209b7',
      '#3a86ff', '#ff006e', '#8338ec', '#06d6a0', '#fb5607', '#118ab2',
    ],
  },
  {
    id: 'colorblind',
    name: '色盲友好',
    colors: [
      '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00',
      '#F0E442', '#000000', '#999999', '#117733', '#882255', '#44AA99',
    ],
  },
]

export const DEFAULT_HEATMAP: HeatmapColors = {
  neg: '#60a5fa',
  mid: '#f8fafc',
  pos: '#f87171',
  low: '#f8fafc',
  high: '#60a5fa',
}

export function defaultSettings(): Settings {
  return {
    version: 1,
    appearance: {
      mode: 'system',
      colors: {},
      radius: null,
      density: 'normal',
      shadow: 'soft',
    },
    table: {
      headerBg: null,
      border: null,
      zebra: false,
      fontSize: null,
    },
    charts: {
      palette: [...PALETTES[0].colors],
      heatmap: { ...DEFAULT_HEATMAP },
      grid: true,
      transparent: true,
      defaultWidth: null,
      sizes: {},
      series: {},
    },
    exportSettings: {
      format: 'png',
      scale: 2,
    },
    text: { overrides: {} },
    data: { columnAliases: {}, valueAliases: {} },
  }
}
