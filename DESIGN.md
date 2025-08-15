# 项目规范文档（完整细节版）

## 目录
1. 前言
2. Excel样式ID规范
   2.1 基础格式定义
   2.2 生成规则
   2.3 解析规则
   2.4 在题库中的应用规则
   2.5 在全量配置库中的应用规则
   2.6 转换与兼容规则
   2.7 操作规范
   2.8 错误处理
3. 卡片数据结构规范
   3.1 通用核心原则
   3.2 八项内容规范（完整版）
   3.3 五项内容规范（简化版）
   3.4 两项规范的关系与删减说明
   3.5 同步/授权状态标记规范
   3.6 反例警示与正确示例
   3.7 关键逻辑映射
4. 多模式数据处理规范
   4.1 空值（null与空字符）转换规则
   4.2 数据流转设计
   4.3 系统文件结构与职责划分
5. 系统核心架构与业务流程
   5.1 系统核心目标
   5.2 核心概念定义
   5.3 核心数据结构
   5.4 关键业务流程
   5.5 匹配规则细节（核心约束）
6. 项目架构设计
   6.1 核心设计原则
   6.2 分层架构与职责
   6.3 数据流向（含解析流程）
   6.4 数据模型定义
   6.5 核心接口定义
   6.6 设计决策说明
7. 六大模块规范映射
   7.1 主模式（root_admin）交互
   7.2 题库
   7.3 环境全量信息区
   7.4 联动同步授权推送区
   7.5 其他模式交互层
   7.6 匹配引擎反馈层
8. 附录

## 1. 前言
本文档整合项目涉及的Excel样式ID、卡片数据结构、多模式数据处理、系统架构与业务流程、项目架构设计及六大模块等所有规范内容，为开发人员提供统一、完整的参考标准，确保系统各模块遵循一致规则，减少因规范不统一导致的开发问题和数据混乱。

## 2. Excel样式ID规范

### 2.1 基础格式定义
采用"字母+数字"组合格式，精确对应卡片与选项关系：
- 卡片标识：纯大写英文字母（A-Z, AA-AZ, BA-BZ...），代表唯一卡片
- 选项标识：纯阿拉伯数字（1,2,3...），代表卡片下的选项
- 完整格式示例：`A1`（A卡片第1个选项）、`BC3`（BC卡片第3个选项）

### 2.2 生成规则
- **卡片标识生成**：
  - 初始标识为"A"，按字母顺序递增（A→B→...→Z）
  - 单字母用尽后使用双字母（AA→AB→...→AZ→BA→...→BZ），依次扩展位数
  - 生成函数：`generateNextCardId(lastCardId: string): string`
  - 示例：lastCardId为"Z"时返回"AA"，lastCardId为"AZ"时返回"BA"

- **选项标识生成**：
  - 每个卡片的首个选项标识为"1"
  - 新增选项时，标识为当前卡片最大选项标识+1
  - 生成函数：`generateNextOptionId(cardId: string, existingOptions: string[]): string`
  - 示例：卡片"A"现有选项["1","3"]时，新增返回"4"

### 2.3 解析规则
- 解析函数：`ExcelStyleUtils.parseCombinedId(combinedId: string): ParsedResult`
- 返回结构：
  ```typescript
  interface ParsedResult {
    combinedId: string; // 完整ID（如"A1"）
    cardId: string; // 卡片标识（如"A"）
    optionId: string; // 选项标识（如"1"）
    isValid: boolean; // 是否有效格式
  }
  ```
- 解析正则：`/^([A-Z]+)(\d+)$/`
- 无效格式示例："a1"（小写）、"1A"（数字在前）、"A-1"（含特殊字符）

### 2.4 在题库中的应用规则
- 配方规则表达式格式：`选项组合+运算符+结果`
- 基础表达式示例：
  - 数值运算：`A1（数值=5）+ B2（数值=3）→ 8`
  - 文本组合：`C3（内容="玄铁"）+ D4（内容="铸造"）→ 玄铁铸造剑`
  - 混合条件：`A1（5）+ B2（3）+ C3（玄铁）→ 玄铁重剑（重量8kg）`
- 优先级标记：表达式末尾添加`(priority=N)`，N为数字（1-10，默认1）
  - 示例：`A1+B2→青铜剑(priority=1)`、`A1+B2+C3→玄铁剑(priority=3)`

### 2.5 在全量配置库中的应用规则
- 全量配置库`fullConfigs`以组合ID为键：
  ```typescript
  interface FullConfigs {
    [combinedId: string]: {
      combinedId: string;
      cardId: string;
      optionId: string;
      optionName: string | null;
      optionValue: string | number | null;
      optionUnit: string | null;
      needValue: boolean;
      valueType: 'string' | 'number' | null;
      syncStatus: SyncStatus;
    }
  }
  ```
