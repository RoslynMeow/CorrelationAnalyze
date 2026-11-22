import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const csv = fileURLToPath(new URL('../tests/fixtures/sample.csv', import.meta.url))

async function openSample(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(csv)
  await expect(page.getByText('已载入 30 行')).toBeVisible()
  await expect(page.getByRole('button', { name: '目标关联' })).toBeVisible()
}

async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
})

test('载入 CSV 并切换页签', async ({ page }) => {
  await openSample(page)
  await expect(page.getByText('关联强度 Top 10')).toBeVisible()

  await openTab(page, '目标关联')
  await expect(page.getByText('目标变量')).toBeVisible()
  await expect(page.getByText('显著（FDR < 0.05）')).toBeVisible()
  await expect(page.locator('[data-chart-id="target"]')).toBeVisible()

  await openTab(page, '散点拟合')
  await expect(page.getByText('斜率 95% CI')).toBeVisible()
})

test('相关矩阵可显示显著性星号', async ({ page }) => {
  await openSample(page)
  await openTab(page, '相关矩阵')
  const check = page.getByRole('checkbox', { name: '显著性标记' })
  await expect(check).not.toBeChecked()
  await check.check()
  await expect(page.locator('[data-chart-id="matrix"]')).toContainText('***')
})

test('偏相关矩阵与 VIF', async ({ page }) => {
  await openSample(page)
  await openTab(page, '偏相关 / VIF')
  await expect(page.getByText('偏相关矩阵')).toBeVisible()
  await expect(page.locator('.vif-row').first()).toBeVisible()
  const vifWidth = await page.locator('.vif-card').evaluate((el) => el.getBoundingClientRect().width)
  expect(vifWidth).toBeLessThan(400)

  await expect(page.locator('.chipfield-selected')).toHaveCount(0)
  await page.locator('.chipfield-head').click()
  await expect(page.locator('.chips')).toBeVisible()
  await page.locator('.chips label[title="sleep_hours"]').click()
  await expect(page.getByText('控制：sleep_hours')).toBeVisible()
  await page.locator('.chipfield-head').click()
  await expect(page.locator('.chipfield-selected')).toContainText('sleep_hours')
  await expect(page.getByText('控制：sleep_hours')).toBeVisible()
  await expect(page.locator('[data-chart-id="partial"]')).toBeVisible()
})

test('行筛选影响数据与分析', async ({ page }) => {
  await openSample(page)
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '筛选数据' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: /添加条件/ }).click()
  await dialog.locator('.filter-rule select').selectOption('gender')
  await dialog.locator('.filter-rule .chips label[title="Female"]').click()
  await expect(dialog.locator('.filter-preview')).toContainText('15')
  await dialog.getByRole('button', { name: '应用筛选' }).click()

  await expect(page.locator('.filter-banner')).toContainText('已筛选 15 / 30 行')
  await openTab(page, '数据预览')
  await expect(page.locator('.pinfo').first()).toContainText('共 15 行')
  await expect(page.locator('.tablewrap tbody tr')).toHaveCount(15)

  await page.locator('.filter-banner').getByRole('button', { name: '清除' }).click()
  await expect(page.locator('.filter-banner')).toBeHidden()
  await expect(page.locator('.pinfo').first()).toContainText('共 30 行')
})

test('数据搜索与导出', async ({ page }) => {
  await openSample(page)
  await openTab(page, '数据预览')

  await page.getByRole('searchbox', { name: '搜索' }).fill('female')
  await expect(page.locator('.pinfo').first()).toContainText('共 15 行')

  const download = page.waitForEvent('download')
  await page.getByTitle('导出当前数据 CSV').click()
  expect((await download).suggestedFilename()).toBe('export.csv')
})

test('图表可下载 PNG', async ({ page }) => {
  await openSample(page)
  await openTab(page, '目标关联')
  const download = page.waitForEvent('download')
  await page.locator('[data-chart-id="target"] .chart-tool[title="下载 PNG"]').click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
})

test('弹窗焦点与 Esc 关闭', async ({ page }) => {
  await openSample(page)

  await page.getByTitle('设置').click()
  const drawer = page.locator('.drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('自动保存在本机')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const inside = await page.evaluate(() => !!document.activeElement?.closest('.drawer'))
  expect(inside).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  await page.getByRole('button', { name: '筛选', exact: true }).click()
  const filterDialog = page.getByRole('dialog', { name: '筛选数据' })
  await expect(filterDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(filterDialog).toBeHidden()
})
