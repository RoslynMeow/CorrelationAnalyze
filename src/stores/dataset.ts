import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { parseCSV, readTextSmart } from '@/lib/csv'
import {
  assocCols,
  categoryCols,
  colByName,
  dateCols,
  groupCols,
  numericCols,
  targetCols,
  buildDataset,
} from '@/lib/infer'
import { assoc, computePairs, slimColumns } from '@/lib/associations'
import AssociationsWorker from '@/workers/associations.worker?worker&inline'
import type { AssocMethod, Column, Dataset, PairAssoc } from '@/types'
import { toast } from '@/composables/useToast'

interface PendingCall {
  resolve: (pairs: PairAssoc[]) => void
  reject: (err: Error) => void
}

export const useDatasetStore = defineStore('dataset', () => {
  const dataset = shallowRef<Dataset | null>(null)
  const fileName = ref('')
  const datasetId = ref(0)
  const loading = ref(false)
  const error = ref('')

  /** 按方法缓存的全量变量对（worker 计算） */
  const pairCache = ref<Partial<Record<AssocMethod, PairAssoc[]>>>({})
  const computing = ref(false)

  const hasData = computed(() => !!dataset.value)
  const n = computed(() => dataset.value?.n ?? 0)
  const nums = computed<Column[]>(() => (dataset.value ? numericCols(dataset.value) : []))
  const cats = computed<Column[]>(() => (dataset.value ? categoryCols(dataset.value) : []))
  const dates = computed<Column[]>(() => (dataset.value ? dateCols(dataset.value) : []))
  const groups = computed<Column[]>(() => (dataset.value ? groupCols(dataset.value) : []))
  const assocs = computed<Column[]>(() => (dataset.value ? assocCols(dataset.value) : []))
  const targets = computed<Column[]>(() => (dataset.value ? targetCols(dataset.value) : []))
  const chipTitle = computed(() =>
    dataset.value ? `${fileName.value} · ${dataset.value.n} 行 × ${dataset.value.headers.length} 列` : '',
  )

  function column(name: string): Column | undefined {
    return dataset.value ? colByName(dataset.value, name) : undefined
  }

  function applyData(headers: string[], rows: string[][], name: string): void {
    if (!headers.length) throw new Error('没有解析到表头')
    const ds = buildDataset(name, headers, rows)
    dataset.value = ds
    fileName.value = name
    datasetId.value++
    pairCache.value = {}
    error.value = ''
    document.title = `${name} · 关联性分析`
    if (ds.truncated) {
      toast(`数据超过 ${ds.n.toLocaleString('zh-CN')} 行，仅载入前 ${ds.n.toLocaleString('zh-CN')} 行`, 4000)
    }
  }

  async function loadFile(file: File): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const text = await readTextSmart(file)
      const { headers, rows, delim } = parseCSV(text)
      applyData(headers, rows, file.name.replace(/\.(csv|tsv|txt)$/i, ''))
      const sepNote = delim !== ',' ? `（分隔符：${delim === '\t' ? 'Tab' : delim}）` : ''
      toast(`已载入 ${rows.length.toLocaleString('zh-CN')} 行 × ${headers.length} 列${sepNote}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = '读取失败：' + msg
      toast(error.value, 4500)
    } finally {
      loading.value = false
    }
  }

  async function loadSample(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch('./test.csv')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const { headers, rows } = parseCSV(text)
      applyData(headers, rows, '示例数据 test')
      toast(`已载入示例数据 ${rows.length} 行 × ${headers.length} 列`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = `示例数据不可用（${msg}），请选择本地 CSV`
      toast(error.value, 4000)
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    dataset.value = null
    fileName.value = ''
    pairCache.value = {}
    error.value = ''
    document.title = '关联性分析'
  }

  /* ---------------- 变量对计算（Web Worker + 主线程回退） ---------------- */

  let worker: Worker | null = null
  let seq = 0
  const pending = new Map<number, PendingCall>()

  function getWorker(): Worker {
    if (worker) return worker
    // inline worker：打包进主包，单文件版也能离线运行
    worker = new AssociationsWorker()
    worker.onmessage = (e: MessageEvent<{ id: number; pairs?: PairAssoc[]; error?: string }>) => {
      const call = pending.get(e.data.id)
      if (!call) return
      pending.delete(e.data.id)
      if (e.data.error) call.reject(new Error(e.data.error))
      else call.resolve(e.data.pairs || [])
    }
    worker.onerror = () => {
      const calls = Array.from(pending.values())
      pending.clear()
      calls.forEach((c) => c.reject(new Error('worker error')))
      worker?.terminate()
      worker = null
    }
    return worker
  }

  async function runPairs(cols: Column[], method: AssocMethod): Promise<PairAssoc[]> {
    try {
      const w = getWorker()
      const id = ++seq
      return await new Promise<PairAssoc[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error('worker timeout'))
        }, 30000)
        pending.set(id, {
          resolve: (pairs) => {
            clearTimeout(timer)
            resolve(pairs)
          },
          reject: (err) => {
            clearTimeout(timer)
            reject(err)
          },
        })
        w.postMessage({ id, method, columns: slimColumns(cols) })
      })
    } catch {
      // Worker 不可用（稀有环境）时回退主线程
      return computePairs(cols, method)
    }
  }

  const inflight = new Map<string, Promise<PairAssoc[]>>()

  /** 确保指定方法的全量变量对已计算；重复调用复用同一任务 */
  function ensurePairs(method: AssocMethod): Promise<PairAssoc[]> {
    const cached = pairCache.value[method]
    if (cached) return Promise.resolve(cached)
    const ds = dataset.value
    if (!ds) return Promise.resolve([])
    const cols = assocCols(ds)
    if (cols.length < 2) return Promise.resolve([])

    const myId = datasetId.value
    const key = `${myId}:${method}`
    let task = inflight.get(key)
    if (!task) {
      computing.value = true
      task = runPairs(cols, method).then((pairs) => {
        if (myId === datasetId.value) pairCache.value = { ...pairCache.value, [method]: pairs }
        inflight.delete(key)
        computing.value = inflight.size > 0
        return pairs
      })
      inflight.set(key, task)
    }
    return task
  }

  function cachedPairs(method: AssocMethod): PairAssoc[] {
    return pairCache.value[method] ?? []
  }

  /** 单列与目标的关联（不缓存，O(n)） */
  function assocWithTarget(target: Column, method: AssocMethod = 'pearson') {
    const ds = dataset.value
    if (!ds) return []
    return assocCols(ds)
      .filter((c) => c.name !== target.name)
      .map((c) => {
        const a = assoc(target, c, method)
        return a ? { name: c.name, ...a } : null
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((x, y) => y.strength - x.strength)
  }

  return {
    dataset,
    fileName,
    datasetId,
    loading,
    error,
    computing,
    pairCache,
    hasData,
    n,
    nums,
    cats,
    dates,
    groups,
    assocs,
    targets,
    chipTitle,
    column,
    loadFile,
    loadSample,
    reset,
    ensurePairs,
    cachedPairs,
    assocWithTarget,
  }
})
