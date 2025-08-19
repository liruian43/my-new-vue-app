# 数据模块无损拆分与合并日志

日期：2025-08-20
目标：保持现有交互完全不变（A版 dataManager 流程 + B版 storage 流程并存），把复杂逻辑沉到可维护的模块中，为后续逐步替换/精简做准备。

- 不删除任何能力；所有“可删除/可合并”的地方仅在代码中用注释标记。
- 旧键名不改，历史数据不丢；如需新命名空间，采用“带前缀 + 复合键”的方式并提供兼容兜底。
- A版（UI → `store.js` → `dataManager`）与 B版（UI → `store.js` → 拆分模块）同时可用。

--------------------------------

1. 拆分后目录与职责

- 核心说明
  - `manager.js`：仍保留“题库（第七类）/环境全量快照（第九类）”的核心实现，其余方法只是“代理转发”到新模块，保证老调用不改也能跑。
  - `store-parts/*`：领域子系统（模式、环境配置、联动、同步、反馈、规范化）。
  - `services/*`：通用服务（长期存储、ID、导入导出）。
  - `storage/*`：存储策略（本地存储前缀策略）。
  - `utils/*`：通用工具（对象路径、UI 文案）。

- 目录树（关键文件）
```
src/components/Data/
├─ manager.js                            // 仅核心 + 其余代理转发
├─ storage/
│  └─ LocalStorageStrategy.js            // 本地存储策略（统一前缀）
├─ services/
│  ├─ longTerm.js                        // 长期存储 CRUD + 复合键命名
│  ├─ id.js                              // ID 生成/校验（卡片ID、选项ID）
│  └─ io.js                              // 导入/导出（DOM 下载保留，后续可上移到UI）
├─ store-parts/
│  ├─ normalize.js                       // 数据归一化工具
│  ├─ cards.js                           // 卡片模板与规范化
│  ├─ modes.js                           // 模式/主模式配置（可删除项已注释标记）
│  ├─ subModes.js                        // 子模式（合并版：兼容 A/B）
│  ├─ envConfigs.js                      // 环境配置（合并版：兼容 A/B + 快照辅助）
│  ├─ feedback.js                        // 匹配/评分/保存反馈（合并版：兼容 A/B）
│  ├─ sync/
│  │  ├─ history.js                      // 同步历史（可选：旧键兼容）
│  │  ├─ authorization.js                // 字段授权
│  │  ├─ status.js                       // 同步状态查询/更新
│  │  └─ index.js                        // 聚合导出
│  └─ linkage/
│     ├─ rules.js                        // 规则 CRUD + 轻量校验
│     ├─ transforms.js                   // 字段转换注册/应用
│     ├─ executor.js                     // 执行正向/反向联动 + 历史记录
│     └─ index.js                        // 聚合导出
├─ validators/
│  └─ dataValidator.js                   // [可能需要删除] 通用数据校验
└─ utils/
   ├─ objectPath.js                      // get/set 嵌套字段
   └─ uiTooltip.js                       // [可能需要删除] UI 提示文本
```

- 存储键名（保持不变）
  - `question_bank`（题库）
  - `environment_configs`（环境配置）
  - `env_full_snapshots`（环境全量快照）
  - `linkage_rules`（联动规则）
  - `submode_instances`（子模式实例）
  - `sync_history`（同步历史）
  - `field_authorizations`（字段授权）
  - `current_mode`（当前模式）
  - `root_mode_config`（主模式配置，可选）

- 新增复合键（不替换旧键，仅用于“长期存储业务数据”）
  - 形如：`long-term:{modeId}:{namespace}:{dataId}`，用于卡片等分区存储。借助 `LocalStorageStrategy` 前缀统一为 `app_long_term_long-term:...`，不影响旧键。

--------------------------------

2. 为什么这样拆分（通俗说明）

- 单一职责
  - 把“做什么”与“存哪里”分开：例如“联动规则怎么执行”归 `linkage/executor.js`，“存储读写”归 `services/longTerm.js`。
- 依赖方向明确
  - “上层业务（linkage）调用下层能力（sync、longTerm）”，而不是反过来，避免循环依赖、易测易替换。
- 渐进替换
  - `manager.js` 保留代理接口，旧代码不改也能跑；新代码可逐步直接用新模块，稳定后再删代理。
- 兼容两套调用
  - A版：`store` 调用 `dataManager`。
  - B版：`store` 直接调用拆分模块。这次通过“合并版”让同一函数既能接 `store` 也能接 `storage`。
- 可观测性提升
  - 长期存储与联动、同步历史明确分离，调试起来容易定位问题。

