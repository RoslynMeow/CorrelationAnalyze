import { pairsFromSlim, type WorkerColumn } from '@/lib/associations'
import type { AssocMethod } from '@/types'

interface RequestMessage {
  id: number
  method: AssocMethod
  columns: WorkerColumn[]
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<RequestMessage>) => void) | null
  postMessage: (msg: unknown) => void
}

ctx.onmessage = (e: MessageEvent<RequestMessage>) => {
  const { id, method, columns } = e.data
  try {
    ctx.postMessage({ id, pairs: pairsFromSlim(columns, method) })
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
