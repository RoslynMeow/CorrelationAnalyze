export type ColumnType = 'number' | 'date' | 'category'

export interface Descriptive {
  n: number
  mean: number
  sd: number
  min: number
  max: number
  median: number
  q1: number
  q3: number
}

export interface Column {
  name: string
  raw: string[]
  type: ColumnType
  /** 数值 / 日期列的时间戳（毫秒）；类别列为 null */
  num: (number | null)[] | null
  /** 类别列的字符串标签；数值 / 日期列为 null */
  labels: (string | null)[] | null
  unique: string[]
  uniqueCount: number
  missing: number
  total: number
  /** 是否为 ID 列（唯一值等于行数且列名像 id） */
  isId: boolean
  mean?: number
  sd?: number
  min?: number
  max?: number
  median?: number
}

export interface Dataset {
  name: string
  headers: string[]
  rows: string[][]
  n: number
  columns: Column[]
  /** 是否因为超过行数上限而被截断 */
  truncated: boolean
}

export type AssocMethod = 'pearson' | 'spearman'
export type AssocType = 'r' | 'ρ' | 'V' | 'η'

export type FilterRule =
  | { type: 'number'; column: string; min: number | null; max: number | null }
  | { type: 'date'; column: string; min: string; max: string }
  | { type: 'category'; column: string; values: string[]; includeMissing?: boolean }

export interface AssocResult {
  /** 0–1 的关联强度 */
  strength: number
  /** r / ρ 的有符号值；V / η 为 null */
  signed: number | null
  type: AssocType
  n: number
  /** 双侧 p 值（r/ρ：相关为 0；V：独立性；η：各组均值相等） */
  p: number | null
  /** r / ρ 的 95% Fisher z 置信区间；V / η 为 null */
  ci: [number, number] | null
}

export interface PairAssoc extends AssocResult {
  a: string
  b: string
  /** Benjamini–Hochberg FDR 校正后的 q 值 */
  q?: number | null
}
