export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** 两个十六进制颜色按比例混合，t=0 取 a，t=1 取 b */
export function mixHex(a: string, b: string, t: number): string {
  if (!isHexColor(a) || !isHexColor(b)) return a
  const pa = parseHex(a)
  const pb = parseHex(b)
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** 转为 Plotly 可用的小数透明度颜色；非 hex 原样返回 */
export function withAlpha(color: string, alpha: number): string {
  if (!isHexColor(color)) return color
  return color + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

/** 热力图：负 → 中 → 正 的五段发散色阶 */
export function divergingScale(
  neg: string,
  mid: string,
  pos: string,
): [number, string][] {
  return [
    [0, neg],
    [0.25, mixHex(neg, mid, 0.5)],
    [0.5, mid],
    [0.75, mixHex(mid, pos, 0.5)],
    [1, pos],
  ]
}

/** 热力图：低 → 高 的顺序色阶 */
export function sequentialScale(low: string, high: string): [number, string][] {
  return [
    [0, low],
    [0.5, mixHex(low, high, 0.5)],
    [1, high],
  ]
}
