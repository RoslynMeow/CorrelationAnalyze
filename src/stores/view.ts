import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Dataset } from '@/types'
import {
  categoryCols,
  colByName,
  groupCols,
  numericCols,
  pickDefault,
  pickGroup,
  pickTarget,
  preferredNums,
  targetCols,
} from '@/lib/infer'
import type { PresetConfig } from '@/presets/types'
import { useSettingsStore } from './settings'

export const useViewStore = defineStore('view', () => {
  /* 目标关联 */
  const targetCol = ref('')
  const targetMethod = ref('pearson')

  /* 相关矩阵 */
  const matrixMode = ref('num')
  const matrixMethod = ref('pearson')
  const matrixMask = ref(true)
  const matrixAnnot = ref(true)
  const matrixSignif = ref(false)

  /* 散点 */
  const scatterX = ref('')
  const scatterY = ref('')
  const scatterColor = ref('')
  const scatterSize = ref('')
  const scatterTrend = ref(true)
  const scatterLogX = ref(false)

  /* 分组对比 */
  const groupCol = ref('')
  const groupVars = ref<string[]>([])
  const groupShowPoints = ref(false)

  /* 成对关系 */
  const pairColor = ref('')
  const pairDims = ref<string[]>([])

  /* 分布 */
  const distributionVar = ref('')
  const distributionGroup = ref('')
  const distributionKde = ref(true)
  const distributionBins = ref('0')

  /* 类别计数 */
  const categoryCol = ref('')
  const categoryStack = ref('')
  const categoryPercent = ref(false)

  /* 雷达 */
  const radarGroup = ref('')
  const radarDims = ref<string[]>([])
  const radarNorm = ref('minmax')

  /* 分析结论 */
  const insightTarget = ref('')

  const settings = useSettingsStore()

  // 选择变化时写入当前文件的配置
  watch(
    [
      targetCol,
      targetMethod,
      matrixMode,
      matrixMethod,
      matrixMask,
      matrixAnnot,
      matrixSignif,
      scatterX,
      scatterY,
      scatterColor,
      scatterSize,
      scatterTrend,
      scatterLogX,
      groupCol,
      groupVars,
      groupShowPoints,
      pairColor,
      pairDims,
      distributionVar,
      distributionGroup,
      distributionKde,
      distributionBins,
      categoryCol,
      categoryStack,
      categoryPercent,
      radarGroup,
      radarDims,
      radarNorm,
      insightTarget,
    ],
    () => {
      if (!settings.activeProfileKey) return
      settings.saveProfileView(snapshot())
    },
    { deep: true },
  )

  function init(ds: Dataset): void {
    const nums = numericCols(ds)
    const groups = groupCols(ds)
    const cats = categoryCols(ds)
    const targets = targetCols(ds)
    const numsNames = nums.map((c) => c.name)

    targetCol.value = pickTarget(targets)
    targetMethod.value = 'pearson'

    matrixMode.value = 'num'
    matrixMethod.value = 'pearson'
    matrixMask.value = true
    matrixAnnot.value = true
    matrixSignif.value = false

    scatterX.value = pickDefault(nums, /stress|hours|score/i)
    scatterY.value = pickDefault(
      nums.filter((c) => c.name !== scatterX.value),
      /index|performance|score|value|rate/i,
    )
    scatterColor.value = pickGroup(groups)
    scatterSize.value = ''
    scatterTrend.value = true
    scatterLogX.value = false

    groupCol.value = pickGroup(groups)
    groupVars.value = preferredNums(nums, 6)
    groupShowPoints.value = false

    pairColor.value = pickGroup(groups)
    pairDims.value = preferredNums(nums, 4)

    distributionVar.value = numsNames[0] || ''
    distributionGroup.value = ''
    distributionKde.value = true
    distributionBins.value = '0'

    categoryCol.value = cats[0]?.name || groups[0]?.name || ''
    categoryStack.value = ''
    categoryPercent.value = false

    radarGroup.value = pickGroup(groups)
    radarDims.value = preferredNums(nums, 8)
    radarNorm.value = 'minmax'

    insightTarget.value = targetCol.value
  }

  function apply(config: PresetConfig, ds: Dataset): void {
    const nums = numericCols(ds)
    const groups = groupCols(ds)
    const cats = categoryCols(ds)
    const numNames = new Set(nums.map((c) => c.name))
    const groupNames = new Set(groups.map((c) => c.name))
    const catNames = new Set(cats.map((c) => c.name))
    const anyCol = (name?: string): boolean => !!name && !!colByName(ds, name)
    const isNum = (name?: string): boolean => !!name && numNames.has(name)
    const isGroup = (name?: string): boolean => !!name && groupNames.has(name)

    if (anyCol(config.target)) targetCol.value = config.target as string
    if (config.targetMethod === 'pearson' || config.targetMethod === 'spearman') {
      targetMethod.value = config.targetMethod
    }
    if (anyCol(config.insightTarget)) insightTarget.value = config.insightTarget as string
    else insightTarget.value = targetCol.value

    if (config.matrixMode === 'num' || config.matrixMode === 'cat') {
      matrixMode.value = config.matrixMode
    }
    if (config.matrixMethod === 'pearson' || config.matrixMethod === 'spearman') {
      matrixMethod.value = config.matrixMethod
    }
    if (typeof config.matrixMask === 'boolean') matrixMask.value = config.matrixMask
    if (typeof config.matrixAnnot === 'boolean') matrixAnnot.value = config.matrixAnnot
    if (typeof config.matrixSignif === 'boolean') matrixSignif.value = config.matrixSignif

    if (anyCol(config.scatterX)) scatterX.value = config.scatterX as string
    if (isNum(config.scatterY)) scatterY.value = config.scatterY as string
    if (isGroup(config.scatterColor)) scatterColor.value = config.scatterColor as string
    if (isNum(config.scatterSize)) scatterSize.value = config.scatterSize as string
    if (typeof config.scatterTrend === 'boolean') scatterTrend.value = config.scatterTrend
    if (typeof config.scatterLogX === 'boolean') scatterLogX.value = config.scatterLogX

    if (isGroup(config.groupCol)) groupCol.value = config.groupCol as string
    if (config.groupVars) {
      const vars = config.groupVars.filter((n) => numNames.has(n))
      if (vars.length) groupVars.value = vars
    }
    if (typeof config.groupShowPoints === 'boolean') {
      groupShowPoints.value = config.groupShowPoints
    }

    if (isGroup(config.pairColor)) pairColor.value = config.pairColor as string
    if (config.pairDims) {
      const dims = config.pairDims.filter((n) => numNames.has(n)).slice(0, 6)
      if (dims.length >= 2) pairDims.value = dims
    }

    if (isNum(config.distributionVar)) distributionVar.value = config.distributionVar as string
    if (isGroup(config.distributionGroup)) {
      distributionGroup.value = config.distributionGroup as string
    }
    if (typeof config.distributionKde === 'boolean') {
      distributionKde.value = config.distributionKde
    }
    if (config.distributionBins) distributionBins.value = config.distributionBins

    if (anyCol(config.categoryCol) && (catNames.has(config.categoryCol as string) || groupNames.has(config.categoryCol as string))) {
      categoryCol.value = config.categoryCol as string
    }
    if (isGroup(config.categoryStack) && config.categoryStack !== categoryCol.value) {
      categoryStack.value = config.categoryStack as string
    }
    if (typeof config.categoryPercent === 'boolean') {
      categoryPercent.value = config.categoryPercent
    }

    if (isGroup(config.radarGroup)) radarGroup.value = config.radarGroup as string
    if (config.radarDims) {
      const dims = config.radarDims.filter((n) => numNames.has(n)).slice(0, 12)
      if (dims.length >= 3) radarDims.value = dims
    }
    if (config.radarNorm === 'minmax' || config.radarNorm === 'zscore') {
      radarNorm.value = config.radarNorm
    }
  }

  function snapshot(): PresetConfig {
    return {
      target: targetCol.value || undefined,
      targetMethod: targetMethod.value,
      matrixMode: matrixMode.value,
      matrixMethod: matrixMethod.value,
      matrixMask: matrixMask.value,
      matrixAnnot: matrixAnnot.value,
      matrixSignif: matrixSignif.value,
      scatterX: scatterX.value || undefined,
      scatterY: scatterY.value || undefined,
      scatterColor: scatterColor.value || undefined,
      scatterSize: scatterSize.value || undefined,
      scatterTrend: scatterTrend.value,
      scatterLogX: scatterLogX.value,
      groupCol: groupCol.value || undefined,
      groupVars: [...groupVars.value],
      groupShowPoints: groupShowPoints.value,
      pairColor: pairColor.value || undefined,
      pairDims: [...pairDims.value],
      distributionVar: distributionVar.value || undefined,
      distributionGroup: distributionGroup.value || undefined,
      distributionKde: distributionKde.value,
      distributionBins: distributionBins.value,
      categoryCol: categoryCol.value || undefined,
      categoryStack: categoryStack.value || undefined,
      categoryPercent: categoryPercent.value,
      radarGroup: radarGroup.value || undefined,
      radarDims: [...radarDims.value],
      radarNorm: radarNorm.value,
      insightTarget: insightTarget.value || undefined,
    }
  }

  function reset(): void {
    targetCol.value = ''
    targetMethod.value = 'pearson'
    matrixMode.value = 'num'
    matrixMethod.value = 'pearson'
    matrixMask.value = true
    matrixAnnot.value = true
    matrixSignif.value = false
    scatterX.value = ''
    scatterY.value = ''
    scatterColor.value = ''
    scatterSize.value = ''
    scatterTrend.value = true
    scatterLogX.value = false
    groupCol.value = ''
    groupVars.value = []
    groupShowPoints.value = false
    pairColor.value = ''
    pairDims.value = []
    distributionVar.value = ''
    distributionGroup.value = ''
    distributionKde.value = true
    distributionBins.value = '0'
    categoryCol.value = ''
    categoryStack.value = ''
    categoryPercent.value = false
    radarGroup.value = ''
    radarDims.value = []
    radarNorm.value = 'minmax'
    insightTarget.value = ''
  }

  return {
    targetCol,
    targetMethod,
    matrixMode,
    matrixMethod,
    matrixMask,
    matrixAnnot,
    matrixSignif,
    scatterX,
    scatterY,
    scatterColor,
    scatterSize,
    scatterTrend,
    scatterLogX,
    groupCol,
    groupVars,
    groupShowPoints,
    pairColor,
    pairDims,
    distributionVar,
    distributionGroup,
    distributionKde,
    distributionBins,
    categoryCol,
    categoryStack,
    categoryPercent,
    radarGroup,
    radarDims,
    radarNorm,
    insightTarget,
    init,
    apply,
    snapshot,
    reset,
  }
})