- 依赖关系存储：`dependencyMap`记录选项与配方的关联
  ```typescript
  interface DependencyMap {
    [optionId: string]: string[]; // 键为选项ID，值为引用该选项的配方ID列表
  }
  ```

### 2.6 转换与兼容规则
- 大小写转换：手动输入小写字母时自动转为大写（如"a1"→"A1"）
- 旧格式兼容：对于历史数据中使用的"#A-1"格式，通过`convertLegacyId(legacyId)`转换为"A1"
- 转换函数：
  ```javascript
  function convertLegacyId(legacyId) {
    const match = legacyId.match(/#([A-Za-z]+)-(\d+)/);
    return match ? match[1].toUpperCase() + match[2] : legacyId;
  }
  ```

### 2.7 操作规范
- 手动输入限制：仅主模式允许手动输入ID（用于批量导入），其他模式只读
- 批量导入校验：导入时需通过`validateBatchIds(ids: string[])`批量校验，返回所有无效ID
- 编辑限制：已被配方引用的ID禁止修改，需先解除引用关系

### 2.8 错误处理
- 重复ID冲突：生成时检测到重复自动+1，返回`{ newId: string, isDuplicate: true }`
- 格式错误提示：`"ID格式错误，正确格式为大写字母+数字（如A1、BC3）"`
- 未注册ID引用：`"引用了未注册的选项ID：{id}，请先创建该选项"`
- 已引用ID删除：`"无法删除ID：{id}，该选项已被{count}个配方引用"`

## 3. 卡片数据结构规范

### 3.1 通用核心原则
- 结构完整性：无论是否有值/授权，所有字段必须完整存在（禁止因空值缺失字段）
- 同步与授权分离：`hasSync`控制是否展示值，`isAuthorized`控制是否允许编辑
- 空值明确化：未填充/未同步值必须显式为`null`，禁止`undefined`或省略字段
- 不可变性：数据更新必须通过指定接口，禁止直接修改原始数据

### 3.2 八项内容规范（完整版）
| 序号 | 字段标识         | 含义                  | 存在要求               | 同步规则               | 空值处理       | 数据类型       |
|------|------------------|-----------------------|------------------------|------------------------|----------------|----------------|
| 1    | `cardCount`      | 卡片数量              | 数组长度隐式体现       | 固定同步（源数组决定） | 数组长度为0    | number         |
| 2    | `optionCount`    | 选项数量（布局计算用）| 数组长度隐式体现       | 固定同步（源数组决定） | `0`            | number         |
| 3    | `cardOrder`      | 卡片顺序              | 数组索引隐式体现       | 固定同步（源数组决定） | 索引自然排序   | number[]       |
| 4    | `title`          | 卡片标题              | 必须有`title`字段      | 可配置同步（用户选择） | `null`         | string \| null |
| 5    | `optionName`     | 选项名称              | 每个`option`必须有`name`| 可配置同步（用户选择） | `null`         | string \| null |
| 6    | `optionValue`    | 选项值                | 每个`option`必须有`value`| 可配置同步（用户选择） | `null`         | string \| number \| null |
| 7    | `optionUnit`     | 选项单位              | 每个`option`必须有`unit`| 可配置同步（用户选择） | `null`         | string \| null |
| 8    | `selectOptions`  | 下拉菜单选项          | 必须为数组（允许空数组）| 固定同步（结构必传）   | `[]`（空数组） | string[]       |

### 3.3 五项内容规范（简化版）
| 序号 | 字段标识         | 含义                  | 存在要求               | 同步规则               | 空值处理       | 数据类型       |
|------|------------------|-----------------------|------------------------|------------------------|----------------|----------------|
| 1    | `title`          | 卡片标题              | 必须有`title`字段      | 可配置同步（用户选择） | `null`         | string \| null |
| 2    | `optionName`     | 选项名称              | 每个`option`必须有`name`| 可配置同步（用户选择） | `null`         | string \| null |
| 3    | `optionValue`    | 选项值                | 每个`option`必须有`value`| 可配置同步（用户选择） | `null`         | string \| number \| null |
| 4    | `optionUnit`     | 选项单位              | 每个`option`必须有`unit`| 可配置同步（用户选择） | `null`         | string \| null |
| 5    | `selectOptions`  | 下拉菜单选项          | 必须为数组（允许空数组）| 固定同步（结构必传）   | `[]`（空数组） | string[]       |

### 3.4 两项规范的关系与删减说明
- **删减字段及原因**：
  - `cardCount`：可通过存储卡片的数组长度（`allCards.length`）直接获取，无需冗余存储
  - `optionCount`：可通过卡片的`options`数组长度（`card.options.length`）获取
  - `cardOrder`：可通过卡片在存储数组中的索引（`allCards.indexOf(card)`）获取，简化排序逻辑
