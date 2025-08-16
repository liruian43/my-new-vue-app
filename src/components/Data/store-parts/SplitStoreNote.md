# 状态管理 Composition API 拆分日志

本次改造目标
- 严格“状态管理拆分”，不动数据模块。所有数据加载/存储/校验继续由 `DataManager` / `api.js` 承担。
- 对外 API 0 变化：`useCardStore` 名称、state 结构、getters 名称、actions 名称与参数完全一致。
- 样式、交互、功能、逻辑、时序、持久化行为不改变；只减小 `src/components/Data/store.js` 体积、提升可维护性。

改造摘要
- 保留 `src/components/Data/store.js` 为“聚合/门面层”，继续导出原有 state 与 getters，actions 改为“委托到 store-parts 模块函数”，保证调用方无感。
- 新增 `store-parts` 目录，按“功能性状态/动作编排/联动/权限/生命周期”等维度拆分，模块化职责清晰。
- Pinia 全局单例语义保持；未引入额外状态实例，所有读写都直接作用于当前 Pinia store 实例。
- 持久化键与文件结构保持完全一致：`app_user_modes`、`root_mode_config`、`app_medium_cards`、`generated_modes`、`card_preset_mappings`，以及 `SessionStorageEnhancer` 的会话前缀。

目录结构（拆分后）
```
src/components/Data
├─ store.js                          # 保留原入口：state/getters 原样；actions 委托至各模块
├─ manager.js                        # 数据/校验/导入导出（未改）
├─ api.js                            # 数据接口（未改）
├─ store-parts
│  ├─ routing.js                     # 动态路由与模式页面注册/删除/导航/路由记录
│  ├─ linkage.js                     # 模式联动：权限校验、字段同步判定、跨模式同步主流程
│  ├─ envConfigs.js                  # 环境配置标准字段：加载/规范化/保存/上下游通知
│  ├─ questions.js                   # 题库加载、校验、增删
│  ├─ rootMode.js                    # 主模式 root_admin 的标准/草稿操作与 Excel 样式 ID 支持
│  ├─ presets.js                     # 卡片预设映射的加载/保存/应用
│  ├─ cards.js                       # 会话/临时卡片、选项、下拉、编辑态、中期存储、导入导出
│  ├─ subModes.js                    # 子模式实例加载与解析（授权位映射）
│  ├─ feedback.js                    # 匹配提交与反馈生成/持久化
│  ├─ dataSection.js                 # 数据段管理区（列表、筛选、删除、预览导入/应用）
│  ├─ modes.js                       # 模式的添加/删除/查询/持久化（含路由联动）
│  ├─ init.js                        # 全量初始化编排（按原时序）
│  └─ modeLocalEdit.js               # 模式内本地编辑（授权位限流 + 环境配置联动）
└─ Othermodes
   └─ OtherModeTemplate.vue          # 动态路由使用（未改）
```

拆分依据与原则
- 功能域边界清晰：将动作按“路由/联动/环境配置/题库/主模式/卡片预设/卡片操作/子模式/反馈/数据段/模式/初始化/本地编辑”拆分，职责单一。
- 不存业务数据：各模块只操作 Pinia store 实例上的功能性状态；任何数据源仍通过 `DataManager` 调用（如 `loadQuestionBank`、`saveEnvironmentConfigs`、`validator` 等）。
- 单例与时序保持：未引入新实例，`watch` 行为未改变；所有持久化与 side-effect 调用顺序与原实现一致。
- 入口透明：`store.js` 仍导出完整的常量 `FIELD_IDS`/`FIXED_SYNC_FIELDS`/`CONFIGURABLE_SYNC_FIELDS`/`AUTHORIZABLE_FIELDS`，以及原始 state/getters/actions 接口。

各子模块职责与对外行为

1) `routing.js`
- 路由实例维护、模式页面创建、注册/删除、跳转。
- 路由记录：`modeRoutes` 的初始化、添加与查询。
- 使用 `../../Othermodes/OtherModeTemplate.vue` 创建动态模式组件，保持 `meta.requiresAuth: true` 等不变。
- 对外委托：`initRouter`、`generateModePage`、`registerModeRoute`、`deleteModePage`、`loadGeneratedModes`、`navigateToMode`、`initializeModeRoutes`、`addModeRoute`、`generateModeRoutePath`、`getModeRoute`。

