# Answer Submission Change Log

> 本文记录“答案提交”改造的技术变更与验证要点，方便后续维护与回溯。

## 版本与日期
- 版本：1.0
- 日期：2025-09-03

## 背景
- 现有答案提交在子模式中直接以 localStorage 自行写入，Key 结构不统一，难以追踪与回放。
- 本次改造将答案提交统一聚合到五段式 Key（answers:main）下，便于追加历史、统一查询与迁移。

## 改造目标
- 统一“答案提交”的数据模型与存储位置。
- 保持 UI 行为不变（按钮、交互），对外 API 尽量最小侵入式。
- 提供可回放的提交历史（同一 modeId+version 多次提交，按时间顺序追加）。

## 变更摘要
1. DataManager 新增 answers 聚合 API：
   - 新增方法：getAnswersKey、listAnswerSubmissions、appendAnswerSubmission。
   - 统一五段式 Key：`{系统前缀}:{模式ID}:{版号}:answers:main`（type=answers，excelId 固定为 main）。
   - 追加模型：每次提交生成 entry（含 id、modeId、version、submittedAt 与业务 payload），按数组 submissions 形式存储。

2. 新增统一提交模块 `src/components/Othermodes/answerSubmitter.js`：
   - `buildSubmissionPayload`：从 UI 数据组装规范化 payload（modeId、modeName、version、timestamp、cards[]）。
   - `submitAnswersAggregate`：计算有效版本（未传则回落至 DataManager 当前版本或标准化 `v1.0.0`），调用 DataManager 进行聚合追加。

3. 子模式组件 `SubMode.vue` 提交流程改造：
   - 引入并使用 `submitAnswersAggregate`，移除直接 `localStorage.setItem` 的旧逻辑。
   - 提交按钮文案由“回答完毕”调整为“提交答案”（加载时显示“提交中...”）。
   - 清理了残留的 diff 标记导致的构建错误（确保 `<script setup>` 可正确解析）。

4. 构建验证：
   - 已通过 `npm run build`，构建成功。

## 关键设计与数据模型
- 五段式 Key 规则：`{系统前缀}:{模式ID}:{版号}:{类型}:{ExcelID}`。
  - 本次答案聚合固定：`类型=answers`、`ExcelID=main`（与 `id.js` 的 `PLACEHOLDER_MAIN` 保持一致）。
- 存储形态：`answers:main` 对应的值为数组 `submissions[]`，每个元素结构：

## 影响范围
- 本次仅改造 `SubMode.vue` 的提交流程，替换为统一提交模块；题库与环境快照的读写逻辑不变。
- 其它页面若有自定义的“答案提交”实现，后续可逐步迁移至统一模块。

## 验证步骤（建议）
1. 启动开发环境或打开构建产物，进入任一子模式页面。
2. 编辑若干可编辑项（选项值、单位或选择等）。
3. 点击“提交答案”，观察界面提示与控制台日志（应提示成功）。
4. 打开浏览器开发者工具 → Application/本地存储，定位五段式 Key：
   - 形如：`{prefix}:{modeId}:{version}:answers:main`
   - 其值为 `submissions[]` 数组；确认末尾已追加本次提交（包含 `submittedAt` 与 `cards` 快照）。

## 回滚方案
- 如需回滚，可将 `SubMode.vue` 的 `submitAnswers` 恢复为旧实现（直接写 localStorage），删除 `answerSubmitter.js` 的引用与文件；
- 同时可保留 `DataManager` 新增方法（不影响旧流程），或按需移除。

## 已知限制
- 当前仅支持“追加”提交记录，不提供直接删除/编辑历史提交的能力；
- 版本号缺失时的回退保存至 `v1.0.0`，请在正式使用前确保版本标签已正确初始化；
- 聚合仅按 `{modeId, version}` 维度；不同版本或模式会分别聚合。

## 后续工作建议
- 新增“提交历史”查看面板（按时间倒序展示 `submissions[]`）。
- 与匹配引擎耦合的前/后置校验（例如 cards 的必要字段校验、单位一致性、表达式合法性提示）。
- 对其它模式/页面的回答提交统一迁移至 `answerSubmitter.js`。
- 增加导出/导入提交记录的能力（CSV/JSON）。