- **转换关系**：五项规范为八项规范的子集，可通过`expandToEightFields(fiveFieldCard)`函数转换为八项规范

### 3.5 同步/授权状态标记规范
- 状态存储结构：
  ```typescript
  interface SyncStatus {
    title: { 
      hasSync: boolean; // 是否同步
      isAuthorized: boolean; // 是否授权编辑
    };
    options: {
      name: { hasSync: boolean; isAuthorized: boolean };
      value: { hasSync: boolean; isAuthorized: boolean };
      unit: { hasSync: boolean; isAuthorized: boolean };
    };
    selectOptions: { 
      hasSync: true; // 固定为true，结构必须同步
      isAuthorized: false; // 固定为false，下拉选项仅主模式可编辑
    };
  }
  ```
- 默认值：新建卡片时默认`hasSync: false`，`isAuthorized: false`
- 同步规则：主模式可单独配置每个字段的`hasSync`和`isAuthorized`

### 3.6 反例警示与正确示例
| 反例（错误原因） | 正确示例（符合规范） |
|------------------|----------------------|
| `{ title: "" }`（空值用空字符串） | `{ title: null }`（空值显式为null） |
| 未同步`title`时缺失该字段 | `{ title: null }`（即使未同步，字段必须存在） |
| `{ optionCount: 3, options: [1,2] }`（数量与实际不符） | 不存储`optionCount`，通过`options.length`获取 |
| `{ selectOptions: null }`（下拉选项应为数组） | `{ selectOptions: [] }`（空数组） |
| 直接修改`optionValue`：`card.optionValue = 5` | 通过接口修改：`updateOptionValue(cardId, 5)` |

### 3.7 关键逻辑映射
- 卡片排序逻辑：`sortCards(cards: Card[]): Card[]`依据`cardOrder`数组索引
- 选项值类型转换：根据`valueType`自动转换，如`"5"`→`5`（当`valueType=number`时）
- 同步字段过滤：`filterSyncFields(card: Card, syncConfig: SyncConfig): Card`仅保留同步字段

## 4. 多模式数据处理规范

### 4.1 空值（null与空字符）转换规则
- 存储层统一标准：所有空值必须存储为`null`，禁止使用空字符串`""`
- 主模式编辑转换：
  - 用户输入空字符时，自动转换为`null`存储
  - 转换函数：`inputToStorage(value: string): string | null`
    ```javascript
    function inputToStorage(value) {
      return value.trim() === "" ? null : value.trim();
    }
    ```
- 展示层转换：
  - 存储的`null`在UI层展示为`""`（空输入框）
  - 转换函数：`storageToDisplay(value: any): string`
    ```javascript
    function storageToDisplay(value) {
      return value === null ? "" : String(value);
    }
    ```
- 同步过程保持：推送和接收数据时保持`null`不变，不在中间层转换

### 4.2 数据流转设计
- 主模式→其他模式流转步骤：
  1. 主模式触发同步（`triggerSync(modeId: string)`）
  2. 收集待同步数据（`collectSyncData(cardIds: string[])`）
  3. 应用同步规则过滤字段（`applySyncRules(data: Card[], syncConfig: SyncConfig)`）
  4. 附加同步状态标记（`attachSyncStatus(data: Card[])`）
  5. 推送至目标模式（`pushToMode(data: Card[], modeId: string)`）
  6. 目标模式接收并存储（`receiveSyncData(data: Card[])`）

- 数据校验节点：
  - 同步前校验：`validateBeforeSync(data: Card[])`检查格式完整性
  - 接收后校验：`validateAfterReceive(data: Card[])`修复可能的格式问题

- 冲突处理：
  - 主模式数据覆盖原则：同步时直接覆盖目标模式的对应数据
  - 本地修改提示：目标模式有未提交修改时，提示`"存在未保存修改，同步将覆盖，是否继续？"`

### 4.3 系统文件结构与职责划分
| 文件名 | 所在目录 | 核心职责 | 关键函数 |
|--------|----------|----------|----------|
| `ModeLinkageControl.vue` | `src/views/rootAdmin/` | 主模式同步配置界面，管理同步字段和授权规则 | `handleSyncConfigChange()`, `triggerSync()` |
| `OperationPanel.vue` | `src/views/otherModes/` | 其他模式用户操作界面，收集用户选择和输入 | `collectUserSelection()`, `submitToEngine()` |
| `ResultDisplay.vue` | `src/views/otherModes/` | 展示匹配引擎返回的结果 | `renderResult(result: Result)`, `handleNoResult()` |
| `matchEngine.js` | `src/core/` | 核心匹配逻辑，比对用户选择与配方规则 | `matchSelection(selection: Selection)`, `getHighestPriorityResult(results: Result[])` |
| `dataSyncService.js` | `src/services/` | 处理数据同步的服务层 | `pushSyncData()`, `receiveSyncData()`, `validateSyncData()` |