2) `linkage.js`
- 权限校验：`checkSyncPermission` 强制仅 `root_admin` 为源，禁止自同步与不存在目标。
- 字段同步判定：`isFieldSynced` 保持固定同步字段恒 true。
- 联动主流程：`coordinateMode` 验证、迭代目标模式、调用 `syncToTargetMode`、通知 `dataManager.syncComplete()`。
- 单模式同步接口：`syncToMode` 保持全部校验与持久化行为（`sessionStorageEnhancer`、`presetMappings`、解析刷新、历史记录）。
- 对外委托：`toggleModeDropdown`、`selectMode`、`togglePrepareStatus`、`resetLinkageState`、`confirmLinkage`、`syncDataToTargets`、`setFieldAuthorization`、`recordSyncHistory`、`updateModeSyncInfo`、`syncData`、`syncToTargetMode`、`coordinateMode` 等。

3) `envConfigs.js`
- 环境配置加载与规范化：`loadEnvironmentConfigs`、`normalizeCards`、`normalizeOptions`
- 保存与变更广播：`saveEnvironmentConfigs`、`notifyEnvConfigChanged`（触发子模式解析刷新）
- 上下文模板：`saveQuestionContext`、`getQuestionContext`、`getAllOptionsByCardId`

4) `questions.js`
- 题库加载与校验：表达式正则、全量 ID 存在性校验
- 增删与持久化：`addQuestionToBank`、`removeQuestionFromBank`

5) `rootMode.js`
- `root_admin` 的初始化与标准保存：`initRootMode`、`saveDataStandards`
- 草稿操作：`recordRootTempOperation`、`clearRootTempData`、`updateRootConfigStep`
- Excel 样式 ID 支持：
  - `compareCardIds`：Excel 风格比较（A < B < AA）
  - `getAllUsedCardIds`：收集环境配置 + 会话 + 临时使用过的卡片 ID
  - `generateNextCardId`：委托 `DataManager.generateNextCardId`，确保连续与不冲突
  - `generateNextOptionId`：同理，对选项 ID
  - 对外别名：`generateCardId`、`generateOptionId`

6) `presets.js`
- 预设映射加载/保存：`loadPresetMappings`、`savePresetMappings`
- 预设应用：`savePresetForSelectOption`、`applyPresetToCard`

7) `cards.js`
- 会话/临时卡片：`loadSessionCards`、`addTempCard`、`updateTempCard`、`promoteToSession`
- 结构规范化：`normalizeCardStructure`（保证选项与下拉 ID 纯数字、卡片 ID 合规）
- 卡片增删改：`addCard`、`deleteCard`、`updateSessionCard`、`updateCardTitle`、`updateCardOptions`
- 选项/下拉：`addOption`、`deleteOption`、`addSelectOption`、`deleteSelectOption`、`setShowDropdown`、`generateNextSelectOptionId`
- 编辑态切换：`toggleSelectEditing`、`toggleTitleEditing`、`toggleTitleEditingForRoot`、`toggleOptionsEditing`、`togglePresetEditing`、`toggleEditableField`
- 持久化/校验：`saveSessionCards`、`validateConfiguration`、中期存储 `loadAllMediumCards`、`saveToMedium`、`removeFromMedium`、`loadFromMedium`
- 导入导出：`exportData`、`importData`
- 预设联动：`updateCardSelectedValue` 触发预设应用

8) `subModes.js`
- 子模式实例加载：`loadSubModeInstances`
- 环境配置解析为可视/权限数据：`parseSubModeData`（卡片与选项的编辑位取自授权）

9) `feedback.js`
- 匹配提交：`submitForMatching`（校验 `fullOptionId`）、生成反馈、持久化到 `DataManager`

10) `dataSection.js`
- 数据段管理：`isModeData`、`generateTooltip`、同步状态文本/样式 `getSyncText`/`getSyncClass`
- 权限判定：`canEditItem`
- 列表筛选与全选：`checkSyncStatus`、`updateSelected`、`handleSelectAll`
- 删除/批量删除：`deleteItem`、`deleteSelected`
- 导入预览/应用/取消：`importDataFromFile`、`applyPreview`、`cancelPreview`、`exportDataSection`
- 过滤清空与模式切换：`clearFilters`、`setCurrentMode`
- 题目标准化透传：`normalizeQuestion`

