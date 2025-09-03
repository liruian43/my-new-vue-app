# id.js 改造日志（架构与关键点说明）

本文记录 Data/services/id.js 的本次改造背景、目标、核心变更、兼容性影响、注意事项与验收要点，聚焦整体情况和关键点，不包含具体代码或实现细节。参考文件：<mcfile name="id.js" path="src/components/Data/services/id.js"></mcfile>

## 1. 背景与问题陈述
- 系统采用离线模式，所有数据持久化到 LocalStorage，强约束使用"五段 Key"格式定位：prefix:modeId:version:type:excelId。
- 既有实现以 questionBank/envFull 两类数据为主，后续引入 answers（子模式回答）与 @meta（元数据）后，需要：
  - 完整统一 Key 规则与校验；
  - 兼顾"题库左侧表达式"的 ExcelID 语义；
  - 为"提交按钮（子模式回答聚合）"提供可靠、合规的落盘方案。

## 2. 改造目标
- 统一：确保所有落盘键严格采用"五段 Key"，并对每一段做规范化与校验。
- 扩展：新增支持 @meta 类型用于聚合（非卡片/选项级）数据的存储。
- 安全：对特殊类型采用更严格的语义校验（如 modeId 不能包含冒号、version 非空等）。
- 易用：提供成体系的 Key 工具（生成、解析、批量操作、分布分析）以辅助版本迁移与排错。
- 兼容：不破坏 questionBank/envFull 既有约定，同时引入 answers 的一致性规则。

## 3. 改造前 vs 改造后（概览）
- 改造前
  - 仅面向 questionBank / envFull 的基本 Key 组合与解析；
  - excelId 统一按 ExcelID 校验（卡片/选项级）；
  - 缺少对"非卡片/选项级聚合对象"的标准化支持；
  - 与多模式（modeId）与版本管理的校验规则较为松散。
- 改造后
  - 新增类型体系：questionBank / envFull / answers / @meta（含中文与别名映射）；
  - questionBank 类型被限制只能在 root_admin 模式下使用，且其 ExcelID 形态是"卡片序号.可选的子序号"，如 A1 或 A1.2/A1.3；
  - envFull/answers 类型：excelId 强制为占位符 main；
  - @meta 类型：excelId 实为 name，任意非空名称，专用于聚合与索引数据；
  - 强化 modeId 与 version 规范化与校验；
  - 引入批量 Key 工具与分布分析工具，支撑巡检与迁移；
  - 为题库类型预留专属规范化钩子，兼容题库表达式的 ExcelID 语义。

## 4. 核心变更清单
- 类型系统与别名映射
  - 新增 TYPES.ANSWERS 与 TYPES.META（@meta），并为各类型提供别名/中文映射。
  - 保持 questionBank / envFull 的既有语义不变。
  - 类型枚举与别名映射是完备且严格的，normalizeType 会将中文/别名统一归一化为四类之一：questionBank / envFull / answers / @meta。见 <mcsymbol name="TYPES" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="73" type="function"></mcsymbol> 与 <mcsymbol name="normalizeType" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="112" type="function"></mcsymbol>。

- Key 生成与解析（buildKey/parseKey）
  - 通用：五段均做 URL 安全编码与严格校验；失败时提供详细调试信息。见 <mcsymbol name="buildKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="256" type="function"></mcsymbol> 与 <mcsymbol name="parseKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="293" type="function"></mcsymbol>。
  - questionBank 特例：仅在 root_admin 模式下合法，ExcelID 形如 A1 或 A1.2/A1.3。
  - envFull/answers 特例：excelId 强制为 main 占位符，见 <mcsymbol name="PLACEHOLDER_MAIN" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="106" type="function"></mcsymbol>。
  - @meta 特例：excelId 实为 name，任意非空名称；parseKey 返回 excelIdKind='meta'。

- 元数据 Key 能力（Meta Key）
  - 新增 buildMetaKey / parseMetaKey / normalizeMetaName：用于聚合对象、索引、统计与历史记录。见 <mcsymbol name="normalizeMetaName" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="442" type="function"></mcsymbol> <mcsymbol name="buildMetaKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="448" type="function"></mcsymbol> <mcsymbol name="parseMetaKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="459" type="function"></mcsymbol>。
  - 场景：存储"子模式实例"、"统计数据"、"运行态指针"等非 ExcelID 维度数据。

- ID/版本/模式校验强化
  - modeId：新增规范化与合法性校验（非空、禁止冒号等），见 <mcsymbol name="isValidModeId" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="36" type="function"></mcsymbol>，并引入 ROOT_ADMIN_MODE_ID 常量，见 <mcsymbol name="ROOT_ADMIN_MODE_ID" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="30" type="function"></mcsymbol>。
  - version：统一 normalizeVersionLabel 与 isValidVersionLabel，见 <mcsymbol name="normalizeVersionLabel" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="61" type="function"></mcsymbol> 和 <mcsymbol name="isValidVersionLabel" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="64" type="function"></mcsymbol>。
  - prefix：默认 APP，可通过 setSystemPrefix 调整，见 <mcsymbol name="setSystemPrefix" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="18" type="function"></mcsymbol>。

- ExcelID 中心能力完善
  - 提供卡片/选项级 ExcelID 的判别、规范化、拆分、排序、生成等全套工具，确保类型间一致性。见 <mcsymbol name="normalizeExcelId" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="221" type="function"></mcsymbol> 与相关 ExcelID 函数导出。

