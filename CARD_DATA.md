# 系统开发规范文档（完整版）

## 目录
1. 前言
2. 核心组件（UniversalCard）规范
3. 技术栈与开发环境
4. Excel样式ID规范
5. 卡片数据结构与状态管理规范
6. 多模式数据处理与流转规范
7. 系统核心架构与分层职责
8. 五大模块数据流程（主线）
9. 环境全量区与联动功能合并说明
10. Composition API使用规范
11. 附录

## 1. 前言
本文档整合项目全量规范，基于Vue 3技术栈实现，采用Composition API作为代码组织方式。系统以`src/components/UniversalCard/UniversalCard.vue`为核心受控组件构建，该组件为高复用整体组件，不可拆分调用，内部包含字段级逻辑和小组件功能，所有系统功能围绕其展开并通过外部命令对其进行控制。

核心目标是确保系统各环节遵循统一标准：数据完整性优先、分层职责清晰、同步授权逻辑明确，为开发提供唯一权威参考。本系统支持离线运行，开发阶段可使用网络资源，所有依赖需在开发阶段完成本地化配置。

## 2. 核心组件（UniversalCard）规范

### 2.1 组件定位与特性
`UniversalCard`是系统的基础构建块和核心交互单元，所有业务功能均围绕该组件展开，具有以下特性：
- **受控性**：完全通过外部props接收状态，通过emit反馈内部变化，自身不维护持久化状态
- **整体性**：作为完整组件使用，不可拆分调用其内部功能或组件
- **高复用性**：在系统各模块中保持一致的使用方式和交互逻辑
- **可配置性**：通过props灵活配置编辑权限、显示模式和功能开关

### 2.2 接口规范（Props与Emit）

#### 2.2.1 Props定义
| 属性名 | 类型 | 必须 | 默认值 | 说明 |
|-------|------|------|-------|------|
| className | String | 否 | '' | 自定义类名 |
| style | Object | 否 | {} | 自定义样式对象 |
| modelValue | String | 是 | - | 卡片标题，支持v-model双向绑定 |
| options | Array | 是 | - | 选项列表数据 |
| selectedValue | String | 否 | "" | 下拉选择器当前值 |
| selectOptions | Array | 否 | [] | 下拉选择器的选项列表 |
| showDropdown | Boolean | 是 | - | 控制下拉选择器显示/隐藏 |
| isTitleEditing | Boolean | 否 | false | 标题编辑模式开关 |
| isOptionsEditing | Boolean | 否 | false | 选项编辑模式开关 |
| isSelectEditing | Boolean | 否 | false | 下拉选择器编辑模式开关 |
| editableFields | Object | 否 | 见下文 | 控制各字段的可编辑性 |
| onAddOption | Function | 是 | - | 添加选项的回调函数 |
| onDeleteOption | Function | 是 | - | 删除选项的回调函数 |
| onAddSelectOption | Function | 是 | - | 添加下拉选项的回调函数 |
| onDeleteSelectOption | Function | 是 | - | 删除下拉选项的回调函数 |
| onDropdownToggle | Function | 是 | - | 切换下拉选择器显示状态的回调 |
| onSearchTermChange | Function | 否 | () => {} | 搜索词变化的回调函数 |

`editableFields`默认值：
```javascript
{
  title: true,
  optionName: true,
  optionValue: true,
  optionUnit: true,
  optionCheckbox: true,
  select: true,
  optionActions: true
}
```

#### 2.2.2 Emit事件
| 事件名 | 参数 | 说明 |
|-------|------|------|
| update:modelValue | newTitle | 标题更新事件，用于v-model双向绑定 |
| update:options | newOptions | 选项列表更新事件 |
| update:selectedValue | newValue | 下拉选择器值更新事件 |

### 2.3 使用规范
1. **引用方式**：
   ```vue
   <template>
     <UniversalCard
       ref="cardRef"
       v-bind="cardProps"
       @update:modelValue="handleTitleUpdate"
       @update:options="handleOptionsUpdate"
       @update:selectedValue="handleSelectedValueUpdate"
     />
   </template>
   ```

2. **禁止行为**：
   - 禁止直接修改组件内部DOM结构或样式
   - 禁止绕过props直接操作组件内部状态
   - 禁止拆分组件内部功能单独使用
   - 禁止在组件外部直接访问组件的内部方法（除非通过ref明确暴露）

3. **最佳实践**：
   - 通过组合式函数统一管理与组件的交互逻辑
   - 所有状态变更通过Pinia或组合式函数处理后再传递给组件
   - 编辑权限控制在外部逻辑中实现，组件仅接收最终的权限配置

### 2.4 组件内部结构说明
组件包含三个主要功能区域，均通过外部props控制：
1. **标题区域**：支持查看/编辑模式切换，通过`isTitleEditing`控制
2. **选项列表区域**：展示和管理选项，通过`isOptionsEditing`控制编辑状态
3. **下拉选择器区域**：提供搜索和选择功能，通过`isSelectEditing`控制编辑状态

## 3. 技术栈与开发环境

### 3.1 核心技术栈
- **框架**：Vue 3（使用`<script setup>`语法）
- **状态管理**：Pinia
- **样式解决方案**：CSS（Scoped）
- **构建工具**：Vite（支持离线开发）

### 3.2 离线运行配置
1. 所有依赖包需在开发阶段安装并打包到本地
2. 静态资源（图片、字体等）需本地化存储，避免使用CDN
3. 离线数据存储使用localStorage或IndexedDB
4. 构建配置确保生成完全离线可用的包