## 5. 系统核心架构与业务流程

### 5.1 系统核心目标
- 实现多模式下的卡片选项配置与数据同步
- 基于用户选择的选项组合，通过预设规则匹配并返回对应结果
- 确保数据在各模式间流转的一致性和权限可控性

### 5.2 核心概念定义
- **模式**：系统的不同操作环境，分为主模式（root_admin）和其他模式（如user_mode, guest_mode）
- **卡片**：包含一组相关选项的集合，具有唯一标识（如"A"、"BC"）
- **选项**：卡片下的具体条目，包含名称、值、单位等属性（如"A1"、"BC3"）
- **配方规则**：选项组合与结果的对应关系（如"A1=5+B2=3→屠龙刀"）
- **同步**：主模式向其他模式推送数据的过程
- **授权**：主模式允许其他模式编辑特定字段的权限设置

### 5.3 核心数据结构
- **卡片结构**：
  ```typescript
  interface Card {
    id: string; // 卡片标识（如"A"）
    title: string | null;
    options: Option[];
    syncStatus: SyncStatus;
    createdAt: string;
    updatedAt: string;
  }
  ```

- **选项结构**：
  ```typescript
  interface Option {
    id: string; // 选项标识（如"1"）
    name: string | null;
    value: string | number | null;
    unit: string | null;
    needValue: boolean; // 是否需要用户输入数值
    valueType: 'string' | 'number' | null;
    selectOptions: string[]; // 下拉选项列表
  }
  ```

- **配方规则结构**：
  ```typescript
  interface Recipe {
    id: string;
    result: string;
    combination: Array<{
      cardId: string;
      optionId: string;
      value?: string | number; // 数值条件（可选）
    }>;
    priority: number; // 1-10，默认1
    description: string | null;
  }
  ```

- **用户选择结构**：
  ```typescript
  interface Selection {
    modeId: string;
    userId: string;
    selections: Array<{
      cardId: string;
      optionId: string;
      value?: string | number;
    }>;
    timestamp: string;
  }
  ```

### 5.4 关键业务流程
#### 5.4.1 主模式配置流程
1. 主模式用户创建卡片（`createCard(title: string | null)`）
   - 系统自动生成卡片ID（如"A"）
   - 初始化`syncStatus`（默认`hasSync: false`）

2. 为主模式卡片添加选项（`addOption(cardId: string, optionData: OptionData)`）
   - 生成选项ID（如"1"）
   - 配置`needValue`、`valueType`等属性

3. 配置配方规则（`createRecipe(recipeData: RecipeData)`）
   - 选择参与组合的选项（如A1、B2）
   - 设置数值条件（如A1=5、B2=3）
   - 填写结果（如"屠龙刀"）和优先级

4. 配置同步规则（`setSyncConfig(cardId: string, config: SyncConfig)`）
   - 选择同步字段（如同步`optionValue`，不同步`title`）
   - 设置授权编辑字段（如允许编辑`optionValue`）

5. 执行同步（`syncToMode(cardId: string, modeId: string)`）
   - 推送配置好的卡片、选项和规则到目标模式

#### 5.4.2 其他模式使用流程
1. 接收并展示同步数据（`loadSyncedData(modeId: string)`）
   - 根据`syncStatus`展示字段（`hasSync: true`的字段）
   - 根据`isAuthorized`设置编辑权限

2. 用户操作（`userOperation(operation: UserOperation)`）
   - 选择选项（如A1、B2）
   - 输入数值（如A1=5、B2=3，仅`needValue: true`时显示输入框）

3. 提交选择（`submitSelection(selection: Selection)`）
   - 验证输入格式（如数值类型匹配`valueType`）
   - 将选择数据发送到匹配引擎

4. 匹配与结果展示（`processAndDisplayResult(selection: Selection)`）
   - 匹配引擎比对配方规则
   - 展示最高优先级结果（如"屠龙刀"）

### 5.5 匹配规则细节（核心约束）
- **完全匹配原则**：用户选择的选项组合（含数值）必须与配方完全一致
  - 示例：配方要求"A1=5+B2=3"，则用户必须同时选择A1和B2，且数值分别为5和3

- **数值匹配类型**：
  - 精确匹配：`valueType=number`时，必须完全相等（5≠5.0视为不匹配）
  - 文本匹配：`valueType=string`时，区分大小写（"玄铁"≠"玄鐵"）

- **优先级处理**：
  - 同时匹配多个配方时，取`priority`最大的结果
  - 优先级相同的配方，取创建时间最新的

