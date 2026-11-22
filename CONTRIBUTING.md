# Contributing

感谢参与。这个项目偏向“谨慎的小步迭代”：统计口径和交互行为有任何变化，都需要有测试和说明。

## 开发环境

需要 Node.js ≥ 20.19。

```bash
npm install
npm run dev        # http://localhost:5188
npm run typecheck
npm test
npm run build
```

端口固定为 5188（`vite.config.ts`），避免和其他项目的默认端口冲突。

## 分支与 PR

- 稳定分支：`main`
- 功能/修复：从 `main` 拉临时分支，完成后开 PR；合并后删除
- PR 请说明动机、改动范围与验证方式，并勾选 PR 模板里的检查项
- 大改动请先开 Issue 讨论，避免方向不一致

## 代码约定

- 纯函数优先：统计、CSV、类型推断、配置合并都应可单测
- 统计逻辑集中在 `src/lib/stats.ts`；不要在各面板里重复实现
- 图表统一通过 `PlotlyChart` 组件渲染，以复用主题、导出、尺寸与工具条
- 新增设置项时，同步更新：
  - `src/settings/defaults.ts`（类型 + 默认值）
  - `src/settings/merge.ts`（校验与合并）
  - `src/settings/...` 对应的设置界面
  - `tests/settings.spec.ts`
- 颜色不要写死，使用 settings store 的色板 / CSS token
- 文案暂为中文；第 2 期会抽成可编辑词典，新增文案尽量集中、可替换

## 统计口径变更

任何 r / ρ / V / η / 回归 / KDE 的改动都必须：

1. 更新 `tests/stats.spec.ts`
2. 用 pandas / scipy 重新生成基准值（容差 1e-9）
3. 在 PR 说明里写清楚口径变化的原因

## 数据与隐私

- 不要提交真实业务 CSV；需要复现数据时使用 `tests/fixtures/` 下的脱敏样本
- 不要引入会把数据发送到服务器的依赖
- 新增外部资源时优先考虑可离线 / 可单文件打包

## 提交信息

建议使用 Conventional Commits：

```
feat(charts): add per-chart size presets
fix(csv): handle quoted line breaks
docs: update deployment notes
```
