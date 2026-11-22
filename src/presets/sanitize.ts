import type { Preset, PresetConfig } from './types'

const MAX_PRESETS = 50
type AnyRec = Record<string, unknown>
const isRec = (v: unknown): v is AnyRec => !!v && typeof v === 'object' && !Array.isArray(v)

const str = (v: unknown, max = 120): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

const bool = (v: unknown): boolean | undefined =>
  typeof v === 'boolean' ? v : undefined

const list = (v: unknown, max = 40): string[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const out = v
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((x) => x.trim().slice(0, 120))
    .slice(0, max)
  return out.length ? [...new Set(out)] : undefined
}

function sanitizeConfig(raw: unknown): PresetConfig {
  if (!isRec(raw)) return {}
  const c: PresetConfig = {
    target: str(raw.target),
    targetMethod: str(raw.targetMethod, 20),
    matrixMode: str(raw.matrixMode, 20),
    matrixMethod: str(raw.matrixMethod, 20),
    matrixMask: bool(raw.matrixMask),
    matrixAnnot: bool(raw.matrixAnnot),
    matrixSignif: bool(raw.matrixSignif),
    partialControls: list(raw.partialControls, 5),
    scatterX: str(raw.scatterX),
    scatterY: str(raw.scatterY),
    scatterColor: str(raw.scatterColor),
    scatterSize: str(raw.scatterSize),
    scatterTrend: bool(raw.scatterTrend),
    scatterLogX: bool(raw.scatterLogX),
    groupCol: str(raw.groupCol),
    groupVars: list(raw.groupVars),
    groupShowPoints: bool(raw.groupShowPoints),
    pairColor: str(raw.pairColor),
    pairDims: list(raw.pairDims, 6),
    distributionVar: str(raw.distributionVar),
    distributionGroup: str(raw.distributionGroup),
    distributionKde: bool(raw.distributionKde),
    distributionBins: str(raw.distributionBins, 10),
    categoryCol: str(raw.categoryCol),
    categoryStack: str(raw.categoryStack),
    categoryPercent: bool(raw.categoryPercent),
    radarGroup: str(raw.radarGroup),
    radarDims: list(raw.radarDims, 12),
    radarNorm: str(raw.radarNorm, 20),
    insightTarget: str(raw.insightTarget),
  }
  for (const key of Object.keys(c) as (keyof PresetConfig)[]) {
    if (c[key] === undefined) delete c[key]
  }
  return c
}

/** 校验从 localStorage / JSON 导入的自定义预设 */
export function sanitizePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return []
  const out: Preset[] = []
  const seen = new Set<string>()
  for (const item of raw.slice(0, MAX_PRESETS)) {
    if (!isRec(item)) continue
    const id = str(item.id, 80)
    const name = str(item.name, 60)
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name,
      description: str(item.description, 200),
      builtin: false,
      config: sanitizeConfig(item.config),
    })
  }
  return out
}
