# 2025-08-18 全量区 & 题库重构工作日志

## 一、工作背景
- **代码库**：Vue 3 Composition API 重构阶段  
- **当前模块**：`src/components/Data/store-parts/questions.js`、`src/components/Data/store-parts/envConfigs.js`  
- **界面文件**：`src/root_admin/CardSection.vue`

## 二、核心目标
1. **永远只用「版本号 + Excel ID」**  
   - 卡片：A、B、C…（列号）  
   - 选项：1、2、3…（行号）  
   - 组合：A1、B2、C3…  
2. **题库表达式**支持**任意多项**（A1+B2+C3…）  
3. **题库结果内容**任意字符（可换行、含特殊符号、未来可图片/附件）  
4. **界面默认行为**优化（下拉默认关闭、题库默认勾选）

---

## 三、已完成改动
| 文件 | 改动点 | 备注 |
| --- | --- | --- |
| `CardSection.vue` | 表达式预览 & 本地哈希改用数组索引 `1..N` | 不再引用内部 `option.id` |
| `envConfigs.js` | 快照构建 `buildEnvironmentFromSession` 及 `applyEnvFullSnapshot` 统一使用 `1..N` | 保证哈希一致，无抖动 |
| `questions.js` | `loadQuestionBank` & `addQuestionToBank` 增加独立 `content` 字段 | 兼容旧数据，右侧结果可任意字符 |
| `store-parts/cards.js` | 新增工具 `renumberOptions1toN` & `rebuildEnvOptionsForCard`，所有增删/导入/提升统一重排 `1..N` 并重建 A1/A2… 映射 | 彻底根治内部长数字 |
| `store-parts/rootMode.js` | 兜底初始化 `tempOperations`，修复 `Cannot read properties of undefined` 报错 | 兼容旧本地存储 |

---

## 四、待办事项（已确认需求）
| 序号 | 需求 | 优先级 | 预计工时 |
| --- | --- | --- | --- |
| ① | 卡片 ID 严格按 A→Z 顺序生成（第一张默认 A） | 高 | 0.5 h |
| ② | 题库「另存为」提示换行（`将保存为：…`） | 中 | 0.1 h |
| ③ | 全量库下拉加载后默认关闭按钮功能（可手动开启） | 中 | 0.1 h |
| ④ | 题库下拉加载后默认开启复选框，其余编辑功能默认关闭 | 中 | 0.1 h |

---

## 五、验证清单
- ✅ 新建卡片 → 选项 id 从 1 开始递增  
- ✅ 删除/新增/导入后 → 选项 id 重排为连续 1..N  
- ✅ 表达式预览 → 显示 `A1+B2+C3…`（无长数字）  
- ✅ 保存全量快照 → 哈希与本地一致 → 不触发“自动清空版本”  
- ✅ 题库添加 → 同时保存 `expression` 与 `content` 字段  
- ✅ 旧题库加载 → 自动拆分 `content`，无异常  

---

## 六、下一步计划
1. 完成待办①～④  
2. 回归测试：增删选项、保存快照、题库加载、版本切换  
3. 合并主干分支，发布今日补丁版本 `v2025.08.18-patch`