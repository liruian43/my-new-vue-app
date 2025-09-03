# 五段 Key 机制——本次完善说明

本说明仅总结“在原有五段 Key 机制之上”的新增与调整，非推翻重做。

一、背景与定位
- 五段 Key 已长期存在，布局未变：prefix:modeId:version:type:excelId（各段做 URL 安全编码）
- 本次工作聚焦于：规则细化、职责边界、唯一性保障与比对规则落位
- 约束继续生效：localStorage 落盘必须使用五段 Key；内存中可自由使用任意单段或组合，落盘前再组装五段 Key

二、职责划分
- id.js：
  - 只负责格式规范化、五段 Key 的构建/解析、以及“带占用校验的唯一生成”
  - 不承担跨 Key 的语义比对（比较逻辑放在匹配引擎）
- matchEngine.js：
  - 提供 compareFiveSegmentKeys：严格比对前四段；若任一 Key 的第五段为占位符 main，则跳过第五段的相等性判断
- manager.js：
  - 负责读写编排、状态同步；可选地将所有写入统一切换为使用 buildKeyUnique 以自动保障唯一

三、规则细化（类型与第五段）
- questionBank：
  - 仅允许在 root_admin 模式下写入
  - 第五段为 ExcelID：允许基础形态 A1，也允许小版本 A1.2、A1.3 …
  - 重复编号从 .2 开始（A1 → A1.2 → A1.3），.1 视为首个实例的隐含版本
- envFull / answers：
  - 第五段固定为占位符 main；若同一 (prefix, modeId, version, type) 再次写入则视为冲突
- @meta：
  - 第五段为非空的 name，需在同一 (prefix, modeId, version) 下唯一

四、新增/调整点（在既有机制上完善）
- buildKeyUnique（id.js）：
  - 在给定存储（默认 localStorage）上检查占用，生成“绝对唯一”的五段 Key
  - 冲突策略：
    - questionBank：自动对 ExcelID 递增小版本（A1 → A1.2 → A1.3 …）直至找到空位
    - envFull/answers：第五段固定 main，冲突直接抛错，避免生成完全相同 Key
    - @meta：name 语义唯一，冲突抛错，交由上层改名
  - 未提供可用 storage 时，为保证“绝对唯一”，直接抛错
- generateQuestionBankExcelId：明确首次重复从 .2 开始
- 比对逻辑外移：compareFiveSegmentKeys（matchEngine.js）负责五段 Key 的对比准则：
  - 严格顺序与严格校验前四段（prefix、modeId、version、type）
  - 若任一第五段为 main，则跳过第五段的相等性判断

五、使用建议
- 只需“规范化构建”时用：buildKey
- 需要“保证唯一并落盘”时用：buildKeyUnique（浏览器默认用 localStorage；非浏览器请显式传入 storage）
- 核心写入路径（题库/全量区/回答/@meta）建议在 manager.js 统一切换到 buildKeyUnique，减少一致性成本

六、验证清单（建议冒烟）
- 连续写入 3 条首个 ExcelID 相同的题库规则：应得到 A1、A1.2、A1.3
- 对相同 (modeId, version) 的 envFull 或 answers 二次写入：第二次应抛错（main 冲突）
- parseKey 能正确解析合法 Key；非法类型/ExcelID 时返回明确错误信息

七、关键文件
- src/components/Data/services/id.js：五段 Key 构建/解析、唯一生成（buildKey/buildKeyUnique/parseKey 等）
- src/components/Data/matchEngine.js：compareFiveSegmentKeys（前四段严格，若含 main 则跳过第五段）
- src/components/Data/manager.js：读写编排，可统一改造为落盘时使用 buildKeyUnique