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
import { t } from '@/i18n'
import { useSettingsStore } from './settings'
import { useViewStore } from './view'

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
    dataset.value
      ? `${fileName.value} · ${t('{rows} 行 × {cols} 列', {
          rows: dataset.value.n,
          cols: dataset.value.headers.length,
        })}`
      : '',
  )

  function column(name: string): Column | undefined {
    return dataset.value ? colByName(dataset.value, name) : undefined
  }

  function applyData(headers: string[], rows: string[][], name: string): void {
    if (!headers.length) throw new Error(t('没有解析到表头'))
    const ds = buildDataset(name, headers, rows)
    dataset.value = ds
    fileName.value = name
    const settings = useSettingsStore()
    const view = useViewStore()
    settings.activateProfile(ds.headers, name)
    view.init(ds)
    if (settings.activeProfile?.view) view.apply(settings.activeProfile.view, ds)
    datasetId.value++
    pairCache.value = {}
    error.value = ''
    document.title = `${name} · ${t('关联性分析')}`
    if (ds.truncated) {
      toast(t('数据超过 {n} 行，仅载入前 {n} 行', { n: ds.n.toLocaleString('zh-CN') }), 4000)
    }
  }

  async function loadFile(file: File): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const text = await readTextSmart(file)
      const { headers, rows, delim } = parseCSV(text)
      applyData(headers, rows, file.name.replace(/\.(csv|tsv|txt)$/i, ''))
      const sepNote =
        delim !== ','
          ? t('（分隔符：{d}）', { d: delim === '\t' ? 'Tab' : delim })
          : ''
      toast(
        t('已载入 {rows} 行 × {cols} 列{note}', {
          rows: rows.length.toLocaleString('zh-CN'),
          cols: headers.length,
          note: sepNote,
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = t('读取失败：{msg}', { msg })
      toast(error.value, 4500)
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    dataset.value = null
    fileName.value = ''
    pairCache.value = {}
    error.value = ''
    useSettingsStore().activateProfile(null)
    useViewStore().reset()
    document.title = t('关联性分析')
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
    reset,
    ensurePairs,
    cachedPairs,
    assocWithTarget,
  }
})
