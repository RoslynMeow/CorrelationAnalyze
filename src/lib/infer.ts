import { describe } from './stats'
import { isNull, toNum, toTime, uniq, countBy } from './format'
import type { Column, ColumnType, Dataset } from '@/types'

/** 常见有序等级词表（顺序即大小） */
const ORDERS = [
  ['low', 'medium', 'high', 'very high'],
  ['low', 'mid', 'medium', 'high', 'critical'],
  ['very low', 'low', 'medium', 'high', 'very high'],
  ['低', '较低', '中', '中等', '较高', '高', '极高'],
  ['低风险', '中风险', '高风险'],
  ['none', 'mild', 'moderate', 'severe'],
  ['weak', 'moderate', 'strong'],
  ['poor', 'fair', 'good', 'excellent'],
  ['no', 'maybe', 'yes'],
  ['false', 'true'],
  ['small', 'medium', 'large'],
]

export function buildColumn(name: string, raw: string[]): Column {
  const nn = raw.filter((v) => !isNull(v))
  const nums = nn.map(toNum)
  const allNum = nn.length > 0 && nums.every((v) => v !== null)
  const times = nn.map(toTime)
  const allDate = !allNum && nn.length > 0 && times.every((v) => v !== null)

  const type: ColumnType = allNum ? 'number' : allDate ? 'date' : 'category'
  const num =
    type === 'number' ? raw.map(toNum) : type === 'date' ? raw.map(toTime) : null

  const uniqueVals: string[] = []
  const seen = new Set<string>()
  for (const v of raw) {
    if (isNull(v)) continue
    const s = String(v).trim()
    if (!seen.has(s)) {
      seen.add(s)
      uniqueVals.push(s)
    }
  }

  const col: Column = {
    name,
    raw,
    type,
    num,
    labels: type === 'category' ? raw.map((v) => (isNull(v) ? null : String(v).trim())) : null,
    unique: uniqueVals,
    uniqueCount: uniqueVals.length,
    missing: raw.filter((v) => isNull(v)).length,
    total: raw.length,
    isId: false,
  }

  if (type === 'number' && num) {
    const s = describe(num)
    if (s) {
      col.mean = s.mean
      col.sd = s.sd
      col.min = s.min
      col.max = s.max
      col.median = s.median
    }
  }
  return col
}

/** 行数上限：读取前 100,000 行（单文件版行为保持一致） */
export const MAX_ROWS = 100000

export function buildDataset(
  name: string,
  headers: string[],
  rowsIn: string[][],
  maxRows = MAX_ROWS,
): Dataset {
  const truncated = rowsIn.length > maxRows
  const rows = truncated ? rowsIn.slice(0, maxRows) : rowsIn
  const n = rows.length
  const columns = headers.map((h, ci) => {
    const col = buildColumn(h, rows.map((r) => r[ci] ?? ''))
    col.isId = isIdCol(col, n)
    return col
  })
  return { name, headers, rows, n, columns, truncated }
}

/** 列名像 id 且每行唯一 → 视为 ID 列，不参与统计 */
export function isIdCol(col: Column, totalRows: number): boolean {
  if (col.uniqueCount !== totalRows || totalRows < 2) return false
  const n = col.name.trim()
  return /^(id|编号|序号|index)$/i.test(n) || /(^|_)(id|编号|序号)$/i.test(n)
}

/** 类别显示顺序：有序等级 → 数值 → 频次，缺失值放最后 */
export function groupLabels(col: Column): string[] {
  const MISS = '(缺失)'
  const vals = col.raw.map((v) => (isNull(v) ? MISS : String(v).trim()))
  const present = uniq(vals)
  const nonNull = present.filter((v) => v !== MISS)
  const lower = new Map(nonNull.map((v) => [v, v.toLowerCase()]))
  let ordered: string[] | null = null

  for (const o of ORDERS) {
    if (nonNull.length && nonNull.every((v) => o.includes(lower.get(v) || ''))) {
      ordered = nonNull.slice().sort((a, b) => o.indexOf(lower.get(a)!) - o.indexOf(lower.get(b)!))
      break
    }
  }
  if (!ordered && nonNull.length && nonNull.every((v) => toNum(v) !== null)) {
    ordered = nonNull.slice().sort((a, b) => (toNum(a) as number) - (toNum(b) as number))
  }
  if (!ordered) {
    const c = countBy(vals)
    ordered = nonNull.slice().sort((a, b) => c[b] - c[a] || a.localeCompare(b, 'zh-CN'))
  }
  if (present.includes(MISS)) ordered.push(MISS)
  return ordered
}

export const numericCols = (ds: Dataset): Column[] =>
  ds.columns.filter((c) => c.type === 'number' && c.uniqueCount > 1 && !c.isId)

export const categoryCols = (ds: Dataset): Column[] =>
  ds.columns.filter((c) => c.type === 'category' && c.uniqueCount >= 2 && !c.isId)

export const dateCols = (ds: Dataset): Column[] =>
  ds.columns.filter((c) => c.type === 'date' && !c.isId)

export const groupCols = (ds: Dataset): Column[] =>
  ds.columns.filter((c) => {
    if (c.isId) return false
    if (c.uniqueCount < 2 || c.uniqueCount > 40) return false
    return c.type !== 'number' || c.uniqueCount <= 12
  })

/** 参与关联分析的列（数值 + 类别，排除 ID / 常量列） */
export const assocCols = (ds: Dataset): Column[] =>
  ds.columns.filter(
    (c) => (c.type === 'number' || c.type === 'category') && c.uniqueCount > 1 && !c.isId,
  )

export const targetCols = (ds: Dataset): Column[] =>
  assocCols(ds).filter((c) => c.type === 'number' || c.uniqueCount <= 50)

export const colByName = (ds: Dataset, name: string): Column | undefined =>
  ds.columns.find((c) => c.name === name)

export function pickDefault(list: Column[], re: RegExp): string {
  return (list.find((c) => re.test(c.name)) || list[0] || ({} as Column)).name || ''
}

/** 目标变量的默认猜测：风险/标签类 > 数值评分类 > class/level 类 > 第一个数值列 */
export function pickTarget(list: Column[]): string {
  const strong = list.find((c) => /(risk|target|label|outcome|churn)/i.test(c.name))
  if (strong) return strong.name
  const numGoal = list.find(
    (c) =>
      c.type === 'number' &&
      /(score|rating|revenue|sales|price|amount|value|profit|total|cost)/i.test(c.name),
  )
  if (numGoal) return numGoal.name
  const weak = list.find((c) => /(class|level|status|grade)/i.test(c.name))
  if (weak) return weak.name
  return (list.find((c) => c.type === 'number') || list[0] || ({} as Column)).name || ''
}

/** 分组列的默认猜测 */
export function pickGroup(list: Column[]): string {
  return (
    list.find((c) => /(risk|target|outcome|label|class|level|status)/i.test(c.name)) ||
    list.find((c) => /(group|segment|type|gender|category|region)/i.test(c.name)) ||
    list.find((c) => c.type === 'category') ||
    list[0] ||
    ({} as Column)
  ).name || ''
}

/** 优先选健康/压力/睡眠等主题相关的数值列作默认勾选 */
export function preferredNums(list: Column[], k: number): string[] {
  const key = /stress|anxiety|depress|burnout|mental|sleep|study|performance|pressure|support|hours/i
  return list
    .slice()
    .sort((x, y) => (key.test(y.name) ? 1 : 0) - (key.test(x.name) ? 1 : 0))
    .slice(0, k)
    .map((c) => c.name)
}
