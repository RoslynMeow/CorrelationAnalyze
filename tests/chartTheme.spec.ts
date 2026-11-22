import { describe, expect, it } from 'vitest'
import { applyLegendPosition, legendLayoutFor } from '@/lib/chartTheme'

function layout(): Record<string, unknown> {
  return {
    margin: { l: 64, r: 24, t: 46, b: 56 },
    legend: { font: { size: 11, color: '#888' } },
    showlegend: true,
  }
}

describe('图例位置', () => {
  it('底部图例使用容器坐标并留足底部边距', () => {
    const lay = layout()
    applyLegendPosition(lay, 'bottom')
    const legend = lay.legend as Record<string, unknown>
    const margin = lay.margin as Record<string, number>
    expect(legend.yref).toBe('container')
    expect(legend.y).toBe(0.01)
    expect(legend.yanchor).toBe('bottom')
    expect(legend.font).toEqual({ size: 11, color: '#888' })
    expect(margin.b).toBe(96)
  })

  it('顶部 / 右侧使用对应边距，隐藏会关闭图例', () => {
    const top = layout()
    applyLegendPosition(top, 'top')
    expect((top.margin as Record<string, number>).t).toBe(72)

    const right = layout()
    applyLegendPosition(right, 'right')
    expect((right.margin as Record<string, number>).r).toBe(150)

    const hidden = layout()
    applyLegendPosition(hidden, 'hidden')
    expect(hidden.showlegend).toBe(false)
  })

  it('有标题时顶部图例留更多空间', () => {
    const lay = layout()
    lay.title = { text: '标题' }
    applyLegendPosition(lay, 'top')
    expect((lay.margin as Record<string, number>).t).toBe(96)
  })

  it('没有图例的图不额外增加边距', () => {
    const lay = layout()
    lay.showlegend = false
    applyLegendPosition(lay, 'bottom')
    expect((lay.margin as Record<string, number>).b).toBe(56)
  })

  it('legendLayoutFor 覆盖四种位置', () => {
    expect(legendLayoutFor('bottom').yref).toBe('container')
    expect(legendLayoutFor('top').yref).toBe('container')
    expect(legendLayoutFor('right').orientation).toBe('v')
    expect(legendLayoutFor('hidden')).toEqual({})
  })
})