- 批量与分析工具
  - extractKeysFields：按过滤条件提取五段Key任意字段，见 <mcsymbol name="extractKeysFields" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="489" type="function"></mcsymbol>。
  - analyzeKeysDistribution：统计分布与组合，辅助巡检，见 <mcsymbol name="analyzeKeysDistribution" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="564" type="function"></mcsymbol>。
  - batchKeyOperation：批量 list/count/delete/export，辅助迁移，见 <mcsymbol name="batchKeyOperation" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="634" type="function"></mcsymbol>。

## 5. 与"提交按钮（answers）"的落盘决策
- 正确的 Key 形态：APP:子模式ID:版号:answers:main（内部会进行 URL 编码）。这与先前建议用 @meta:answers%3Amain 的做法不同，且以当前实现为准，应使用 answers:main。
- 写入与读取建议：
  - 写入：用 <mcsymbol name="buildKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="256" type="function"></mcsymbol> 生成 Key（type='answers', excelId='main'），value 存 JSON 字符串（收集的标准化回答对象）。
  - 读取/枚举：可用 <mcsymbol name="parseKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="293" type="function"></mcsymbol> 做 Key 反解，或用 extractKeysFields / analyzeKeysDistribution / batchKeyOperation 进行批量筛选或导出。
- "提交"按钮最终落盘：
  - Key：使用 answers:main（前四段：APP、子模式ID、版号、answers；第五段固定 main）。
  - Value：JSON.stringify 后的回答聚合对象，内容包含：
    - 子模式中用户勾选的选项
    - 来自题库左侧表达式的规范化形式（如有需要，可另存为字段）
    - 来自全量区中相应 ExcelID 的选项详情（名称、值、单位等）

## 6. 兼容性与影响面
- questionBank：仅在 root_admin 模式下合法，ExcelID 需符合特定格式，见 <mcsymbol name="parseKey" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="293" type="function"></mcsymbol> 中的分支。
- envFull/answers：excelId 强制为 main 占位符，符合"聚合对象"的需要。
- 存量数据：
  - 若历史存在非规范 Key，建议使用 analyzeKeysDistribution + batchKeyOperation 做巡检与修复。
- UI/业务：
  - "提交"场景应将"整合后的回答主对象"写入 answers:main，读取"最新提交"可直接指向 main。

## 7. 注意事项（必读）
- Key 严格校验
  - modeId 非空且不能包含冒号；
  - version 非空；
  - type 必须是受支持的规范类型或其别名/中文，见 <mcsymbol name="isValidType" filename="id.js" path="c:\Users\47458\my-new-vue-app\src\components\Data\services\id.js" startline="116" type="function"></mcsymbol>；
  - questionBank 类型的 excelId 必须是合法 ExcelID（形如 A1 或 A1.2/A1.3）；
  - envFull/answers 类型的 excelId 必须为 main；
  - @meta 类型的 excelId（name）必须非空。

- @meta 的使用边界
  - 专用于"非 ExcelID 维度"的聚合/指针/索引类数据（例如统计、索引、配置）；
  - 避免与题库/全量区/回答主对象的命名空间冲突；
  - 它不是 answers 的替代品。

- 题库 ExcelID 语义
  - 左侧表达式仍以"选项级 ExcelID 集合"为准；必要时可通过专属规范化钩子统一输入语义与 Key 层校验。
  - ExcelID 工具集是严格的：卡片ID必须是大写字母（A..Z, AA..），选项ID必须是数字，像 A6 这样的选项级 ExcelID 会被拆分/校验/排序。

- 诊断与迁移
  - 建议上线前用 analyzeKeysDistribution 做一次全量扫描，确认分布；用 batchKeyOperation 导出/清理遗留 Key。
  - 用 extractKeysFields({ filters: { type: 'answers', excelId: 'main', modeId, version } }) 快速定位到唯一的 answers 主对象。

- 性能与稳定性
  - 建议序列化使用稳定字符串化策略（例如固定字段顺序），便于日志比对与快速定位问题；
  - 避免在 Key 中引入可变、无界增长的段值（尤其 @meta 的 name）。

## 8. 验收清单（不涉及具体实现）
- 五段Key在新增类型（answers/@meta）场景下均通过校验；
- answers:main 可成功落盘与回读"聚合回答主对象"；
- questionBank 类型仅能在 root_admin 模式下使用，且 ExcelID 符合指定格式；
- envFull/answers 类型写入非"main"的 excelId 会被拒绝并返回明确错误信息；
- 题库与全量区的既有 Key 不受影响，功能保持正常；
- 批量操作工具可正确列出、统计并导出指定前缀/模式/版本/类型范围内的 Key；
- 文档化示例（架构/落盘流程/注意事项）已同步到团队。

## 9. 术语与文件索引
- 规则中心：<mcfile name="id.js" path="src/components/Data/services/id.js"></mcfile>
- 题库：<mcfile name="questions.js" path="src/components/Data/store-parts/questions.js"></mcfile>
- 全量区：<mcfile name="envConfigs.js" path="src/components/Data/store-parts/envConfigs.js"></mcfile>

## 10. 后续演进建议
- 无需再考虑"answers:main"作为五段Key（非 ExcelID）的支持问题，当前实现已明确支持；
- 在题库类型上完善专属 ExcelID 规范化：
  - 明确 normalizeQuestionBankExcelId 的策略（如大小写、去空格、非法字符过滤、排序规则），与左侧表达式处理保持一致。
- 补充存储巡检工具的一键修复能力：
  - 对不合规 Key 给出建议修复方案（导出→变换→回写），进一步降低维护成本。

—— 本日志用于记录架构级改造的意图与边界，不包含具体代码变更。若需补充"提交按钮→落盘方案"的操作手册，我可以基于本日志输出一份流程说明。