- **部分匹配处理**：
  - 仅匹配部分选项组合时，返回"无匹配结果"
  - 示例：配方要求"A1+B2"，用户仅选择"A1"，视为不匹配

- **空值处理**：
  - 配方中包含的选项，用户未提供值（`null`）时，视为不匹配
  - 配方中未包含的选项，用户选择不影响匹配结果

## 6. 项目架构设计

### 6.1 核心设计原则
- **单一职责**：UI层仅负责展示与交互；状态管理作为中间层，负责逻辑中转和响应式代理；数据模块作为唯一数据源，负责数据存储、标准化、管理及正向解析。
- **严格分层依赖**：采用"UI层 → 状态管理 → 数据模块"的单向依赖链，**数据模块仅对状态管理暴露接口，UI层完全不感知数据模块的存在**。
- **数据唯一数据源**：所有数据（临时内存数据、持久化数据）均由数据模块持有，其他层仅通过状态管理间接访问，不存储任何数据副本。
- **数据解析分工**：
  - 正向解析（UI层杂乱数据 → 数据模块标准化数据）由数据模块负责；
  - 反向解析（数据模块标准化数据 → UI层展示格式）由状态管理负责。

### 6.2 分层架构与职责

| 层级         | 技术实现          | 核心职责                                                                                                                                                                                                                            | 禁止做的事                                                                                                                                                                                                 |
|--------------|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **UI层**     | Vue组件（.vue）   | 1. 渲染页面样式和交互元素（按钮、输入框等）；<br>2. 接收用户操作（点击、输入）并调用状态管理的方法；<br>3. 通过状态管理的响应式数据实现双向绑定（仅使用状态管理提供的展示格式数据）。                                                                                              | 1. 禁止直接引入或调用数据模块；<br>2. 不处理任何数据解析（包括格式转换、校验）；<br>3. 不存储任何数据（所有数据从状态管理获取）。                                                                                                                             |
| **状态管理** | Vue Pinia/Composition API | 1. 作为唯一中间层，接收UI层指令并转发给数据模块；<br>2. 从数据模块获取标准化数据后，进行反向解析（转换为UI友好的展示格式，如将对象转为数组）；<br>3. 维护响应式状态供UI层使用；<br>4. 处理交互流程逻辑（如判断"保存"按钮是否可点击）。                                                                 | 1. 不存储原始数据（所有数据从数据模块获取，不缓存副本）；<br>2. 不直接操作持久化存储（如localStorage，由数据模块统一处理）；<br>3. 不参与正向解析（不对UI原始数据做标准化处理）；<br>4. 禁止向UI层暴露数据模块的接口或实现细节。                                                                 |
| **数据模块** | JavaScript模块（manager.js） | 1. 管理所有数据：<br>   - 临时内存数据（用户交互中的未保存数据）；<br>   - 持久化数据（已保存到localStorage/数据库的数据）；<br>2. 负责正向解析：接收状态管理转发的UI原始数据，进行格式化、校验、补全（如将"a1"转为"A1"，过滤空值）；<br>3. 提供数据操作接口（CRUD），仅对状态管理开放；<br>4. 负责数据持久化逻辑（如同步到localStorage）。 | 1. 不处理UI交互逻辑或响应式状态；<br>2. 不参与反向解析（不关心UI展示格式）；<br>3. 不直接暴露内部数据（通过方法返回副本，避免外部修改源数据）；<br>4. 禁止向UI层直接暴露任何接口。                                                                                               |

### 6.3 数据流向（含解析流程）
以"用户编辑卡片选项并展示"为例，完整流程如下：

#### 6.3.1 正向解析流程（UI杂乱数据 → 数据模块标准化数据）
1. **UI层**：用户在输入框填写选项（原始数据可能杂乱，如`{ optId: '1', value: ' 红色 ' }`，带空格且字段名不规范）→ 调用状态管理的`updateOption(cardId, rawData)`方法。
2. **状态管理**：接收原始数据，不做解析，直接转发给数据模块的`updateTempOption(cardId, rawData)`方法。
3. **数据模块**：
   - 正向解析：对原始数据进行标准化（如将`optId`改为`id`，去除`value`的空格，校验`id`格式）；
   - 转换为标准格式：`{ id: '1', content: '红色' }`；
   - 更新内部临时内存数据，并返回"更新成功"的状态给状态管理。