一句话：把“规则/数据/存储/工具”分层，让每层只关心自己的事情，旧调用不破坏，新架构可逐步接管。

--------------------------------

3. 兼容改动与“兜底”的原因和做法

- 为什么要兜底
  - 之前 A/B 版本入口混用：有的地方传的是 `store`，有的是 `storage`，还有的是 `dataManager`。
  - `localStorage` 与 `LocalStorageStrategy` 的 `getItem/setItem` 行为不同（一个返回字符串，一个返回对象）。
  - 为了“贴上就能跑”，模块必须自适应这些差异，否则就会出现 “storage.getItem is not a function” 或 “对象直接塞进原生 localStorage 导致类型错乱”。

- 兜底怎么做
  - `resolveStorage(...)`：同时支持三种入参
    - 直接传 `storage`（原生或策略）
    - 传 `store.storage`
    - 传 `store.dataManager.longTermStorage`
  - `getJSON/setJSON`：自动判断是否需要 `JSON.parse/JSON.stringify`，屏蔽原生 localStorage 与策略类差异。
  - 旧键兼容（可选）：像 `sync/history.js` 可“读新键，读不到再读旧键；写入时新旧双写”，过渡期保证数据一致。

- 我能否在保留旧键名的情况下适配新版本
  - 可以。核心键名（题库/联动/环境配置/子模式/同步历史/授权等）全部保留不变。
  - 对“长期业务数据（如卡片实例）”我们新增了“复合键模式”，不会覆盖你的旧键，且仅用于分区和更细粒度的存取；旧数据仍按旧键读取。
  - 如果你希望100%复用旧键，也可以把 `services/longTerm.js` 的 `buildKey` 改成映射到你的旧键命名规则，或者加一层“旧键→新键”的索引表；本次默认保留新复合键以减少键冲突。

- 为什么不每次拆分都沿用老键名
  - 老键名多是“全局袋子”（如 `environment_configs`），往往聚合多种数据，长期会越来越难维护。
  - 对“强隔离的数据域”（按模式/命名空间/数据ID切片），使用复合键更安全、易清理、易迁移，也避免不同域的覆盖与互相污染。
  - 新复合键仅用于“新的分区存储场景”，不替代你的老键；两者并存，风险最低。

--------------------------------

4. 可删除/可合并清单（下一阶段优先项）

- 可删除（标记了 [可能需要删除]，当前未删除）
  - `validators/dataValidator.js`
    - 现状：统一的大杂烩校验，调用点已降级为“可选”。
    - 计划：改为“各子域轻量校验”（如联动规则在 `linkage/rules.js` 内自校验；长期存储写入前在调用侧保证结构）。
  - `utils/uiTooltip.js`
    - 现状：UI 辅助字符串生成，属于“视图层”。已从 `manager.js` 代理。
    - 计划：迁到具体组件旁或 UI 层工具；从数据层删除。

- 可合并
  - 同步子系统（第十一类）
    - 组合方式：`store-parts/sync/history.js + authorization.js + status.js` 合并为单个 `sync.js`。
    - 价值：减少模块数，避免 import 分散。
  - 模式子系统（第三/第六/第十二类）
    - 组合方式：`modes.js + subModes.js` 合并成 `modes/index.js`，主模式配置（`root_mode_config`）如确实无用可移除。
  - 规范化/卡片
    - 组合方式：`normalize.js + cards.js` 合并为 `cards/` 目录内模块，或并入统一的“前端通用工具层”（若你有）。

- 可选增强（兼容期专用）
  - `sync/history.js`：已提供“新前缀 + 旧键”的双通道读写。若确认历史只需新前缀，可回退到“单通道”。

建议优先级
1) 删除/内联校验：`validators/dataValidator.js`
2) UI 下沉：`utils/uiTooltip.js`
3) 同步子系统合并：`store-parts/sync/*` → `sync.js`
4) 模式域合并：`modes.js + subModes.js`
5) 规范化合并：`normalize.js + cards.js`

--------------------------------

5. 模块与职责速查（给开发/排查用）

- 存储策略
  - `storage/LocalStorageStrategy.js`：统一前缀 `app_long_term_`；自动 JSON.parse/JSON.stringify。

- 通用服务
  - `services/longTerm.js`：`buildKey`（`long-term:{modeId}:{namespace}:{dataId}`）、`save/get/delete/clearLongTermByMode`（可选传 validator；[可能需要删除]）。
  - `services/id.js`：`compareCardIds`、`isValidCardId`、`generateNextCardId`、`generateNextOptionId`。
  - `services/io.js`：`exportData`（保留 DOM 下载）、`importFromFile`、`importToLongTerm`（导入时合并策略与去重）。

