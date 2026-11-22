export interface PresetConfig {
  target?: string
  targetMethod?: string
  matrixMode?: string
  matrixMethod?: string
  matrixMask?: boolean
  matrixAnnot?: boolean
  scatterX?: string
  scatterY?: string
  scatterColor?: string
  scatterSize?: string
  scatterTrend?: boolean
  scatterLogX?: boolean
  groupCol?: string
  groupVars?: string[]
  groupShowPoints?: boolean
  pairColor?: string
  pairDims?: string[]
  distributionVar?: string
  distributionGroup?: string
  distributionKde?: boolean
  distributionBins?: string
  categoryCol?: string
  categoryStack?: string
  categoryPercent?: boolean
  radarGroup?: string
  radarDims?: string[]
  radarNorm?: string
  insightTarget?: string
}

export interface Preset {
  id: string
  name: string
  description?: string
  builtin?: boolean
  config: PresetConfig
}

/** 收集预设里出现的所有列名，用于判断与当前数据的匹配度 */
export function presetColumns(p: Preset): string[] {
  const out: string[] = []
  const c = p.config
  const push = (v?: string) => {
    if (v) out.push(v)
  }
  push(c.target)
  push(c.scatterX)
  push(c.scatterY)
  push(c.scatterColor)
  push(c.scatterSize)
  push(c.groupCol)
  push(c.pairColor)
  push(c.distributionVar)
  push(c.distributionGroup)
  push(c.categoryCol)
  push(c.categoryStack)
  push(c.radarGroup)
  push(c.insightTarget)
  for (const k of [
    'groupVars',
    'pairDims',
    'radarDims',
  ] as const) {
    for (const v of c[k] || []) out.push(v)
  }
  return [...new Set(out)]
}