11) `modes.js`
- 模式添加/删除（含路由联动）与持久化：`addMode`、`deleteModes`、`saveModesToStorage`
- 模式查询：`getMode`

12) `init.js`
- 初始化流程编排：`initialize`
- 按原顺序加载所有区块数据，初始化路由，绑定 `storage` 事件，保持时序一致

13) `modeLocalEdit.js`
- 模式内“本地编辑”（受授权位限制）的字段写入
- 同步环境配置（仅 root 下），并在结束时 `saveSessionCards` 保持一致性

保留与兼容性说明
- `src/components/Data/store.js`
  - 完整保留原 state 与 getters（字段名、结构、默认值不变）
  - `actions` 改为委托到 `store-parts`，对外名称、参数、返回值保持一致
  - 仅 `sendFeedbackToRoot` 仍在 `store.js` 内部以保持清晰
  - 继续导出常量：`FIELD_IDS`、`FIXED_SYNC_FIELDS`、`CONFIGURABLE_SYNC_FIELDS`、`AUTHORIZABLE_FIELDS`
  - 继续导出类：`SessionStorageEnhancer`（接口不变）
- `DataManager`/`api.js` 未改动；所有数据与校验职责仍在原处
- 动态路由仍基于 `OtherModeTemplate` 创建，`meta.requiresAuth` 保持为 `true`
- 所有持久化键名/结构不变：`app_user_modes`、`root_mode_config`、`app_medium_cards`、`generated_modes`、`card_preset_mappings`、以及 `session_{timestamp}:<modeId>:cards`

关键不变性（验证点）
- Excel 样式唯一 ID 系统保留：
  - 生成：`generateNextCardId` / `generateCardId`、`generateNextOptionId` / `generateOptionId` 委托 `DataManager`，并在 `normalizeCardStructure` 中保证选项与下拉 ID 均为纯数字字符串，避免 UI 受 Date.now 等影响
  - 比较：`compareCardIds` 保持 Excel 风格比较规则
  - 占用集合：`getAllUsedCardIds` 仍合并环境配置/会话/临时三方，确保唯一性
- 联动同步与授权：
  - `checkSyncPermission`、`isFieldSynced`、`coordinateMode`、`syncToTargetMode` 的业务规则与写入顺序不变
  - 授权位 `setFieldAuthorization` 的 key 规则与持久化一致
- 题库校验：
  - 表达式正则、引用 ID 存在校验保持一致
- 环境配置：
  - `normalizeCards`、`normalizeOptions`、写入时机不变；`notifyEnvConfigChanged` 触发子模式解析
- 导入/导出：
  - 入口参数、错误处理与返回结构保持不变
- 所有 UI 编辑态 toggle 的“禁用期间不可切换”逻辑保持不变（尤其预设编辑期间）

已知事项
- 本次拆分不修复原有历史问题（你说明：即便有问题也是拆分前的老问题）
- 若后续在各模块内新增行为，请继续遵守“仅管理功能性状态、不持有业务数据”的边界

建议的后续维护准则
- 新功能优先落在 `store-parts` 某个既有模块；若属于新功能域，再新增一个模块文件，最后在 `store.js` 增加一条委托映射即可。
- 避免在模块内引入额外状态实例；所有状态/副作用均通过 `store` 实例读写。
- 严格保持 `watch` 时序与 flush 语义（如未来引入），避免渲染时序变化导致 UI 细微抖动。

变更记录
- 新增 `store-parts/*` 12 个模块文件，职责如上所述。
- `store.js` 精简为聚合/门面层：保留原 state 与 getters；actions 改为一行委托调用。
- `routing.js` 内的 `OtherModeTemplate` 相对路径调整为 `../../Othermodes/OtherModeTemplate.vue`。

如需我导出全套 `store-parts` 的最终版本（便于复制粘贴），可以继续回复，我会将所有文件一次性贴出。祝使用顺利！