- 领域子系统
  - `store-parts/envConfigs.js`（合并版）：`loadEnvironmentConfigs`、`saveEnvironmentConfigs`、`createScoringRule`；保留你原先 normalize / 快照辅助方法。
  - `store-parts/subModes.js`（合并版）：`loadSubModeInstances`（A/B双入口）、`saveSubModeInstances`、`parseSubModeData`、`createSubModeSnapshot`。
  - `store-parts/feedback.js`（合并版）：`submitForMatching`、`saveFeedbackData`、`loadFeedbackData`、`matchResultsWithQuestionBank`、`evaluateQuestionResult`。
  - `store-parts/modes.js`：`getMode`、`get/setCurrentModeId`、`save/getRootModeConfig`（[可能需要删除]）。
  - `store-parts/sync/`：
    - `history.js`：`load/save/createSyncHistoryEntry`（可选兼容旧键）。
    - `authorization.js`：字段授权存取与 `filterSyncFields`。
    - `status.js`：`getSyncStatus`（根据历史计算）/ `updateCardSyncStatus`（更新卡片的同步标识）。
    - `index.js`：聚合导出。
  - `store-parts/linkage/`：
    - `rules.js`：`load/save/create/get/delete`（保存时可选传 validator；校验轻量化）。
    - `transforms.js`：转换注册与 `applyTransform`（内置百分比/大写/ISO/差值等）。
    - `executor.js`：`executeLinkage`（正向）、`executeReverseLinkage`（反向；内存构造反向规则，避免污染存储），写同步历史。
    - `index.js`：聚合导出。
  - `store-parts/cards.js`：`CARD_DATA_TEMPLATE`、`normalizeCardForStorage`。
  - `store-parts/normalize.js`：`normalizeNullValue`、`normalizeDataStructure`。

- 工具
  - `utils/objectPath.js`：`getNestedValue`、`setNestedValue`（支持 a.b.c）。
  - `utils/uiTooltip.js`：生成简单 UI 提示（[可能需要删除]）。

- 代理层
  - `manager.js`：老接口不变，内部“转发到新模块”；仅“题库/全量快照”保留核心实现。

--------------------------------

6. 这次修改后，我需要注意什么（高频问答）

- 我还要改 `store.js` 吗？
  - 不需要。A/B 入口都被“合并版”兜住了，按原来调用签名继续使用即可。
  - 若你愿意逐步拥抱拆分模块，可从“读取型方法”开始（调用 `store-parts/*` 直接读），稳定后再改“写入型”。

- 为什么你有时在 `sync/history.js` 提到“新前缀+旧键兼容”？
  - 老项目通常把 `sync_history` 存在“无前缀”的键上；新策略（`LocalStorageStrategy`）会加统一前缀。为了过渡不丢数据，用“读新读旧/写新写旧”的方式。
  - 若你确认历史数据都切换到有前缀的策略（或不需要旧键），可保留“单通道”版本，代码更简洁。

- `long-term:{modeId}:{namespace}:{dataId}` 看起来是新键，会不会影响旧逻辑？
  - 不会。这是“新场景”才用的复合键（例如以模式隔离的卡片数据），不替换任何旧键（例如 `environment_configs` 仍旧）。
  - 这么做目的是避免“一个巨大 JSON”里混入多域数据，后期难以迁移与清理。

--------------------------------

7. 下一阶段计划（建议）

- 批次A（瘦身）
  - 删除 `validators/dataValidator.js`，把校验下沉到各子模块（或直接由 UI 负责数据完整性）。
  - 将 `utils/uiTooltip.js` 下沉到具体组件或 UI 工具层。

- 批次B（整合）
  - 合并 `store-parts/sync/*` → `store-parts/sync.js`。
  - 合并 `modes.js + subModes.js` → `modes/index.js`，评估 `root_mode_config` 是否还需保留。

- 批次C（简化存储）
  - 视情况将“旧键兼容”的双写逻辑去掉（冻结键方案），最终只保留前缀化的策略类访问。

- 批次D（去代理）
  - `manager.js` 只保留第七/九类核心方法；其余代理删除，`store.js` 直接用拆分模块。

- 验证清单
  - 打开 root_admin，检查：题库/环境配置/子模式加载成功；同步历史可读写；联动规则可读写并执行；导入/导出正常。
  - 切换模式/保存快照/应用快照，检查 session 卡片替换逻辑无异常。