### 3.3 开发环境要求
- Node.js 16+
- npm 8+ 或 yarn 1.22+
- 网络环境（仅开发阶段需要，用于安装依赖）

## 4. Excel样式ID规范

### 4.1 基础格式定义
采用"卡片标识+选项标识"的组合格式，用于唯一定位卡片及下属选项：

- 卡片标识：纯大写英文字母序列（A-Z→AA-AZ→BA-BZ...），示例："A"、"BC"、"XYZ"
- 选项标识：纯阿拉伯数字（1,2,3...），示例："1"、"5"、"12"
- 完整ID：卡片标识+选项标识，示例："A1"（A卡片第1个选项）、"BC3"（BC卡片第3个选项）

### 4.2 生成规则
#### 4.2.1 卡片标识生成
初始标识为"A"，按字母顺序递增，单字母用尽后自动扩展位数：
- 单字母：A→B→...→Z（共26个）
- 双字母：AA→AB→...→AZ→BA→...→BZ（共26×26个）
- 以此类推（三字母、四字母等）

生成函数示例：
```javascript
function generateNextCardId(lastId) {
  let chars = lastId.split('');
  let i = chars.length - 1;
  while (i >= 0 && chars[i] === 'Z') {
    chars[i] = 'A';
    i--;
  }
  if (i < 0) chars.unshift('A');
  else chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
  return chars.join('');
}
```

#### 4.2.2 选项标识生成
每个卡片的首个选项标识为"1"，新增选项时，标识为当前卡片已有选项中的最大标识+1（与删除无关）：
- 示例1：现有选项["1","2","3"]→新增为"4"
- 示例2：现有选项["1","3","5"]→新增为"6"（最大标识为5，5+1=6）

生成函数示例：
```javascript
function generateNextOptionId(existingOptions) {
  const maxId = existingOptions.reduce((max, id) => {
    const num = parseInt(id, 10);
    return num > max ? num : max;
  }, 0);
  return (maxId + 1).toString();
}
```

### 4.3 解析规则
解析目标：将完整ID拆分为卡片标识和选项标识

解析函数示例：
```javascript
function parseCombinedId(combinedId) {
  const match = combinedId.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { isValid: false };
  return {
    combinedId,
    cardId: match[1],
    optionId: match[2],
    isValid: true
  };
}
```

无效格式示例："a1"（小写字母）、"1A"（数字在前）、"A-1"（含特殊字符）

## 5. 卡片数据结构与状态管理规范

### 5.1 核心数据结构（五项内容规范）
卡片及选项的基础结构必须包含以下字段，无论是否有值/是否同步，字段均需存在。新增**版本相关字段**以支持版本化管理：

| 字段标识 | 含义 | 数据类型 | 空值标准（数据层） | 说明 |
|---------|------|---------|-------------------|------|
| title | 卡片标题 | string \| null | null | 卡片的整体名称 |
| optionName | 选项名称 | string \| null | null | 单个选项的名称 |
| optionValue | 选项值 | string \| number \| null | null | 选项的具体数值或文本 |
| optionUnit | 选项单位 | string \| null | null | 选项值的单位（如"kg"、"个"） |
| selectOptions | 下拉菜单选项 | string[] | []（空数组） | 预定义的可选值列表 |
| versionId | 版本标识 | string \| null | null | 手动输入的版本名称（环境全量区和题库必填） |
| versionDesc | 版本描述 | string \| null | null | 版本的补充说明（可选） |
| versionCreatedAt | 版本创建时间 | string \| null | null | 版本创建的时间戳（自动生成） |

### 5.2 状态划分与管理原则
#### 5.2.1 状态分类及存储位置
**局部状态（组件/页面内部）**：
- 范围：如表单临时值、UI交互状态（展开/折叠、选中状态）、组件内计算中间值、当前编辑的版本临时信息
- 存储方式：通过组合式函数（composables）管理，每个功能独立封装
- 示例：`useFormEditor()`管理表单状态，`useVersionSelector()`管理版本选择状态

**全局共享状态（跨组件/页面）**：
- 范围：如用户信息、全局配置、多模块共享的同步状态（syncStatus）、环境全量区各版本配置、题库各版本规则
- 存储方式：通过Pinia Store管理，按业务域垂直拆分（如`useCardStore`、`useSyncStore`、`useVersionStore`）
- 示例：各模式的授权配置、卡片基础结构的全局索引、版本映射关系

#### 5.2.2 组合式函数（Composables）设计规范
1. **命名规范**：
   - 以`use`为前缀，后跟描述性名称（如`useCardEditor`、`useVersionManager`）
   - 文件名与函数名保持一致（`useVersionManager.js`导出`useVersionManager`）

2. **结构规范**：
   ```javascript
   // 版本管理组合式函数示例
   export function useVersionManager() {
     // 1. 声明响应式状态
     const currentVersion = ref(null)
     const versionList = ref([])
     const isVersionEditing = ref(false)
     
     // 2. 声明计算属性
     const hasVersion = computed(() => versionList.value.length > 0)
     
     // 3. 声明内部方法
     function validateVersionId(versionId) {
       // 验证版本号唯一性、格式合法性
       return !versionList.value.some(v => v.versionId === versionId) && /^[\w-]+$/.test(versionId)
     }
     
     // 4. 声明暴露的方法
     function createVersion(versionId, desc = '') {
       if (validateVersionId(versionId)) {
         const newVersion = {
           versionId,
           versionDesc: desc,
           versionCreatedAt: new Date().toISOString()
         }
         versionList.value.push(newVersion)
         currentVersion.value = versionId
         return newVersion
       }
       return null
     }
     
     function selectVersion(versionId) {
       currentVersion.value = versionId
     }
     
     // 5. 生命周期钩子（如需要）
     onMounted(() => {
       // 初始化加载版本列表
     })
     
     // 6. 返回需要暴露的状态和方法
     return {
       currentVersion,
       versionList,
       isVersionEditing,
       hasVersion,
       createVersion,
       selectVersion,
       validateVersionId
     }
   }
   ```

