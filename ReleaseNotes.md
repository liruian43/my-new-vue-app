markdown

# ID/Key 统一化改造工作日志

## 问题背景
- **核心诉求**：所有ID/Key生成必须通过`src/components/Data/services/id.js`统一处理
- **异常现象**：
  1. 版号显示为`default_version`（预期动态版号如`模式ID_v1`）
  2. 类型出现`meta`/`@meta`（预期仅`QUESTION_BANK`和`ENV_FULL`）

## 问题诊断
### 第一阶段：版号问题溯源
1. **DataManager分析**：
   - 发现构造函数中硬编码`this.versionLabel = 'default_version'`
   - initialize()未正确初始化版本标签

2. **调用链路验证**：
   ```mermaid
   graph TD
    业务层 --> DataManager.buildKey
    DataManager -->|未传递version| id.js
第二阶段：类型异常分析
meta key识别：

发现存在buildMetaKey独立逻辑
与五段式Key结构存在重叠
数据流向：

元数据与业务数据共用存储空间
未严格区分两种Key类型
解决方案实施
架构调整
统一Key结构：
JavaScript

// 新五段式结构
`${prefix}:${modeId}:${version}:${type}:${excelId}`
类型系统扩展：
JavaScript

export const TYPES = Object.freeze({
  QUESTION_BANK: 'questionBank',
  ENV_FULL: 'envFull',
  META: '@meta' // 明确元数据类型
})
关键修改点
DataManager重构：

移除默认版号设置
强制version参数校验
JavaScript

buildKey({type, excelId, modeId, version, prefix}) {
  if (!version) throw new Error('version参数必须显式传递')
  // ...校验逻辑...
}
envConfigs.js适配：

JavaScript

// 修改前
const key = buildMetaKey({name: 'current_version'})

// 修改后
const key = buildKey({
  type: TYPES.META,
  excelId: 'current_version',
  version: this.versionLabel
})
验证方案
单元测试：

所有buildKey调用必须传递version
类型必须为预定义值
集成测试：

五段式Key
转发调用
CardSection.vue
envConfigs.js
DataManager
id.js
最终解决方案
版本管理：

必须通过setVersionLabel显式设置
存储时自动添加版本标记
类型系统：

废弃独立meta key逻辑
元数据使用@meta类型标识
职责划分：

提供
仅作
直接调用
id.js
生成/解析方法
manager.js
存储代理
业务层
遗留事项
需要更新CARD_DATA_SPEC.md文档
检查所有历史数据的迁移方案
验证多模式下的版本兼容性


该日志完整记录了从问题发现到解决的全过程，包含：

- 问题现象描述

- 技术分析过程

- 架构决策要点

- 具体实现方案

- 验证方法设计

- 最终技术规范

需要补充或调整任何部分请随时告知。