#### 6.3.2 反向解析流程（数据模块标准化数据 → UI展示格式）
1. **数据模块**：状态管理调用`getCard(cardId)`方法 → 返回标准化数据（如`{ id: 'A', options: { '1': '红色', '2': '蓝色' } }`）。
2. **状态管理**：接收标准化数据，进行反向解析（转换为UI友好格式，如将`options`对象转为数组方便`v-for`渲染）→ 转换后：`{ id: 'A', optionsList: [{ id: '1', content: '红色' }, { id: '2', content: '蓝色' }] }`。
3. **UI层**：通过状态管理的响应式状态（`optionsList`），渲染选项列表。

### 6.4 数据模型定义

#### 6.4.1 核心数据结构（数据模块内部标准化格式）// 单张卡片（标准化格式）
interface Card {
  id: string; // 卡片唯一标识（大写字母，如"A"、"B"，由数据模块校验）
  name: string; // 用户自定义名称（去空格，默认"未命名"，由数据模块标准化）
  options: { [key: string]: string }; // 选项（键为数字ID字符串，值为去空格内容）
  // 示例：{ "1": "红色", "2": "蓝色" }
}

// 数据模块内部存储结构（完全隐藏）
interface DataModuleStorage {
  _tempData: { cards: { [id: string]: Card } }; // 临时内存数据（未保存）
  _persistedData: { cards: { [id: string]: Card } }; // 持久化数据
  _rules: { [key: string]: string }; // 组合规则（如"A1+B2": "红色中号"）
}
#### 6.4.2 UI层展示格式（状态管理反向解析后）// 卡片展示格式（供UI层渲染）
interface CardDisplay {
  id: string; // 同标准化格式
  name: string; // 同标准化格式
  optionsList: Array<{ id: string; content: string }>; // 数组格式，方便v-for渲染
  // 示例：[{ id: "1", content: "红色" }, { id: "2", content: "蓝色" }]
}
### 6.5 核心接口定义

| 模块       | 方法名                | 入参（UI原始数据/状态管理转发）                          | 出参（标准化数据/UI展示数据）          | 访问权限       | 说明                                                                 |
|------------|-----------------------|---------------------------------------------------------|---------------------------------------|----------------|----------------------------------------------------------------------|
| 数据模块   | init()                | -                                                       | void                                  | 仅状态管理     | 初始化数据（从持久化存储加载到内存）                                 |
| 数据模块   | getCard(cardId)       | cardId: string                                          | Card（标准化格式副本）                | 仅状态管理     | 返回卡片数据（优先临时数据，数据模块内部标准化格式）                 |
| 数据模块   | updateTempCard(rawData) | { id, name?, options? }（UI原始数据，状态管理转发）     | boolean（更新结果）                   | 仅状态管理     | 正向解析：将原始数据标准化后，更新临时内存数据                       |
| 数据模块   | persistCard(cardId)   | cardId: string                                          | boolean（持久化结果）                 | 仅状态管理     | 将临时数据同步到持久化存储                                           |
| 状态管理   | initStore()           | -                                                       | void                                  | 仅UI层         | 初始化状态（内部调用数据模块init）                                   |
| 状态管理   | loadCard(cardId)      | cardId: string                                          | void（更新响应式状态）                | 仅UI层         | 加载卡片数据：调用数据模块getCard → 反向解析为UI格式 → 更新响应式状态 |
| 状态管理   | updateOption(rawData) | { cardId, optionId, content }（UI原始数据）              | void（更新响应式状态）                | 仅UI层         | 转发原始数据到数据模块 → 接收更新结果 → 反向解析后更新UI状态         |
| 状态管理   | saveCard(cardId)      | cardId: string                                          | boolean（保存结果）                   | 仅UI层         | 调用数据模块persistCard → 同步更新响应式状态                         |

### 6.6 设计决策说明
- **为什么正向解析由数据模块负责？**<br>→ 数据模块是数据的最终存储者，必须由它定义"标准化格式"，并确保所有进入存储的数据都符合标准，避免因多层解析导致格式混乱。
- **为什么反向解析由状态管理负责？**<br>→ 状态管理是UI层的直接数据提供者，最清楚UI的展示需求（如数组格式方便渲染），由它转换可避免数据模块耦合UI逻辑，同时支持不同UI组件的灵活适配。
- **为什么数据模块必须返回数据副本？**<br>→ 防止状态管理或UI层直接修改数据模块的内部数据，确保所有数据变更都通过数据模块的接口完成，便于统一校验和日志记录。
- **为什么严格禁止UI层直接访问数据模块？**<br>→ 确保数据访问的单一入口（状态管理），避免多组件直接操作数据导致的同步问题，同时降低UI层与数据模块的耦合，便于后期修改数据模块实现。

## 7. 六大模块规范映射

### 7.1 主模式（root_admin）交互
#### 核心定位
规则配置中心，唯一拥有编辑权限的模块，负责卡片、选项、配方规则的创建与管理。