3. **组合规则**：
   - 组合式函数可相互调用（如`useCardEditor`可调用`useVersionManager`）
   - 避免循环依赖
   - 传递响应式数据时，使用`toRef`或`toRefs`保持响应性

4. **职责边界**：
   - 一个组合式函数专注于单一功能领域
   - 不直接操作DOM（DOM操作在组件中处理）
   - 不直接修改Pinia状态（通过返回事件或调用Store的action）

#### 5.2.3 Pinia Store设计规范
1. **Store拆分原则**：
   - 按业务功能拆分（如`cardStore`、`syncStore`、`environmentStore`、`versionStore`）
   - 每个Store不超过500行代码，过大时进一步拆分
   - 跨Store通信通过`storeToRefs`和action调用实现，不直接访问其他Store的state

2. **State设计**：
   - 新增版本管理相关状态，如环境全量区的`versionedConfigs`（按版本ID存储配置）、题库的`versionedExpressions`（按版本ID存储组合规则）
   - 仅存储原始数据（字符串、数字、布尔值、数组、普通对象）
   - 复杂对象设计为结构化数据，便于响应式追踪
   - 避免深层嵌套（不超过3层）

3. **Action设计**：
   - 异步操作放在action中，且返回Promise
   - 新增版本相关action：如`createEnvironmentVersion`（创建环境全量版本）、`getEnvironmentByVersion`（按版本获取环境配置）、`bindLibraryToVersion`（将题库规则绑定到版本）
   - action命名使用动词开头（如`createVersion`、`getVersionedData`）

   ```javascript
   // 环境Store示例（含版本管理）
   export const useEnvironmentStore = defineStore('environment', {
     state: () => ({
       // 按版本ID存储环境全量配置
       versionedConfigs: {}, 
       // 版本元信息列表
       versions: [],
       currentVersion: null,
       loading: false,
       error: null
     }),
     
     getters: {
       // 获取当前版本的环境配置
       currentConfig: (state) => state.versionedConfigs[state.currentVersion] || null,
       // 获取所有版本ID
       versionIds: (state) => state.versions.map(v => v.versionId)
     },
     
     actions: {
       // 创建环境全量版本（手动输入版本号）
       createVersion(versionData) {
         const { versionId, config, desc } = versionData
         // 验证版本号唯一性
         if (this.versions.some(v => v.versionId === versionId)) {
           throw new Error(`版本号${versionId}已存在`)
         }
         // 存储版本元信息
         this.versions.push({
           versionId,
           versionDesc: desc,
           versionCreatedAt: new Date().toISOString()
         })
         // 存储对应版本的配置
         this.versionedConfigs[versionId] = config
         // 设置为当前版本
         this.currentVersion = versionId
         return versionId
       },
       
       // 按版本ID获取环境配置
       getConfigByVersion(versionId) {
         return this.versionedConfigs[versionId] || null
       },
       
       // 其他action...
     }
   })
   ```

#### 5.2.4 同步与授权状态（syncStatus）
同步控制"是否有数据可展示"，授权控制"是否允许编辑"，两者独立且需显式配置，作为全局状态由Pinia的useSyncStore管理。同步与授权需关联版本号，确保不同版本的配置独立生效：

```typescript
interface SyncStatus {
  versionId: string; // 关联的版本号
  title: { 
    hasSync: boolean; // 是否同步数据（true=有数据可展示，false=无数据）
    isAuthorized: boolean; // 是否允许编辑（true=可编辑，false=只读）
  };
  options: {
    name: { hasSync: boolean; isAuthorized: boolean };
    value: { hasSync: boolean; isAuthorized: boolean };
    unit: { hasSync: boolean; isAuthorized: boolean };
  };
  selectOptions: { 
    hasSync: true; // 固定为true（结构必须同步）
    isAuthorized: false; // 固定为false（仅主模式可编辑）
  };
}
```

#### 5.2.5 其他模式表现（核心逻辑）

| 场景 | 同步状态（hasSync） | 授权状态（isAuthorized） | 其他模式UI表现 |
|------|-------------------|-------------------------|--------------|
| 1 | false（未同步） | false（未授权） | 显示空白，控件禁用（不可编辑） |
| 2 | false（未同步） | true（已授权） | 显示空白，控件可交互（允许输入） |
| 3 | true（已同步） | false（未授权） | 显示同步的内容，控件禁用（灰色） |
| 4 | true（已同步） | true（已授权） | 显示同步的内容（作为提示），控件可交互（允许修改） |

### 5.3 空值处理（分层职责）
空值处理严格遵循分层原则，禁止UI层参与数据转换：

| 层级 | 处理逻辑 | 示例 |
|------|---------|------|
| 数据层 | 所有空值必须显式存储为null（禁止使用空字符串""、undefined或缺失字段） | 未填写的标题存储为title: null |
| 状态管理层 | 包含两种处理方式：<br>1. 组件/Composables：将null转换为UI层可直接使用的空白（""）<br>2. Pinia：仅存储原始null，通过getters提供转换后的值供UI使用 | 转换函数：storageToDisplay = (v) => v === null ? "" : String(v) |
| UI层 | 直接使用状态管理层传递的已转换数据（空白），不处理任何值转换逻辑 | 输入框绑定displayValue（空白则显示空输入框） |

