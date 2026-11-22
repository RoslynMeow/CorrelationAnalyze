import { describe, expect, it } from 'vitest'
import { decodeShare, encodeShare, shareUrl } from '@/lib/share'

describe('视图分享链接', () => {
  it('编码后可还原页签与视图选择', () => {
    const raw = encodeShare(
      'target',
      {
        target: 'risk_level',
        targetMethod: 'spearman',
        groupVars: ['stress_level', 'sleep_hours'],
        matrixSignif: true,
        partialControls: ['sleep_hours'],
      },
      [{ type: 'category', column: 'gender', values: ['Female'] }],
    )
    const out = decodeShare(raw)!
    expect(out.tab).toBe('target')
    expect(out.view).toMatchObject({
      target: 'risk_level',
      targetMethod: 'spearman',
      groupVars: ['stress_level', 'sleep_hours'],
      matrixSignif: true,
      partialControls: ['sleep_hours'],
    })
    expect(out.filter?.[0]).toMatchObject({
      type: 'category',
      column: 'gender',
      values: ['Female'],
    })
  })

  it('拒绝损坏 / 超长 / 未知版本', () => {
    expect(decodeShare(null)).toBeNull()
    expect(decodeShare('')).toBeNull()
    expect(decodeShare('not-base64')).toBeNull()
    expect(decodeShare('x'.repeat(9000))).toBeNull()
    const wrongVersion = btoa(JSON.stringify({ v: 2, tab: 'target', view: {} }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeShare(wrongVersion)).toBeNull()
  })

  it('丢弃非法字段并限制列表长度', () => {
    const raw = encodeShare('matrix', {
      target: 'x'.repeat(500),
      matrixMask: 'yes' as unknown as boolean,
      groupVars: Array.from({ length: 60 }, (_, i) => `c${i}`),
    })
    const out = decodeShare(raw)!
    expect(out.view.target!.length).toBe(120)
    expect(out.view.matrixMask).toBeUndefined()
    expect(out.view.groupVars!.length).toBe(40)
  })

  it('生成链接时清掉旧参数与 hash', () => {
    const url = shareUrl('https://example.com/app/?view=old&x=1#target', 'group', {
      groupCol: 'risk_level',
    })
    const parsed = new URL(url)
    expect(parsed.hash).toBe('')
    expect(parsed.searchParams.get('x')).toBeNull()
    const out = decodeShare(parsed.searchParams.get('view'))!
    expect(out.tab).toBe('group')
    expect(out.view.groupCol).toBe('risk_level')
  })
})