#### 核心功能与规范
1. **卡片与选项管理**：
   - 卡片ID生成必须使用`generateNextCardId()`，遵循"A→Z→AA→AB..."规则
   - 选项ID生成必须使用`generateNextOptionId()`，按"1→2→3..."递增
   - 卡片数据结构必须符合八项内容规范（完整版），确保所有字段存在

2. **配方规则配置**：
   - 规则表达式必须符合`选项组合+数值条件→结果`格式
   - 优先级设置必须为1-10的数字（默认1）
   - 规则创建后自动记录到`dependencyMap`，建立选项与规则的关联

3. **同步与授权管理**：
   - 通过`ModeLinkageControl.vue`配置同步字段（`hasSync`）
   - 通过`ModeLinkageControl.vue`配置授权编辑权限（`isAuthorized`）
   - 同步前必须执行`validateBeforeSync()`，确保数据格式正确

4. **数据操作规范**：
   - 所有修改先保存到临时数据（`_tempData`），确认后再持久化
   - 批量操作需使用事务机制（`batchOperation()`），确保原子性
   - 操作日志自动记录（`logOperation()`），包含操作人、时间、内容

### 7.2 题库
#### 核心定位
存储配方规则、卡片配置及关联关系的核心数据库，提供规则查询与匹配支持。

#### 核心功能与规范
1. **配方规则存储**：
   - 存储结构必须包含`id`、`result`、`combination`、`priority`字段
   - 组合条件`combination`必须精确记录`cardId`、`optionId`、`value`（如需要）
   - 示例：
     ```javascript
     {
       "id": "r1",
       "result": "屠龙刀",
       "combination": [
         { "cardId": "A", "optionId": "1", "value": 5 },
         { "cardId": "B", "optionId": "2", "value": 3 }
       ],
       "priority": 3
     }
     ```

2. **依赖关系管理**：
   - `dependencyMap`必须实时更新，记录每个选项被哪些规则引用
   - 选项删除前检查`dependencyMap`，有引用时禁止删除
   - 更新机制：规则创建/修改/删除时自动更新`dependencyMap`

3. **查询与索引**：
   - 建立组合条件索引（`combinationIndex`），优化匹配查询性能
   - 提供按卡片ID查询规则的接口（`getRulesByCardId(cardId)`）
   - 提供按选项ID查询规则的接口（`getRulesByOptionId(optionId)`）

4. **权限控制**：
   - 仅主模式可执行写操作（创建/修改/删除）
   - 其他模式仅可执行读操作（查询规则）
   - 写操作必须验证主模式权限令牌（`validateRootToken()`）

### 7.3 环境全量信息区
#### 核心定位
存储系统所有基础配置、状态及关联数据的全局信息区，提供全量数据访问支持。

#### 核心功能与规范
1. **全量数据存储**：
   - 存储结构`fullConfigs`必须以组合ID为键，包含所有卡片和选项的完整信息
   - 必须同时存储临时数据（`_tempData`）和持久化数据（`_persistedData`）
   - 数据必须包含同步状态（`syncStatus`）和时间戳（`createdAt`、`updatedAt`）

2. **数据完整性保障**：
   - 定期执行数据校验（`validateFullData()`），检查字段完整性和格式正确性
   - 发现异常数据自动备份并修复（`repairCorruptedData()`）
   - 数据版本控制（`dataVersion`），支持回滚到历史版本

3. **访问接口规范**：
   - 提供按组合ID查询的接口（`getFullConfigByCombinedId(combinedId)`）
   - 提供按卡片ID查询的接口（`getFullConfigsByCardId(cardId)`）
   - 所有查询接口返回数据副本，禁止返回原始引用

4. **性能优化**：
   - 高频访问数据缓存（`cacheFrequentlyUsedData()`）
   - 大数据量时分页加载（`getPagedConfigs(page, pageSize)`）
   - 定期清理无效数据（`cleanupInvalidData()`）

### 7.4 联动同步授权推送区
#### 核心定位
控制主模式与其他模式的数据同步逻辑，管理授权规则，确保数据单向流转。

#### 核心功能与规范
1. **同步规则执行**：
   - 严格按照主模式配置的`syncConfig`执行同步，未勾选字段不推送
   - 未同步字段在目标模式中强制设为`null`（即使源数据有值）
   - 同步过程保持数据类型一致（如数字不转为字符串）

2. **授权控制**：
   - 推送数据时附加`isAuthorized`标记，控制目标模式的编辑权限
   - 目标模式UI层必须根据`isAuthorized`设置控件状态（`disabled`或可编辑）
   - 授权变更时自动重新同步（`resyncOnAuthChange()`）

3. **同步流程保障**：
   - 同步前执行数据校验（`validateSyncData()`），过滤无效数据
   - 同步过程日志记录（`logSyncProcess()`），包含源、目标、时间、数据量
   - 同步失败自动重试（`retrySyncOnFailure()`），最多重试3次