## 6. 多模式数据处理与流转规范

### 6.1 核心流转规则（跨模块通用）
- 同步触发：仅支持主模式手动点击同步按钮（无自动同步），同步时需指定目标版本
- 数据过滤：按syncStatus.hasSync和版本号筛选字段（未同步字段或非目标版本字段在目标模式中为null）
- 失败处理：同步失败仅支持手动重试（无自动重试），重试时保持原版本号
- 空值传递：流转过程中保持null不变，由状态管理层在各模块内转换为空白（引用5.3节）
- 版本关联：所有数据流转必须携带版本号，确保数据与对应版本的配置匹配

### 6.2 临时数据与持久化规则
**临时数据（_tempData）**：
- 定义：用户正在编辑但未确认保存的数据（如未点击"保存"按钮的草稿），包含临时版本信息
- 存储：作为局部状态，通过composables/useTempData.js管理（包含ref状态和操作方法）
- 转换：需手动点击"添加到题库"按钮（调用useTempData().persistToLibrary(versionId)）才转为持久化数据，转换时必须指定关联的版本号

**持久化数据（_persistedData）**：
- 存储位置：题库及环境全量区，作为全局状态由Pinia的useLibraryStore和useEnvironmentStore管理，按版本号分区存储
- 存储范围：手动添加时，自动存储全量信息（包括版本号、未勾选同步的字段、未编辑的空值字段）
- 关联存储：添加到题库时，必须指定关联的环境版本号，自动调用useEnvironmentStore().bindLibraryToVersion(libraryId, versionId)建立关联关系

## 7. 系统核心架构与分层职责

### 7.1 分层架构

