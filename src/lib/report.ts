import { chartImage, downloadDataUrl, safeFilename } from './exportChart'
import { t } from '@/i18n'

export interface ReportSection {
  key: string
  label: string
  html: string
  charts: number
}

export interface ReportMeta {
  datasetName: string
  rows: number
  columns: number
  generatedAt: string
  /** 自定义报告标题 */
  title?: string
  /** 副标题 / 团队 / 课程名 */
  subtitle?: string
  /** 报告末尾备注 */
  notes?: string
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 等待页签切换 + Plotly 完成绘制；比固定 300ms 更稳一点 */
export async function waitForPanel(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await sleep(420)
}

function chartCaption(host: HTMLElement): string {
  const card = host.closest('.card')
  const title = card?.querySelector('.cardhead h3, .minihead .mtitle')
  if (title && title.textContent) return title.textContent.trim()
  const id = host.closest('.chart-wrap')?.getAttribute('data-chart-id')
  return id || ''
}

/**
 * 截取当前可见页签：图表转 PNG，其余内容保留 DOM（去掉控件与按钮）。
 * 调用前必须先把目标页签切到前台。
 */
export async function capturePanel(
  panel: HTMLElement,
  key: string,
  label: string,
  includeCharts = true,
): Promise<ReportSection> {
  const hosts = Array.from(panel.querySelectorAll<HTMLElement>('[data-plotly-host]'))
  const clone = panel.cloneNode(true) as HTMLElement

  clone
    .querySelectorAll(
      '.controls, .chart-tools, .chart-style, .chart-style-veil, .chart-resize, .chart-size-badge, .banner',
    )
    .forEach((el) => el.remove())
  // 表头列名是可点击按钮，报告里保留文字；其他操作按钮移除
  clone.querySelectorAll('button').forEach((el) => {
    if (el.classList.contains('th-name')) {
      el.replaceWith(document.createTextNode(el.textContent || ''))
    } else {
      el.remove()
    }
  })

  const cloneHosts = Array.from(clone.querySelectorAll<HTMLElement>('[data-plotly-host]'))
  let charts = 0
  for (let i = 0; i < cloneHosts.length; i++) {
    const target = cloneHosts[i]
    const source = hosts[i]
    const caption = source ? chartCaption(source) : ''
    let img = ''
    if (includeCharts && source) {
      try {
        const rect = source.getBoundingClientRect()
        const url = await chartImage(source, 'png', 2)
        img = `<img src="${url}" alt="${esc(caption)}" style="max-width:${Math.min(
          Math.round(rect.width) || 720,
          960,
        )}px">`
        charts++
      } catch {
        img = `<p class="report-missing">${esc(t('图表导出失败'))}</p>`
      }
    }
    const figure = document.createElement('figure')
    figure.className = 'report-figure'
    figure.innerHTML = img + (caption ? `<figcaption>${esc(caption)}</figcaption>` : '')
    const box = target.closest('.chart-wrap') || target
    box.replaceWith(figure)
  }

  return { key, label, html: clone.innerHTML, charts }
}

const REPORT_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f5f7fa;color:#172033;font:14px/1.6 'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif}
.report-page{max-width:980px;margin:0 auto;padding:32px 28px 60px;background:#fff;min-height:100vh}
.report-head{border-bottom:2px solid #4c6ef5;padding-bottom:18px;margin-bottom:22px}
.report-head h1{margin:0 0 6px;font-size:26px;letter-spacing:-.02em}
.report-head .subtitle{color:#3b5bdb;font-size:13.5px;font-weight:600;margin:0 0 6px}
.report-head .meta{color:#6b7793;font-size:12.5px}
.report-notes{margin:24px 0 0;padding:12px 14px;border:1px solid #e4e9f2;border-left:3px solid #4c6ef5;border-radius:8px;background:#f8fafc;font-size:12.5px;white-space:pre-wrap;page-break-inside:avoid}
.report-tools{position:sticky;top:0;display:flex;gap:8px;justify-content:flex-end;padding:10px 0;background:#fff;z-index:5}
.report-tools button{padding:6px 12px;border:1px solid #d7deea;border-radius:7px;background:#fff;color:#172033;font:inherit;font-size:12.5px;cursor:pointer}
.report-tools button.primary{background:#4c6ef5;border-color:#4c6ef5;color:#fff}
.report-toc{margin:0 0 26px;padding:12px 16px;border:1px solid #e4e9f2;border-radius:10px;background:#f8fafc}
.report-toc b{font-size:12px;color:#6b7793;letter-spacing:.04em}
.report-toc ol{margin:6px 0 0;padding-left:20px;columns:2;column-gap:28px}
.report-toc a{color:#3b5bdb;text-decoration:none}
.report-section{margin:0 0 30px;page-break-inside:auto}
.report-section h2{font-size:18px;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid #e4e9f2}
.card{border:1px solid #e4e9f2;border-radius:10px;padding:14px;margin:0 0 12px;page-break-inside:avoid}
.card+.card{margin-top:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}
.kpi{border:1px solid #e4e9f2;border-radius:9px;padding:9px 11px}
.kpi .label{font-size:10.5px;color:#6b7793}
.kpi .value{font-size:19px;font-weight:700}
.kpi .sub{font-size:10.5px;color:#6b7793}
.cardhead{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:8px}
.cardhead h3{font-size:13.5px;margin:0}
.hint{font-size:11.5px;color:#6b7793}
.summary{font-size:12.5px}
.summary h4{font-size:11px;color:#6b7793;margin:12px 0 4px;letter-spacing:.03em}
.summary ul,.ins-card ul{margin:0;padding-left:18px}
.statstrip{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.stat{font-size:11.5px;border:1px solid #e4e9f2;border-radius:7px;padding:4px 8px;background:#f8fafc}
.stat span{color:#6b7793;margin-right:5px}
.insights{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ins-card{border:1px solid #e4e9f2;border-radius:10px;padding:12px;page-break-inside:avoid}
.ins-card h4{margin:0 0 8px;font-size:13px}
.ins-card li{font-size:12.5px;margin:2px 0}
.sumtag{font-size:10px;background:#eef2ff;color:#3b5bdb;border-radius:4px;padding:1px 5px;margin-left:4px}
.pos{color:#1f9d55}.neg{color:#d64545}
.bar{display:inline-block;height:6px;border-radius:3px;background:#4c6ef5;vertical-align:middle;margin-right:5px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #e4e9f2;white-space:nowrap}
th{background:#f8fafc}
.tablewrap{overflow:visible;border:1px solid #e4e9f2;border-radius:8px}
.report-figure{margin:0 0 12px;text-align:center;page-break-inside:avoid}
.report-figure img{max-width:100%;height:auto;border:1px solid #eef1f7;border-radius:6px;background:#fff}
.report-figure figcaption{font-size:11px;color:#6b7793;margin-top:4px}
.report-missing{color:#d64545;font-size:12px}
.minihead{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}
.minihead .mtitle{font-size:12.5px;font-weight:650}
.minihead .mmuted{font-size:11px;color:#6b7793}
.grid-charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.badge{font-size:9px;padding:1px 4px;border-radius:3px;background:#eef2ff;color:#3b5bdb;margin-left:4px}
.empty-chart{color:#6b7793;text-align:center;padding:16px}
.report-foot{margin-top:30px;padding-top:12px;border-top:1px solid #e4e9f2;color:#6b7793;font-size:11px}
@media print{
  @page{size:A4;margin:14mm}
  body{background:#fff}
  .report-page{max-width:none;padding:0}
  .report-tools{display:none}
  .report-toc{break-inside:avoid}
  .report-section{break-before:auto}
  .report-section + .report-section{break-before:page}
  table{font-size:10.5px}
  th,td{padding:4px 5px}
}
@media (max-width:760px){
  .report-page{padding:18px 14px 40px}
  .kpis{grid-template-columns:repeat(2,1fr)}
  .grid2,.insights{grid-template-columns:1fr}
  .report-toc ol{columns:1}
}
`

/** 生成可独立打开 / 打印为 PDF 的报告 HTML */
export function buildReportHtml(meta: ReportMeta, sections: ReportSection[]): string {
  const title = meta.title?.trim() || t('关联性分析报告')
  const subtitle = meta.subtitle?.trim() || ''
  const notes = meta.notes?.trim() || ''
  const toc = sections
    .map(
      (s, i) =>
        `<li><a href="#sec-${i}">${esc(s.label)}</a></li>`,
    )
    .join('')
  const filename = `${safeFilename(meta.datasetName)}-report.html`
  const body = sections
    .map(
      (s, i) => `
    <section class="report-section" id="sec-${i}">
      <h2>${esc(s.label)}</h2>
      ${s.html}
    </section>`,
    )
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(meta.datasetName)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="report-page">
  <div class="report-tools">
    <button class="primary" onclick="window.print()">${esc(t('打印 / 另存为 PDF'))}</button>
    <button onclick="downloadReport()">${esc(t('下载 HTML'))}</button>
  </div>
  <header class="report-head">
    <h1>${esc(title)}</h1>
    ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
    <div class="meta">
      ${esc(t('数据：{name}', { name: meta.datasetName }))} ·
      ${esc(t('{rows} 行 × {cols} 列', { rows: meta.rows, cols: meta.columns }))} ·
      ${esc(t('生成时间：{time}', { time: meta.generatedAt }))}
    </div>
  </header>
  <nav class="report-toc"><b>${esc(t('目录'))}</b><ol>${toc}</ol></nav>
  ${body}
  ${notes ? `<div class="report-notes">${esc(notes)}</div>` : ''}
  <footer class="report-foot">${esc(
    t('由 CorrelationAnalyze 在本地生成，数据未上传。'),
  )}</footer>
</div>
<script>
function downloadReport(){
  var html='<!doctype html>\\n'+document.documentElement.outerHTML;
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=${JSON.stringify(filename)};
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
}
</script>
</body>
</html>`
}

export function openReportWindow(): Window | null {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(
      `<p style="font:14px 'Segoe UI',sans-serif;padding:24px">${esc(t('正在生成报告…'))}</p>`,
    )
  }
  return win
}

export function writeReport(win: Window, html: string): void {
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export function downloadReportHtml(html: string, name: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, `${safeFilename(name)}-report.html`)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