4. **数据转换规范**：
   - 同步过程中保持`null`不变，不进行空值转换
   - 日期格式统一转换为ISO格式（`YYYY-MM-DDTHH:mm:ssZ`）
   - 大数值（超过安全整数范围）转为字符串传输

### 7.5 其他模式交互层
#### 核心定位
用户操作入口，接收用户选择/输入，展示同步的数据，提交选择到匹配引擎。

#### 核心功能与规范
1. **数据展示规范**：
   - 仅展示`syncStatus.hasSync: true`的字段，其他字段显示空白
   - 空值（`null`）在UI层显示为`""`（空输入框）
   - 下拉选项必须使用`syncStatus.selectOptions`数据，不可自定义

2. **用户操作控制**：
   - 仅`syncStatus.isAuthorized: true`的字段可编辑，其他字段设为`disabled`
   - 用户输入自动实时验证（`validateUserInput()`），不符合`valueType`时提示错误
   - 操作按钮状态联动（如未选择任何选项时"提交"按钮禁用）

3. **数据提交规范**：
   - 提交数据必须封装为`Selection`结构，包含`modeId`、`userId`、`timestamp`
   - 提交前执行最终校验（`finalValidateBeforeSubmit()`）
   - 提交失败时显示友好提示（`showSubmitError(error)`）并保留用户输入

4. **UI组件规范**：
   - 统一使用`OperationPanel.vue`作为操作入口组件
   - 卡片展示使用`CardDisplay.vue`，确保样式一致性
   - 选项输入根据`needValue`和`valueType`自动切换控件类型（文本框/数字框/下拉框）

### 7.6 匹配引擎反馈层
#### 核心定位
比对用户选择与配方规则，返回匹配结果，展示格式化反馈。

#### 核心功能与规范
1. **匹配逻辑实现**：
   - 严格遵循"完全匹配原则"，选项组合和数值必须与配方完全一致
   - 匹配过程：
     1. 提取用户选择的`combination`（`extractCombination(selection)`）
     2. 查询题库中包含该组合的所有规则（`queryMatchingRules(combination)`）
     3. 筛选完全匹配的规则（`filterExactMatches(candidates, combination)`）
     4. 按优先级排序并返回最高优先级结果（`getTopPriorityResult(matches)`）

2. **结果处理与格式化**：
   - 匹配成功时返回结构化结果：`{ success: true, result: string, recipeId: string }`
   - 匹配失败时返回：`{ success: false, message: "未找到匹配结果" }`
   - 结果格式化显示（`formatResultForDisplay(result)`），支持富文本展示

3. **性能与缓存**：
   - 匹配结果缓存（`cacheMatchResult(combination, result)`），有效期5分钟
   - 复杂组合匹配优化（`optimizeComplexCombinationMatch(combination)`）
   - 匹配超时控制（`setMatchTimeout(5000)`），超时返回失败

4. **异常处理**：
   - 处理无效选择数据（`handleInvalidSelection(selection)`）
   - 处理规则数据异常（`handleInvalidRules(error)`）
   - 记录匹配日志（`logMatchProcess(selection, result, duration)`）

## 8. 附录

### 8.1 术语表
| 术语 | 定义 |
|------|------|
| 组合ID | 卡片标识+选项标识的组合（如"A1"、"BC3"），用于唯一标识一个选项 |
| 正向解析 | 将UI层原始数据（可能格式不规范）转换为数据模块标准化格式的过程 |
| 反向解析 | 将数据模块的标准化数据转换为UI层友好展示格式（如对象转数组）的过程 |
| 同步状态（hasSync） | 控制字段是否在其他模式展示的标记，`true`为展示，`false`为隐藏 |
| 授权状态（isAuthorized） | 控制字段是否允许在其他模式编辑的标记，`true`为可编辑，`false`为只读 |
| 临时数据（_tempData） | 用户正在编辑但未确认保存的数据，仅存在于内存中 |
| 持久化数据（_persistedData） | 已确认保存的数据，存储在localStorage或数据库中 |
| 配方优先级 | 多个配方同时匹配时的选择权重，数字越大优先级越高（1-10） |
| 完全匹配 | 用户选择的选项组合及数值与配方要求完全一致的匹配方式 |

### 8.2 规范冲突处理原则
1. 当基础规范与模块规范冲突时，以模块规范为准（更具体场景适配）
2. 当新旧规范冲突时，以新规范为准，旧数据需按`migrateOldData()`函数迁移
3. 未明确覆盖的场景，需遵循"数据完整性"和"单向流"核心原则
4. 模块间规范冲突时，由架构设计规范仲裁（以分层职责和数据流向为依据）