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

export interface AssocResult {
  /** 0–1 的关联强度 */
  strength: number
  /** r / ρ 的有符号值；V / η 为 null */
  signed: number | null
  type: AssocType
  n: number
}

export interface PairAssoc extends AssocResult {
  a: string
  b: string
}
