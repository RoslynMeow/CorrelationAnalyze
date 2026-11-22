import { describe, expect, it } from 'vitest'
import { buildReportHtml } from '@/lib/report'

describe('报告导出', () => {
  it('生成完整 HTML，包含目录、章节与打印按钮', () => {
    const html = buildReportHtml(
      {
        datasetName: 'demo.csv',
        rows: 30,
        columns: 20,
        generatedAt: '2026-11-22 10:00',
      },
      [
        { key: 'overview', label: '关联总览', html: '<p>ok</p>', charts: 1 },
        { key: 'matrix', label: '相关矩阵', html: '<p>m</p>', charts: 1 },
      ],
    )
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('关联性分析报告')
    expect(html).toContain('demo.csv')
    expect(html).toContain('30 行 × 20 列')
    expect(html).toContain('id="sec-0"')
    expect(html).toContain('id="sec-1"')
    expect(html).toContain('关联总览')
    expect(html).toContain('打印 / 另存为 PDF')
    expect(html).toContain('下载 HTML')
    expect(html).toContain('@page')
  })

  it('支持自定义标题 / 副标题 / 备注并转义', () => {
    const html = buildReportHtml(
      {
        datasetName: 'demo.csv',
        rows: 30,
        columns: 20,
        generatedAt: '2026-11-22 10:00',
        title: '心理健康 <b>报告</b>',
        subtitle: '2026 春季课程项目',
        notes: '口径：pairwise\n第二行',
      },
      [{ key: 'overview', label: '关联总览', html: '<p>ok</p>', charts: 0 }],
    )
    expect(html).toContain('<title>心理健康 &lt;b&gt;报告&lt;/b&gt; · demo.csv</title>')
    expect(html).toContain('2026 春季课程项目')
    expect(html).toContain('report-notes')
    expect(html).toContain('口径：pairwise')
    expect(html).not.toContain('<b>报告</b>')
  })

  it('转义数据名中的 HTML', () => {
    const html = buildReportHtml(
      {
        datasetName: '<script>alert(1)</script>',
        rows: 1,
        columns: 1,
        generatedAt: 'now',
      },
      [{ key: 'x', label: 'X', html: '', charts: 0 }],
    )
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})
