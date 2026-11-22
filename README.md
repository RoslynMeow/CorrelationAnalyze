# CSV 关联性分析看板（Association Analyzer）v2

纯前端、可离线的 CSV 关联分析工具。拖入任意 CSV，自动识别字段类型，生成相关矩阵、目标关联、散点拟合、分组对比、分布、类别计数、雷达画像、成对关系、自动结论与数据预览。

**技术栈**：Vue 3 + Vite + TypeScript + Pinia + Plotly.js。所有计算在浏览器本地完成，文件不会上传。

> 本项目由 v1 单文件版（`legacy/correlation-analysis.html`）迁移而来，统计口径与 v1 / notebook 完全一致，并补上了 notebook 里有、v1 缺的 3 个视图。

---

## 1. 快速开始

```bash
npm install
npm run dev          # http://localhost:5188
npm test             # 36 个单元测试
npm run typecheck    # vue-tsc
npm run build        # 常规构建 → dist/
npm run build:single # 单文件构建 → dist-single/index.html
npm run preview      # 预览构建产物 → http://localhost:5188
```

**端口固定为 5188**（`vite.config.ts` 的 `server.port` / `preview.port`，`strictPort: true`）。本机同时调试多个项目时不会和 5173 / 4173 冲突；需要改端口直接改这两处。

落地页有「先看看示例数据」，会读取 `public/test.csv`（30 行 × 20 列，学生心理健康主题）。

---

## 2. 功能

| 页签 | 内容 |
|---|---|
| 关联总览 | 数据规模 KPI、全部变量对的关联强度 Top 10、自动文字解读 |
| 相关矩阵 | 数值变量 Pearson / Spearman；类别变量 Cramér's V；下三角遮罩、数值标注 |
| 目标关联 | 选目标列，其余列按关联强度排序；自动区分 r / ρ / η / V；绿=正、红=负、蓝=无方向 |
| 散点拟合 | 任选 X/Y/颜色/气泡大小；线性拟合；同时给出 Pearson r 与 Spearman ρ；日期列可作时间轴 |
| 分组对比 | 按任意分组列批量画箱线图，可多选数值变量，小样本自动显示散点 |
| 成对关系 | SPLOM 矩阵图，最多 6 维，按类别着色 |
| **分布分析** | 直方图 + KDE，可按组叠加上色，分箱数可调（**v2 新增**） |
| **类别计数** | countplot，可堆叠子组、切换百分比、显示不平衡比（**v2 新增**） |
| **雷达画像** | 按组标准化后的多维对比，Min-Max / Z-Score 两种标准化（**v2 新增**） |
| 分析结论 | 数据概况、最强关联、目标因素、类别关联、冗余变量、数据质量 |
| 数据预览 | 表格分页、全列搜索、列画像、导出当前数据 CSV |

全局：深浅色主题、响应式（320px 起）、图表缩放/悬停/图例开关、单图导出 PNG、拖拽换文件、URL 记住当前页签（`#matrix` 等）。

---

## 3. 统计口径（与 v1 / notebook 一致，改动前请先看测试）

| 变量组合 | 度量 |
|---|---|
| 数值 × 数值 | **Pearson r**（默认）或 **Spearman ρ**（平均秩后求 Pearson） |
| 数值 × 类别 | **相关比 η** = √(组间平方和 / 总平方和)，0–1，无方向 |
| 类别 × 类别 | **Cramér's V**（基于卡方），0–1，无方向 |

- 缺失值：逐对剔除（pairwise complete）
- r / ρ 需要 n ≥ 3；V 需要 n ≥ 4 且至少 2×2
- 常量列、ID 列不参与统计
- 有序等级自动识别：Low < Medium < High、低 < 中 < 高 等常见词表

这些实现都在 `src/lib/stats.ts`，是纯函数，可直接单测。

---

## 4. 目录结构