| 层级 | 技术实现 | 核心职责 | 禁止行为 |
|------|---------|---------|---------|
| UI层 | 1. 核心：`UniversalCard.vue`（受控组件，整体使用）<br>2. 辅助：其他业务组件（.vue），含版本选择器、版本创建表单等 | 1. `UniversalCard`：负责核心卡片渲染、内部字段交互、接收外部命令<br>2. 其他组件：辅助展示与业务场景适配，处理版本选择/创建的UI交互<br>3. 所有UI组件通过组合式函数与状态层交互 | 1. 禁止修改`UniversalCard`内部实现<br>2. 禁止绕过组合式函数直接操作状态管理层<br>3. 禁止在UI组件中包含复杂业务逻辑 |
| 状态管理层 | 组合式函数（composables/*.js）、Pinia Stores（stores/*.js） | 1. 组合式函数：管理局部状态（含版本临时信息），封装组件内业务逻辑（如版本验证、临时数据处理），作为`UniversalCard`与系统其他模块的"通信桥梁"<br>2. Pinia：管理全局共享状态（含多版本配置），提供跨组件数据访问和修改接口（遵循State→Getters→Actions单向流）<br>3. 统一处理null→空白等数据转换及版本关联逻辑 | 1. 组合式函数禁止直接修改Pinia State（需通过Actions）<br>2. Pinia禁止存储局部状态（如仅某组件使用的UI状态）<br>3. 两者均不直接操作DOM |
| 数据模块 | JavaScript模块 | 1. 存储全量持久化数据（按版本分区对接本地存储或后端接口）<br>2. 执行正向解析（UI原始数据→标准化格式，含版本信息校验）<br>3. 提供数据操作接口（仅对状态管理层开放） | 1. 不处理UI交互逻辑<br>2. 不参与反向解析（不关心UI展示格式）<br>3. 不直接暴露内部数据（返回副本） |

### 7.2 数据流转模式
采用"单向数据流"模式，各层之间通过明确的接口通信，所有流转需携带版本号：

1. **用户交互流程（含版本操作）**：
   ```
   UI组件（版本输入/选择） → 组合式函数（版本验证+逻辑处理） → Pinia Action（按版本更新状态）
                                                                 ↓
   UI组件 ← 组合式函数（响应版本状态变化） ← Pinia State（版本化状态变更）
   ```

2. **数据加载流程（按版本）**：
   ```
   组合式函数（指定版本） → Pinia Action → API模块 → 后端服务/本地存储（版本化数据）
                                                       ↓
   组合式函数 ← Pinia State ← API模块 ← 后端服务/本地存储（版本化数据）
   ```

3. **跨组件通信流程（版本关联）**：
   ```
   组件A → 组合式函数A → Pinia Action（版本化数据更新） → Pinia State
                                                          ↓
   组件B ← 组合式函数B ← Pinia Getter（按版本获取） ← Pinia State
   ```

### 7.3 受控组件交互规范
`UniversalCard.vue`作为核心受控组件，其所有行为均由外部命令驱动，组合式函数是命令的"标准化封装者"，遵循以下原则：

1. **命令封装（含版本控制）**：
   对`UniversalCard`的所有操作（如更新字段值、切换编辑状态、同步数据）必须通过专用组合式函数封装，操作需关联版本号，禁止在组件外直接调用其内部方法。
   示例：`useUniversalCardController()`封装所有控制命令：

   ```javascript
   // composables/useUniversalCardController.js
   export function useUniversalCardController(cardId) {
     const cardRef = ref(null) // 绑定到UniversalCard的ref
     const { getSyncStatus } = useSyncStore()
     const { currentVersion } = useVersionManager()
     
     // 封装"按版本更新字段值"命令
     function updateFieldByVersion(fieldKey, value) {
       // 1. 校验版本是否存在
       if (!currentVersion.value) {
         alert('请先选择或创建版本')
         return false
       }
       
       // 2. 先通过状态层校验（如授权判断+版本匹配）
       const syncStatus = getSyncStatus(cardId, fieldKey, currentVersion.value)
       if (!syncStatus.isAuthorized) return false
       
       // 3. 标准化处理值（遵循5.3节空值规则）
       const normalizedValue = normalizeValue(value)
       
       // 4. 向受控组件发送命令
       if (cardRef.value) {
         cardRef.value.handleFieldUpdate(fieldKey, normalizedValue)
         return true
       }
       return false
     }
     
     // 封装"按版本同步数据"命令
     function syncByVersion(versionId) {
       const globalData = useCardStore().getCardDataByVersion(cardId, versionId)
       cardRef.value?.handleSyncData(globalData)
     }
     
     return {
       cardRef, // 供组件绑定ref
       updateFieldByVersion,
       syncByVersion,
       // 其他命令...
     }
   }
   ```

2. **状态同步**：
   `UniversalCard`的内部状态变化（如用户输入、交互反馈）需通过`emit`触发事件，由组合式函数接收并同步至对应版本的状态管理层，禁止组件直接修改Pinia状态。
   示例：组件内触发事件→组合式函数接收→同步至Store（按版本）：

   ```javascript
   // 在组件中使用
   const { cardRef, updateFieldByVersion } = useUniversalCardController(cardId)
   const { currentVersion } = useVersionManager()
   
   // 监听组件内部变化，同步至对应版本的全局状态
   function handleCardChange(fieldKey, value) {
     useCardStore().updateCardFieldByVersion(cardId, currentVersion.value, fieldKey, value)
   }
   ```

3. **不可侵入性**：
   组合式函数仅通过"外部接口"与`UniversalCard`交互，不依赖或修改其内部实现（如不访问其内部data、不调用未暴露的方法），确保组件作为"黑盒"的完整性。

## 8. 五大模块数据流程（主线）
按数据从源头到结尾的顺序描述，明确模块间的衔接关系，所有流程需包含版本号管理：

### 8.1 主模式（root_admin）→ 数据源头
功能：
- 按ExcelID规则创建卡片/选项（引用4.2节），通过composables/useCardCreator.js管理创建过程的局部状态（如当前编辑的临时卡片数据）
- 配置卡片数据（title/optionValue等，引用5.1节），通过useCardConfig()处理配置逻辑
- **新增版本管理**：通过composables/useVersionCreator()提供版本号输入表单，验证版本号唯一性（禁止重复），支持版本描述录入
- 设定syncStatus（同步/授权规则，引用5.2节），通过Pinia的useSyncStore().setSyncStatus(config, versionId)按版本持久化全局同步配置

手动触发三个关键操作：
- 点击"创建环境全量版本"→ 调用useEnvironmentStore().createVersion(versionData)，将当前环境配置与手动输入的版本号绑定并存储
- 点击"保存到题库"→ 必须先选择已创建的环境版本，调用useTempData().persistToLibrary(versionId)将组合规则与指定版本关联后持久化
- 点击"同步到其他模式"→ 调用useSyncStore().syncToMode(targetMode, versionId)向环境全量区指定版本发起同步指令，传递对应版本的参数标准

创建版本的组合式函数示例：
```javascript
function useVersionCreator() {
  const { versions, createVersion } = useEnvironmentStore()
  const versionId = ref('')
  const versionDesc = ref('')
  const error = ref('')
  
  function validate() {
    if (!versionId.value.trim()) {
      error.value = '版本号不能为空'
      return false
    }
    if (versions.some(v => v.versionId === versionId.value.trim())) {
      error.value = `版本号${versionId.value}已存在`
      return false
    }
    if (!/^[\w-]+$/.test(versionId.value.trim())) {
      error.value = '版本号仅支持字母、数字、下划线和连字符'
      return false
    }
    error.value = ''
    return true
  }
  
  function submitVersion() {
    if (validate()) {
      return createVersion({
        versionId: versionId.value.trim(),
        versionDesc: versionDesc.value.trim()
      })
    }
    return null
  }
  
  return {
    versionId,
    versionDesc,
    error,
    validate,
    submitVersion
  }
}
```

### 8.2 题库 → 规则典籍（上半部经书）
核心定位：独立存储"组合表达式"及"逻辑规则"，**与特定版本的环境全量区强关联**，不存储具体参数，也不直接查询环境全量区（如同"只记载'A1+B2+C3→屠龙刀'的公式，且关联版本V1，表明该公式适用于V1版本的参数标准"）。

功能：
- 存储完整组合表达式（如A1+B2+C3→屠龙刀）及关联的`versionId`，仅包含元素ID的关联逻辑和版本标识，不包含任何参数值，由Pinia的useLibraryStore管理。
- 定义表达式的"语法规则"（如：A1必须与B2同时存在，C3需在A1之后生效等），规则校验逻辑抽离至composables/useExpressionValidator.js。
- 组合表达式的"标准顺序"遵循先按卡片标识字母排序，再按选项标识数字排序（如A1→A9→B1→B2→C3，即字母优先级高于数字，同字母内按数字升序）。
- 表达式存储时自动按标准顺序格式化（如用户输入B2+A1，题库会自动存储为A1+B2），格式化逻辑通过composables/useExpressionFormatter.js实现。
- 向反馈区提供"验证标准1"：通过useLibraryStore().validateExpression(elements, versionId)判断用户提交的元素组合是否符合对应版本表达式的元素集合要求（当前不严格验证顺序）。

### 8.3 环境全量区 → 参数典籍（下半部经书）
核心定位：**按手动创建的版本号独立存储所有元素的"具体参数标准"**，每个版本为独立快照，不包含组合逻辑，也不直接查询题库（如同"V1版本记载A1=玄铁150kg、B2=淬火工艺；V2版本记载A1=玄铁200kg、B2=回火工艺，但都不知道这些能组合成屠龙刀"）。

功能：
- **版本化存储**：通过手动输入版本号创建独立版本，每个版本存储该版本下所有元素的参数标准（如V1版本A1的optionValue标准范围为100-200kg，V2版本A1的标准范围为150-250kg），作为全局状态由useEnvironmentStore管理。
- 版本管理：支持版本创建、查询、切换，禁止删除已有版本（确保历史版本可追溯），通过composables/useEnvironmentVersionManager.js封装版本操作。
- 向反馈区提供"验证标准2"：通过useEnvironmentStore().validateParam(elementId, value, versionId)判断用户提交的元素参数是否符合指定版本的基础标准。
- 保留原联动同步功能（数据分发、授权管理等），同步逻辑封装在useEnvironmentStore的Actions中（如syncToModeByVersion、setFieldAuthorizationByVersion），同步时需指定版本号。

### 8.4 其他模式交互层 → 用户操作终端
功能：
- 通过useEnvironmentStore().getSyncedDataByVersion(modeId, versionId)接收环境全量区指定版本推送的同步数据（参数标准）
- 状态管理层处理展示转换：composables/useDisplayFormatter().format(data)将null转换为空白（引用5.3节），UI层按5.2.4节规则展示
- 版本选择：提供版本下拉选择器，仅显示已同步到当前模式的环境版本，通过composables/useModeVersionSelector()管理版本切换逻辑

数据提交原则：
- 提交时必须携带当前选择的版本号，确保与环境全量区和题库的版本匹配
- 提交内容以界面最终显示值为依据（无论该值是同步而来还是用户编辑输入）
- 若为"已同步+未授权"状态（同步内容不可编辑），自动提交界面上显示的同步内容（如同步内容为"500克"，则提交"500克"）
- 若为"已同步+已授权"或"未同步+已授权"状态，提交用户最终输入/修改的内容
- 若界面显示为空白（包括同步内容为null转换的空白、用户未填写的空白），提交时通过useDataNormalizer().toStorageFormat(value)自动转换为null（遵循5.3节空值标准）
- 收集用户操作后，通过composables/useSubmitHandler().submit(data, versionId)处理后提交至匹配引擎反馈层

### 8.5 匹配引擎反馈层 → 经书合璧验证区
核心定位：唯一能同时调用题库（上半部）和环境全量区（下半部）的模块，**基于同一版本号**通过两道验证实现"经书合璧"，输出最终结果。

功能：
1. 接收输入：通过useFeedbackReceiver().getUserInput()获取其他模式用户填写的完整数据及关联的版本号。
2. 第一道验证（题库规则验证）：
   - 调用useLibraryStore().getExpressionByVersion(targetResult, versionId)获取对应版本的组合表达式（如V1版本的A1+B2+C3→屠龙刀）
   - 接收用户提交的元素组合（可能无序，如B2+A1+C3），通过useExpressionFormatter().sort(elements)自动按"字母+数字"规则排序→ 转换为A1+B2+C3
   - 验证转换后的元素集合是否与该版本题库表达式完全一致（当前自动排序后验证，不严格限制顺序）
   - 若验证失败（如缺少B2），通过useFeedbackRenderer().showError("组合错误，V1版本需包含A1+B2+C3")返回提示

3. 第二道验证（全量区参数验证）：
   - 调用useEnvironmentStore().getParamStandardByVersion(elementId, versionId)获取指定版本的参数标准
   - 验证用户填写的具体参数是否符合该版本标准（如V1版本A1=180kg在范围内），验证逻辑通过composables/useParamValidator.js实现
   - 若验证失败（如A1=250kg超出V1版本范围），返回"参数错误，V1版本A1需在100-200kg之间"

4. 输出结果：两道验证均通过后，通过useFeedbackRenderer().showSuccess(`V1版本匹配成功→屠龙刀`, fullParams)输出结果，展示完整参数及版本信息。

## 9. 环境全量区与联动功能合并说明

### 9.1 合并可行性分析
数据关联性：
- 环境全量区存储基础配置数据（卡片、选项、参数标准等，按版本分区），联动功能本质是这些版本化数据的跨模式交互工具，两者属于"数据本体"与"交互能力"的强关联关系，合并后逻辑更紧密。

代码结构兼容性：
- 原实现中，环境配置变更会触发联动区的notifyEnvConfigChanged方法，说明两者已存在依赖关系；且联动功能（syncToMode、setFieldAuthorization等）核心是操作环境配置数据，合并后可减少跨模块调用，同时简化版本关联逻辑。

功能合理性：
- 联动同步作为环境全量区的内置功能，符合"数据管理+交互能力"的一体化设计模式，可简化数据流转链路（减少中间环节），降低版本管理的维护成本。

职责边界清晰：
- 环境全量区作为"原始信息仓库（含多版本）"，其核心是按版本存储和分发基础数据；联动功能是"原始信息的跨模式传递工具"，两者均不涉及"信息组合逻辑"（该逻辑由题库专属负责），合并后不会混淆与题库的职责分工。

### 9.2 实施方案
状态结构调整：
将原linkageSync合并至environmentConfigs，作为全局状态由Pinia的useEnvironmentStore统一管理，新增版本关联字段：

```javascript
// stores/environment.js
export const useEnvironmentStore = defineStore('environment', {
  state: () => ({
    // 按版本ID存储环境配置
    versionedConfigs: {},
    // 版本元信息
    versions: [],
    currentVersion: null,
    uiPresets: [],
    scoringRules: [],
    contextTemplates: [],
    // 原联动区功能整合（关联版本）
    linkage: {
      syncHistory: [],       // 同步历史记录（含版本信息）
      fieldAuthorizations: {}, // 字段授权配置（按版本存储）
      pendingSyncs: []       // 待同步任务（含版本信息）
    }
  }),
  actions: {
    // 按版本同步到目标模式
    syncToModeByVersion(targetMode, versionId, data) {
      // 同步逻辑实现（基于指定版本）
    },
    // 按版本设置字段授权
    setFieldAuthorizationByVersion(versionId, fieldId, isAuthorized) {
      // 授权逻辑实现（基于指定版本）
    }
  }
})
```

功能迁移：
- 将原联动区的同步逻辑（syncToMode）、授权管理（setFieldAuthorization）迁移至useEnvironmentStore的Actions中，新增版本参数
- 同步/授权相关的局部交互逻辑（如同步进度提示、失败重试UI）抽离至composables/useLinkageHandler.js，支持按版本操作
- 保留所有核心逻辑（同步过滤、授权校验、历史记录），仅调整数据引用路径以支持版本化

模块交互优化：
- 主模式→环境全量区：直接调用useEnvironmentStore().syncToModeByVersion(targetMode, versionId, data)发起指定版本的同步
- 环境全量区→其他模式：同步完成后通过composables/useEnvNotifier().notifyConfigChanged(versionId)发布带版本号的事件，其他模式通过useEnvListener().onConfigChanged(versionId, callback)监听
- 其他模式→环境全量区：通过useEnvironmentStore().getFieldAuthorizationByVersion(versionId, fieldId)查询指定版本的授权状态

## 10. Composition API使用规范

### 10.1 与UniversalCard组件配合使用
1. **组件控制封装（含版本）**：
   - 每个使用`UniversalCard`的场景都应有对应的组合式函数（如`useFormCard`、`useReportCard`）
   - 组合式函数应封装所有与组件的交互细节及版本关联逻辑，对外提供简洁接口

2. **状态同步模式（按版本）**：
   ```javascript
   // 按版本同步模式示例
   function useSyncedCardByVersion(cardId) {
     // 1. 获取全局状态和当前版本
     const cardStore = useCardStore();
     const versionManager = useVersionManager();
     const cardData = computed(() => 
       cardStore.getCardByVersion(cardId, versionManager.currentVersion.value)
     );
     
     // 2. 定义组件所需的props
     const cardProps = computed(() => ({
       modelValue: cardData.value?.title ?? '',
       options: cardData.value?.options ?? [],
       // 其他props...
     }));
     
     // 3. 定义事件处理函数（关联当前版本）
     const handleTitleChange = (newTitle) => {
       if (versionManager.currentVersion.value) {
         cardStore.updateCardFieldByVersion(
           cardId, 
           versionManager.currentVersion.value, 
           'title', 
           newTitle
         );
       }
     };
     
     // 4. 提供操作方法
     const methods = {
       enterEditMode() {
         if (versionManager.currentVersion.value) {
           cardStore.setCardModeByVersion(
             cardId, 
             versionManager.currentVersion.value, 
             'edit'
           );
         }
       },
       saveCard() {
         if (versionManager.currentVersion.value) {
           return cardStore.saveCardByVersion(
             cardId, 
             versionManager.currentVersion.value
           );
         }
         return Promise.reject('未选择版本');
       }
     };
     
     return {
       cardProps,
       handleTitleChange,
       ...methods
     };
   }
   ```

### 10.2 响应式数据使用规范
1. **基础使用原则**：
   - 基本类型（字符串、数字、布尔值）使用`ref`
   - 对象和数组优先使用`ref`（便于类型推断）
   - 复杂状态对象拆分多个`ref`而非单个`reactive`
   - 解构响应式对象时使用`toRefs`保持响应性

2. **示例**：
   ```javascript
   // 推荐方式（含版本信息）
   const currentVersion = ref('');
   const versionList = ref([]);
   const userName = ref('');
   const userAge = ref(0);
   const userHobbies = ref([]);
   ```

### 10.3 组合式函数设计原则
1. **单一职责**：一个组合式函数只负责一个功能领域
2. **命名规范**：必须以`use`为前缀，如`useCardEditor`、`useVersionManager`
3. **参数明确**：输入输出参数清晰，涉及版本操作需显式传递versionId
4. **返回值一致**：返回对象中，状态使用ref/computed，方法使用普通函数
5. **可组合性**：设计时考虑与其他组合式函数的配合使用（如`useCardEditor`可调用`useVersionManager`）

### 10.4 生命周期管理
1. **组件生命周期**：在组合式函数中可以使用Vue的生命周期钩子
2. **资源清理**：使用`onBeforeUnmount`清理事件监听、定时器等资源
3. **示例**：
   ```javascript
   function useWindowSize() {
     const width = ref(window.innerWidth);
     const height = ref(window.innerHeight);
     
     function updateSize() {
       width.value = window.innerWidth;
       height.value = window.innerHeight;
     }
     
     window.addEventListener('resize', updateSize);
     
     onBeforeUnmount(() => {
       window.removeEventListener('resize', updateSize);
     });
     
     return { width, height };
   }
   ```

### 10.5 与Pinia配合使用
1. **Store访问**：在组合式函数中直接导入并使用Store
2. **状态转换**：组合式函数负责将Store中的原始数据（含版本信息）转换为UI友好的格式
3. **避免冗余**：不重复存储Store中已有的状态
4. **示例（含版本）**：
   ```javascript
   function useFormattedCardByVersion(cardId) {
     const cardStore = useCardStore();
     const versionManager = useVersionManager();
     
     // 按当前版本获取卡片数据
     const card = computed(() => 
       cardStore.getCardByVersion(cardId, versionManager.currentVersion.value)
     );
     
     // 转换为UI友好的格式
     const formattedOptions = computed(() => {
       return (card.value?.options || []).map(option => ({
         ...option,
         // 将null转换为空白
         value: option.value ?? '',
         unit: option.unit ?? ''
       }));
     });
     
     return {
       formattedOptions,
       updateOption: (id, data) => {
         if (versionManager.currentVersion.value) {
           cardStore.updateOptionByVersion(
             cardId, 
             versionManager.currentVersion.value, 
             id, 
             data
           );
         }
       }
     };
   }
   ```

## 11. 附录

### 11.1 术语表
| 术语 | 定义 |
|------|------|
| 组合ID | 卡片标识+选项标识的组合（如"A1"），用于唯一定位选项 |
| 正向解析 | 数据模块将UI原始数据（可能不规范）转换为标准化格式（如去空格、补null、关联版本）的过程 |
| 反向解析 | 状态管理层（Composables/Pinia）将数据模块的标准化数据转换为UI友好格式（含null→空白、版本信息展示）的过程 |
| 同步状态（hasSync） | 控制字段是否在其他模式展示数据的标记（true=展示同步内容，false=无内容），与版本号关联，作为全局状态由Pinia管理 |
| 授权状态（isAuthorized） | 控制字段是否允许其他模式编辑的标记（true=可编辑，false=只读），与版本号关联，作为全局状态由Pinia管理 |
| 临时数据 | 用户编辑中未确认保存的数据，包含临时版本信息，作为局部状态由Composables管理，需手动操作才持久化 |
| 组合式函数（Composables） | 封装组件内业务逻辑和局部状态的函数（存放于composables目录），命名以`use`为前缀（如`useCardEditor`、`useVersionManager`），用于实现逻辑复用和代码组织，是本系统推荐的核心编码方式 |
| Pinia Store | 管理全局共享状态的容器（stores/*.js），遵循State→Getters→Actions单向数据流，存储跨组件复用的状态及多版本配置 |
| 环境全量区 | 系统原始信息的全集仓库，**按手动创建的版本号独立存储**所有基础元素（卡片、选项、参数等），其状态由useEnvironmentStore管理，不包含组合逻辑，仅负责信息的版本化存储与分发。 |
| 题库 | 组合规则的集合，**与特定版本的环境全量区强关联**，定义如何将对应版本的原始信息按特定逻辑组合，其状态由useLibraryStore管理。 |
| 组合表达式 | 题库中定义的元素关联规则（如A1+B2+C3→屠龙刀），包含关联的版本号，其中元素ID（A1等）指向对应版本环境全量区的具体选项。 |
| 版本号 | 由用户手动输入的自定义标识（如"V1.0"、"20231001"），用于唯一区分环境全量区的不同配置快照和题库的不同规则集合，需保证唯一性。 |
| 原子化元素 | 环境全量区中不可再拆分的基础单元（如单个选项A1及其参数），是所有组合的最小构成单位，其参数标准随版本变化。 |
| 第一道验证 | 反馈区对用户提交的元素组合结构进行校验，依据**同一版本**题库的组合表达式判断元素集合是否匹配（当前自动排序后验证，不严格限制顺序）。 |
| 第二道验证 | 反馈区对用户填写的具体参数进行校验，依据**同一版本**环境全量区的参数标准判断是否符合基础要求（如数值范围、选项合法性）。 |
| 经书合璧 | 题库（上半部）与环境全量区（下半部）在反馈区通过**同一版本**的两道验证实现配合，共同产出完整结果的过程。 |
| UniversalCard | 系统核心受控组件，作为高复用整体组件，不可拆分调用，所有系统功能围绕其展开并通过外部命令对其进行控制。 |

### 11.2 组合顺序处理规则

| 场景 | 当前处理逻辑 | 未来扩展方向 |
|------|------------|------------|
| 顺序差异 | 自动按"字母+数字"排序后验证（如B2+A1→A1+B2），视为有效组合 | 可配置为"严格顺序验证"（如B2+A1≠A1+B2，视为无效组合） |
| 排序优先级 | 1. 卡片标识字母（A→Z→AA→AB...）<br>2. 选项标识数字（1→2→...→9→10） | 支持自定义排序规则（如按卡片创建时间、用户自定义优先级） |

### 11.3 离线运行注意事项
1. 所有静态资源必须本地化，避免使用外部链接
2. 依赖包需在开发阶段安装并打包到项目中
3. 数据存储使用浏览器本地存储方案（localStorage/IndexedDB），支持版本化数据存储
4. 避免使用需要网络的API（如在线地图、第三方服务）
5. 构建时需配置为完全离线可用模式