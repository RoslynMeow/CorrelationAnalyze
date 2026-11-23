# Agent Instructions

## PR 描述规范

- PR 标题和正文只写评审需要的事实：改了什么、为什么改、验证结果、风险或迁移注意事项。
- 不要把与维护者的对话、待确认问题、方案取舍、版本建议、「如果你要……告诉我」之类的内容写进 PR；这些直接在对话里报告。
- 版本号、tag、Release、是否合并、发布策略由维护者在对话中决定。除非任务明确要求，不要自行假设版本或在 PR 里讨论发布方式。
- 需要维护者拍板的事项先在对话中说明，得到确认后再写入代码或 PR。

## 仓库约定

- 不主动修改版本号、依赖、GitHub Actions 或发布配置，除非任务明确要求。
- 统计口径变更必须同步更新 `tests/stats.spec.ts` 与 pandas / scipy 基准。
- 提交前至少运行 `npm run typecheck`、`npm test`、`npm run build`；涉及浏览器的改动再运行 `npm run test:e2e`。