```
CorrelationAnalyze/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ vitest.config.ts
├─ tsconfig.json
├─ public/
│  └─ test.csv                 # 示例数据（构建时原样复制）
├─ src/
│  ├─ main.ts
│  ├─ App.vue                  # 页签骨架 + 全局拖拽
│  ├─ types.ts
│  ├─ styles/
│  │  ├─ tokens.css            # 颜色/阴影变量（深浅色）
│  │  └─ main.css              # 组件与响应式样式（从 v1 迁移）
│  ├─ lib/
│  │  ├─ csv.ts                # 解析 + 编码探测（UTF-8/GB18030/UTF-16）
│  │  ├─ infer.ts              # 类型 / ID / 分组列推断、默认列选择
│  │  ├─ stats.ts              # r / ρ / V / η / 回归 / KDE
│  │  ├─ associations.ts       # 变量对组合与缓存、颜色
│  │  ├─ chartTheme.ts         # Plotly 基础布局、主题联动
│  │  └─ format.ts             # 数字格式、缺失值、CSV 导出
│  ├─ stores/
│  │  ├─ dataset.ts            # 数据 + 变量对缓存 + Worker 调用
│  │  └─ theme.ts              # 深浅色 + localStorage
│  ├─ workers/
│  │  └─ associations.worker.ts
│  ├─ composables/
│  │  ├─ useNarrow.ts          # <760px 断点共享状态
│  │  └─ useToast.ts
│  ├─ components/              # PlotlyChart / DropZone / AppBar / KpiCards / ChipGroup / SelectField / Toast
│  └─ panels/                  # 11 个页签，与 v1 的 render 函数一一对应
├─ tests/                      # stats / csv / infer
├─ legacy/                     # v1 单文件版、旧 README、原始 notebook
└─ .github/workflows/deploy.yml
```

---

## 5. 架构说明

### 数据流

1. `DropZone` 拿到 `File` → `lib/csv.ts` 按 BOM/编码探测解码、解析。
2. `buildDataset()` 推断每列类型（number / date / category）、统计缺失与唯一值、标记 ID 列。
3. 各面板从 Pinia store 读取派生列（数值 / 类别 / 分组 / 可分析列），本地计算图表。
4. 全量变量对（最多前 40 个变量）交给 **Web Worker** 计算，按方法（pearson / spearman）缓存；Worker 不可用时自动回退主线程。
5. Worker 用 `?worker&inline` 打包，单文件版也能离线运行。

### 性能上限（沿用 v1）

- 读入最多 100,000 行
- 关联总览：最多前 40 个变量两两组合
- 类别矩阵：最多 20 列、每列 ≤ 25 个取值
- 散点：最多 6,000 点；SPLOM：最多 3,000 行
- 目标列类别数 ≤ 50

### 主题与响应式

- `stores/theme.ts` 切换 `html[data-theme]`，图表布局通过 `chartThemeTick` 订阅主题变化自动重算。
- 断点：`≤900px` 双栏变单栏；`≤760px` 表格卡片化、图表缩小；`≤420px` KPI 两列。
- 跨 760px 时 `useNarrow` 触发图表重排。

### 页签缓存（改代码时注意）

页签组件用 `<KeepAlive>` 缓存，切回来时保留筛选条件。**动态组件的 `key` 必须同时包含数据集和页签**（当前是 `${datasetId}:${tabKey}`）：KeepAlive 用 key 做缓存索引，若不同页签复用同一个 key，会错误复用上一个页签的实例，表现为“点页签后内容不变”。

---

## 6. 测试

```bash
npm test
```

当前 **36 个测试全部通过**，分三组：

- `tests/stats.spec.ts`：基础统计 + 用 `test.csv` 与 pandas / scipy 对照（容差 1e-9）
- `tests/csv.spec.ts`：引号、CRLF、BOM、重复列名、GB18030 / UTF-16
- `tests/infer.spec.ts`：类型推断、ID 列、分组列、有序等级、行数截断

对照基准示例：

