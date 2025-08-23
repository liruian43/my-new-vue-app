# 工作日志 - 模式ID升级项目

**日期：** 2025-08-23  
**项目：** 模式ID（ModeID）复合键升级  
**目标：** 实现多模式数据隔离，主模式固定为 `root_admin`，子模式可任意命名。  
**核心：** 将模式ID纳入全局唯一Key，实现题库、环境配置等数据的模式级隔离。

---

## 📌 背景与问题

- 原系统为单模式，Key格式为：`{前缀}:{版本}:{类型}:{ExcelID}`  
- 现需支持多模式，要求Key格式升级为：**`{前缀}:{模式ID}:{版本}:{类型}:{ExcelID}`**  
- 主模式固定为 `root_admin`，子模式命名遵循“三不”原则：  
  - 不能为空  
  - 不能为 `root_admin`  
  - 不能重名  

---

## ✅ 已完成改造

| 模块 | 状态 | 说明 |
|------|------|------|
| **id.js** | ✅ **完成** | 已定义五段式复合键规则，支持模式ID，无需再修改。 |
| **manager.js** | ✅ **完成** | 已升级，使用 `buildKey` 和 `buildMetaKey`，正确传入 `modeId` 和 `version`，实现模式隔离。 |
| **store.js** | ✅ **完成** | 已适配，所有持久化调用均传入 `currentModeId`，确保数据隔离。 |
| **questions.js** | ✅ **完成** | 题库条目已加入 `modeId`，`key` 和 `hash` 均包含模式信息，支持按模式加载/保存。 |
| **longTerm.js** | ✅ **已精简** | 保留为 **专职导入导出 JSON 工具**，仅处理序列化/反序列化，不涉及Key构建。 |

---

## 🔧 关键变更点

### 1. Key结构升级
```text
原：APP:V1:questionBank:A6
现：APP:root_admin:V1:questionBank:A6
```

### 2. 数据存储隔离
- 题库：`APP:root_admin:V1:@meta:question_bank_main`
- 环境快照：`APP:root_admin:V1:@meta:env_full_snapshots_main`
- 卡片/选项：`APP:root_admin:V1:envFull:A6`

### 3. 模式切换逻辑
- `setCurrentMode(modeId)` 会切换 `currentModeId`，并自动重新加载该模式下的题库和环境快照。
- 数据清理：`clearModeSpecificData(modeId)` 可安全清除指定模式下的所有数据。

---

## ✅ 验证结果

| 场景 | 结果 |
|------|------|
| 主模式 `root_admin` 加载 | ✅ 正常加载 |
| 切换子模式 `张三` | ✅ 自动加载 `张三` 模式数据 |
| 导出/导入 JSON | ✅ 数据按模式隔离，无混淆 |
| 清理 `张三` 数据 | ✅ 仅清除 `张三` 模式，主模式不受影响 |

---

## 🧹 已清理与优化

- ✅ 删除冗余 `longTerm.js` 本地存储逻辑，由 `manager.js` 统一管理。
- ✅ 所有 Key 构建统一调用 `IdSvc.buildKey` 或 `IdSvc.buildMetaKey`，避免硬编码。
- ✅ 空值处理：缺失数据以 `null` 代替，确保架构存在。

---

## 📝 下一步建议

- 如需支持子模式创建，可在 UI 中调用 `isValidNewSubModeId()` 校验。
- 如需支持版本控制，可调用 `setVersionLabel(label)` 更新 `version` 段。
- 如需扩展更多数据类型，可在 `TYPES` 中添加新类型，配合 `buildKey` 使用。

---

## 📞 备注

本次升级 **无需修改 id.js**，其已完全支持复合键模式隔离。所有逻辑已集中至 `manager.js` 与 `store.js`，系统已具备多模式能力。

---

**状态：** ✅ **升级完成，系统稳定运行**  
**负责人：** 项目团队  
**下一步：** 创建子模式打通链路