| 指标 | 值 |
|---|---|
| Pearson r（stress_level × mental_health_index） | −0.974410393042 |
| Spearman ρ（同上） | −0.946607341491 |
| η（stress_level 按 risk_level 分组） | 0.719637734744 |
| Cramér's V（gender × risk_level） | 0.183791360553 |
| 回归斜率（sleep_hours → stress_level） | −0.330057856601 |

---

## 7. 构建与部署

### GitHub Pages（推荐）

`.github/workflows/deploy.yml` 已配置：推送到 `main` / `master` 时自动跑测试、构建 `dist/` 并发布到 Pages。

首次使用：

1. 在 GitHub 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**
2. 推送代码到 `main` / `master`
3. 发布地址形如 `https://<user>.github.io/<repo>/`

`vite.config.ts` 使用 `base: './'`，资源全部相对路径，因此项目页子路径和自定义域名都能直接工作。

### 单文件便携版

```bash
npm run build:single
```

产物是 `dist-single/index.html`（约 4.8 MB，内联 JS/CSS/Plotly/Worker），双击即可运行，适合发给别人或离线使用。示例数据按钮需要把 `test.csv` 放在同目录；没有也不影响其他功能。

### 常规构建

```bash
npm run build
npx serve dist   # 或任意静态服务器 / Nginx
```

---

## 8. 与 notebook 的对照

| notebook 单元格 | 内容 | 现状 |
|---|---|---|
| cell 2–3 | 导入、读取 CSV、缺失统计 | ✅ 自动编码/分隔符、KPI |
| cell 4 | 列分类、risk_level 有序类别 | ✅ 自动类型推断 + 有序等级 |
| cell 5 | 18 个数值变量直方图 + KDE | ✅ 分布分析（可分组、分箱可调） |
| cell 6 | 性别/学年/风险等级计数图 | ✅ 类别计数（可堆叠、百分比） |
| cell 7 | 数值相关热力图 | ✅ 相关矩阵（多 Spearman、类别矩阵） |
| cell 8 | 8 指标按风险等级箱线图 | ✅ 分组对比（变量/分组任选） |
| cell 9 | 3 个固定散点图 | ✅ 通用散点 + 拟合线 + 气泡 + 日期轴 |
| cell 10 | 9 维雷达（Min-Max） | ✅ 雷达画像（Min-Max / Z-Score） |
| cell 11 | 5 变量 pairplot | ✅ 成对关系（交互、最多 6 维） |
| cell 12 | 与 risk_num 的相关条形图 | ✅ 目标关联（支持类别目标） |

**notebook 的分析意图与网页的差异**：notebook 写死了“哪 8 个指标、哪 3 组散点、雷达用哪几维”，网页是通用选择器 + 智能默认值。后续可做“预设模板”把分析意图产品化。

---

## 9. 后续可做

- 预设模板（学生心理健康模板等）与自定义预设保存
- 一键整页报告导出（HTML / PDF）
- URL 分享完整筛选状态（目前只同步页签）
- 大文件虚拟滚动表格
- 数据筛选器（按条件过滤后再分析）
- 更多编码（Shift-JIS 等）与更脏数据的分隔符探测

---

## 10. 旧版文件

- `legacy/correlation-analysis.html`：v1 单文件版（4.6 MB，内联 Plotly）
- `legacy/README-v1.md`：v1 交接文档
- `legacy/Untitled.ipynb`：最初的 Jupyter 分析（需求来源）

旧版仍可双击运行，作为对照基准保留。

---

## 11. 变更记录

- **2026-11-21**：从 notebook 的图表整理出通用数据探索看板，后改为关联性分析程序，加入 r/ρ/V/η、目标关联、自动结论
- **2026-11-22**：Plotly 内联为单文件；补齐响应式；编写 v1 README
- **2026-11-22**：迁移到 Vue 3 + Vite + TypeScript 工程；统计逻辑拆成纯函数并加 36 个测试；补上分布 / 类别计数 / 雷达 3 个视图；加入 Web Worker、GitHub Pages 工作流与单文件构建
