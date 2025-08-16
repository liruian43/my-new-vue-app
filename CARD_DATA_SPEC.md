# 项目规范文档（基于Composition API优化版）

## 目录
1. 前言
2. Excel样式ID规范
3. 卡片数据结构与状态管理规范
4. 多模式数据处理与流转规范
5. 系统核心架构与分层职责
6. 五大模块数据流程（主线）
7. 环境全量区与联动功能合并说明
8. 附录

## 1. 前言
本文档整合项目全量规范，涵盖标识规则、数据结构、流转逻辑、架构设计及模块职责。核心目标是确保系统各环节遵循统一标准：数据完整性优先、分层职责清晰、同步授权逻辑明确，为开发提供唯一权威参考。本次更新明确了题库与环境全量区的"经书上下半部"关系，组合表达式的宽松排序验证规则，以及其他模式数据提交的"所见即所提"原则。

特别针对Vue 3 Composition API进行了优化，强化了组合式函数的设计规范和状态管理拆分原则，以解决代码膨胀问题，提升代码可维护性和复用性。

## 2. Excel样式ID规范
### 2.1 基础格式定义
采用“卡片标识+选项标识”的组合格式，用于唯一定位卡片及下属选项：

- 卡片标识：纯大写英文字母序列（A-Z→AA-AZ→BA-BZ...），示例："A"、"BC"、"XYZ"
- 选项标识：纯阿拉伯数字（1,2,3...），示例："1"、"5"、"12"
- 完整ID：卡片标识+选项标识，示例："A1"（A卡片第1个选项）、"BC3"（BC卡片第3个选项）

### 2.2 生成规则
#### 2.2.1 卡片标识生成
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

#### 2.2.2 选项标识生成
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

### 2.3 解析规则
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

## 3. 卡片数据结构与状态管理规范
### 3.1 核心数据结构（五项内容规范）
卡片及选项的基础结构必须包含以下字段，无论是否有值/是否同步，字段均需存在：

| 字段标识 | 含义 | 数据类型 | 空值标准（数据层） | 说明 |
|---------|------|---------|-------------------|------|
| title | 卡片标题 | string \| null | null | 卡片的整体名称 |
| optionName | 选项名称 | string \| null | null | 单个选项的名称 |
| optionValue | 选项值 | string \| number \| null | null | 选项的具体数值或文本 |
| optionUnit | 选项单位 | string \| null | null | 选项值的单位（如"kg"、"个"） |
| selectOptions | 下拉菜单选项 | string[] | []（空数组） | 预定义的可选值列表 |

### 3.2 状态划分与管理原则
#### 3.2.1 状态分类及存储位置
**局部状态（组件/页面内部）**：
- 范围：如表单临时值、UI交互状态（展开/折叠、选中状态）、组件内计算中间值
- 存储方式：必须通过组合式函数（composables）管理，每个功能独立封装
- 示例：`useFormEditor()` 管理表单状态，`useTablePagination()` 管理表格分页
- 禁止：在组件的setup中直接编写超过10行的状态逻辑，必须抽离到组合式函数

**全局共享状态（跨组件/页面）**：
- 范围：如用户信息、全局配置、多模块共享的同步状态（syncStatus）、环境全量区基础配置
- 存储方式：通过Pinia Store管理，遵循"功能域划分"原则
- 拆分标准：按业务域垂直拆分（如`useCardStore`、`useSyncStore`），而非按数据类型水平拆分
- 禁止：创建包含多个不相关功能的"万能Store"

#### 3.2.2 组合式函数（Composables）设计规范

1. **命名规范**：
   - 必须以`use`为前缀，后跟描述性名称（如`useCardEditor`、`useSyncHandler`）
   - 文件名与函数名保持一致（`useCardEditor.js`导出`useCardEditor`）

2. **结构规范**：
   ```javascript
   // 标准结构示例
   export function useCardEditor(initialData) {
     // 1. 声明响应式状态
     const cardData = ref(initialData)
     const isEditing = ref(false)
     
     // 2. 声明计算属性
     const hasChanges = computed(() => {
       return JSON.stringify(cardData.value) !== JSON.stringify(initialData)
     })
     
     // 3. 声明内部方法
     function validate() {
       // 验证逻辑
     }
     
     // 4. 声明暴露的方法
     function startEditing() {
       isEditing.value = true
     }
     
     function saveChanges() {
       if (validate()) {
         isEditing.value = false
         return true
       }
       return false
     }
     
     // 5. 生命周期钩子（如需要）
     onMounted(() => {
       // 初始化逻辑
     })
     
     // 6. 返回需要暴露的状态和方法
     return {
       cardData,
       isEditing,
       hasChanges,
       startEditing,
       saveChanges
     }
   }
   ```

3. **组合规则**：
   - 组合式函数可相互调用（如`useCardEditor`可调用`useValidation`）
   - 避免循环依赖
   - 传递响应式数据时，优先使用`toRef`或`toRefs`保持响应性

   ```javascript
   // 组合示例
   export function useAdvancedCardEditor(initialData) {
     // 组合基础功能
     const { cardData, startEditing, saveChanges } = useCardEditor(initialData)
     // 组合额外功能
     const { validate, errors } = useAdvancedValidation(cardData)
     
     // 扩展方法
     function saveWithValidation() {
       if (validate()) {
         return saveChanges()
       }
       return false
     }
     
     return {
       cardData,
       startEditing,
       saveWithValidation,
       errors
     }
   }
   ```

4. **职责边界**：
   - 一个组合式函数专注于单一功能领域
   - 不直接操作DOM（DOM操作应在组件中处理）
   - 不直接修改Pinia状态（通过返回事件或调用Store的action）

#### 3.2.3 Pinia Store设计规范

1. **Store拆分原则**：
   - 按业务功能拆分（如`cardStore`、`syncStore`、`environmentStore`）
   - 每个Store不超过500行代码，过大时需进一步拆分
   - 跨Store通信通过`storeToRefs`和action调用实现，不直接访问其他Store的state

2. **State设计**：
   - 仅存储原始数据（字符串、数字、布尔值、数组、普通对象）
   - 复杂对象应设计为结构化数据，便于响应式追踪
   - 避免深层嵌套（建议不超过3层）

3. **Action设计**：
   - 异步操作必须放在action中，且返回Promise
   - action应专注于状态更新，复杂业务逻辑应抽离到独立的业务逻辑模块
   - action命名使用动词开头（如`fetchCardData`、`updateSyncStatus`）

   ```javascript
   // Store示例（优化后）
   export const useCardStore = defineStore('card', {
     state: () => ({
       items: {},
       currentId: null,
       loading: false,
       error: null
     }),
     
     getters: {
       currentCard: (state) => state.items[state.currentId],
       sortedCards: (state) => {
         return Object.values(state.items).sort((a, b) => a.order - b.order)
       }
     },
     
     actions: {
       async fetchCard(id) {
         this.loading = true
         this.error = null
         try {
           const data = await cardApi.getById(id)
           this.items[id] = data
           this.currentId = id
           return data
         } catch (err) {
           this.error = err.message
           throw err
         } finally {
           this.loading = false
         }
       },
       
       updateCardField(id, field, value) {
         if (!this.items[id]) return
         // 调用独立的业务逻辑模块处理
         const normalizedValue = cardNormalizer.normalizeField(field, value)
         this.items[id][field] = normalizedValue
       }
     }
   })
   ```

#### 3.2.4 同步与授权状态（syncStatus）
同步控制“是否有数据可展示”，授权控制“是否允许编辑”，两者独立且需显式配置，作为全局状态由Pinia的useSyncStore管理：

```typescript
interface SyncStatus {
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

#### 3.2.5 其他模式表现（核心逻辑）

| 场景 | 同步状态（hasSync） | 授权状态（isAuthorized） | 其他模式UI表现 |
|------|-------------------|-------------------------|--------------|
| 1 | false（未同步） | false（未授权） | 显示空白，控件禁用（不可编辑） |
| 2 | false（未同步） | true（已授权） | 显示空白，控件可交互（允许输入） |
| 3 | true（已同步） | false（未授权） | 显示同步的内容，控件禁用（灰色） |
| 4 | true（已同步） | true（已授权） | 显示同步的内容（作为提示），控件可交互（允许修改） |

### 3.3 空值处理（分层职责）
空值处理严格遵循分层原则，禁止UI层参与数据转换：

| 层级 | 处理逻辑 | 示例 |
|------|---------|------|
| 数据层 | 所有空值必须显式存储为null（禁止使用空字符串""、undefined或缺失字段） | 未填写的标题存储为title: null |
| 状态管理层 | 包含两种处理方式：<br>1. 组件/Composables：将null转换为UI层可直接使用的空白（""）<br>2. Pinia：仅存储原始null，通过getters提供转换后的值供UI使用 | 转换函数：storageToDisplay = (v) => v === null ? "" : String(v) |
| UI层 | 直接使用状态管理层传递的已转换数据（空白），不处理任何值转换逻辑 | 输入框绑定displayValue（空白则显示空输入框） |

## 4. 多模式数据处理与流转规范
### 4.1 核心流转规则（跨模块通用）
- 同步触发：仅支持主模式手动点击同步按钮（无自动同步）
- 数据过滤：按syncStatus.hasSync筛选字段（未同步字段在目标模式中为null）
- 失败处理：同步失败仅支持手动重试（无自动重试）
- 空值传递：流转过程中保持null不变，由状态管理层在各模块内转换为空白（引用3.3节）

### 4.2 临时数据与持久化规则
**临时数据（_tempData）**：
- 定义：用户正在编辑但未确认保存的数据（如未点击“保存”按钮的草稿）
- 存储：作为局部状态，通过composables/useTempData.js管理（包含ref状态和操作方法）
- 转换：需手动点击“添加到题库”按钮（调用useTempData().persistToLibrary()）才转为持久化数据

**持久化数据（_persistedData）**：
- 存储位置：题库及环境全量区，作为全局状态由Pinia的useLibraryStore和useEnvironmentStore管理
- 存储范围：手动添加时，自动存储全量信息（包括未勾选同步的字段、未编辑的空值字段）
- 关联存储：添加到题库时，自动调用useEnvironmentStore().syncRelatedConfig()同步更新环境全量区的关联配置

## 5. 系统核心架构与分层职责
### 5.1 分层架构

| 层级 | 技术实现 | 核心职责 | 禁止行为 |
|------|---------|---------|---------|
| UI层 | Vue组件（.vue） | 1. 模板渲染与UI展示<br>2. 接收用户输入并调用组合式函数<br>3. 处理DOM相关操作 | 1. 禁止包含业务逻辑（全部通过组合式函数处理）<br>2. 不直接访问Pinia的state（通过组合式函数间接访问） |
| 组合层 | Composables（composables/*.js） | 1. 封装组件所需的业务逻辑<br>2. 组合多个相关功能<br>3. 处理组件内的响应式状态<br>4. 协调UI层与数据层的交互 | 1. 禁止直接修改全局状态（通过调用Store的action）<br>2. 不处理DOM操作<br>3. 不存储需要跨组件共享的状态 |
| 数据层 | 1. Pinia Stores（stores/*.js）<br>2. API模块（api/*.js）<br>3. 数据处理模块（utils/normalizers/*.js） | 1. 管理全局共享状态<br>2. 处理数据持久化<br>3. 封装API请求<br>4. 数据验证与标准化 | 1. 不包含UI相关逻辑<br>2. 不直接处理用户交互<br>3. API模块不存储状态 |

### 5.2 数据流转模式

采用"单向数据流"模式，各层之间通过明确的接口通信：

1. **用户交互流程**：
   ```
   UI组件 → 组合式函数（处理逻辑） → Pinia Action（更新状态）
                                    ↓
   UI组件 ← 组合式函数（响应状态变化） ← Pinia State（状态变更）
   ```

2. **数据加载流程**：
   ```
   组合式函数 → Pinia Action → API模块 → 后端服务
                                          ↓
   组合式函数 ← Pinia State ← API模块 ← 后端服务
   ```

3. **跨组件通信流程**：
   ```
   组件A → 组合式函数A → Pinia Action → Pinia State
                                          ↓
   组件B ← 组合式函数B ← Pinia Getter ← Pinia State
   ```

### 5.3 单模块内部数据处理（技术细节）
以“用户在其他模式编辑选项值”为例，描述单个模块内的分层交互：

1. 用户输入：UI层（组件）接收原始输入（如" 5 "，带空格）→ 调用Composables的useOptionEditor().updateValue(rawData)
2. 局部逻辑处理：useOptionEditor（Composables）执行基础校验（如格式初步判断）→ 转发至数据模块updateTempData(rawData)
3. 正向解析：数据模块标准化处理（去空格→"5"，若为空则存null）→ 更新临时数据
4. 反向解析：useOptionEditor将标准化数据转换为UI格式（"5"或空白）→ 响应式更新
5. 全局状态同步（如需）：若该选项值需跨模块共享→ 调用Pinia的useOptionStore().setOptionValue(standardizedData)
6. UI展示：UI层从useOptionEditor获取已转换数据，更新输入框显示

## 6. 五大模块数据流程（主线）
按数据从源头到结尾的顺序描述，明确模块间的衔接关系：

### 6.1 主模式（root_admin）→ 数据源头
功能：
- 按ExcelID规则创建卡片/选项（引用2.2节），通过composables/useCardCreator.js管理创建过程的局部状态
- 配置卡片数据（title/optionValue等，引用3.1节），通过useCardConfig()处理配置逻辑
- 设定syncStatus（同步/授权规则，引用3.2节），通过Pinia的useSyncStore().setSyncStatus(config)持久化全局同步配置

手动触发两个关键操作：
- 点击“保存到题库”→ 调用useTempData().persistToLibrary()将组合规则持久化，同步调用useEnvironmentStore().saveBaseParams()存储原始参数到环境全量区
- 点击“同步到其他模式”→ 调用useSyncStore().syncToMode(targetMode)向环境全量区发起同步指令，传递参数标准

创建卡片/选项的组合式函数示例：
```javascript
function useCardCreator() {
  const { items, addCard } = useCardStore()
  const tempCard = ref({/* 临时数据 */})
  const { validateCard } = useCardValidation()
  
  function createCard() {
    if (validateCard(tempCard.value)) {
      const newCard = {
        id: generateNextCardId(Object.keys(items)),
        ...tempCard.value,
        createdAt: new Date()
      }
      addCard(newCard)
      return newCard.id
    }
    return null
  }
  
  return {
    tempCard,
    createCard,
    isValid: computed(() => validateCard(tempCard.value))
  }
}
```

### 6.2 题库 → 规则典籍（上半部经书）
核心定位：独立存储“组合表达式”及“逻辑规则”，不存储具体参数，也不直接查询环境全量区（如同“只记载‘A1+B2+C3→屠龙刀’的公式，不记载A1/B2/C3具体是什么”）。

功能：
- 存储完整组合表达式（如A1+B2+C3→屠龙刀），仅包含元素ID的关联逻辑，不包含任何参数值，由Pinia的useLibraryStore管理。
- 定义表达式的“语法规则”（如：A1必须与B2同时存在，C3需在A1之后生效等），规则校验逻辑抽离至composables/useExpressionValidator.js。
- 组合表达式的“标准顺序”遵循先按卡片标识字母排序，再按选项标识数字排序（如A1→A9→B1→B2→C3，即字母优先级高于数字，同字母内按数字升序）。
- 表达式存储时自动按标准顺序格式化（如用户输入B2+A1，题库会自动存储为A1+B2），格式化逻辑通过composables/useExpressionFormatter.js实现。
- 向反馈区提供“验证标准1”：通过useLibraryStore().validateExpression(elements)判断用户提交的元素组合是否符合表达式的元素集合要求（当前不严格验证顺序）。

### 6.3 环境全量区 → 参数典籍（下半部经书）
核心定位：独立存储所有元素的“具体参数标准”，不包含组合逻辑，也不直接查询题库（如同“只记载A1=玄铁150kg、B2=淬火工艺、C3=500℃，但不知道这些能组合成屠龙刀”）。

功能：
- 存储所有元素的参数标准（如A1的optionValue标准范围为100-200kg，B2的selectOptions必须包含“淬火”），作为全局状态由useEnvironmentStore管理。
- 向反馈区提供“验证标准2”：通过useEnvironmentStore().validateParam(elementId, value)判断用户提交的元素参数是否符合基础标准。
- 保留原联动同步功能（数据分发、授权管理等），同步逻辑封装在useEnvironmentStore的Actions中（如syncToMode、setFieldAuthorization）。

### 6.4 其他模式交互层 → 用户操作终端
功能：
- 通过useEnvironmentStore().getSyncedData(modeId)接收环境全量区推送的同步数据（参数标准）
- 状态管理层处理展示转换：composables/useDisplayFormatter().format(data)将null转换为空白（引用3.3节），UI层按3.2.4节规则展示

数据展示与编辑的组合式函数示例：
```javascript
function useOptionEditor(cardId, optionId) {
  const { getOption, updateOption } = useOptionStore()
  const { getSyncStatus } = useSyncStore()
  
  // 获取基础数据
  const option = computed(() => getOption(cardId, optionId))
  const syncStatus = computed(() => getSyncStatus(cardId, optionId))
  
  // 处理显示值（null → 空白）
  const displayValue = computed({
    get: () => option.value?.optionValue ?? '',
    set: (value) => {
      if (syncStatus.value.options.value.isAuthorized) {
        // 标准化处理
        const normalized = normalizeValue(value)
        updateOption(cardId, optionId, { optionValue: normalized })
      }
    }
  })
  
  return {
    displayValue,
    isEditable: computed(() => syncStatus.value.options.value.isAuthorized),
    isSynced: computed(() => syncStatus.value.options.value.hasSync)
  }
}
```

数据提交原则：
- 提交时以界面最终显示值为依据（无论该值是同步而来还是用户编辑输入）
- 若为“已同步+未授权”状态（同步内容不可编辑），自动提交界面上显示的同步内容（如同步内容为“500克”，则提交“500克”）
- 若为“已同步+已授权”或“未同步+已授权”状态，提交用户最终输入/修改的内容
- 若界面显示为空白（包括同步内容为null转换的空白、用户未填写的空白），提交时通过useDataNormalizer().toStorageFormat(value)自动转换为null（遵循3.3节空值标准）
- 收集用户操作后，通过composables/useSubmitHandler().submit(data)处理后提交至匹配引擎反馈层

### 6.5 匹配引擎反馈层 → 经书合璧验证区
核心定位：唯一能同时调用题库（上半部）和环境全量区（下半部）的模块，通过两道验证实现“经书合璧”，输出最终结果。

功能：
1. 接收输入：通过useFeedbackReceiver().getUserInput()获取其他模式用户填写的完整数据。
2. 第一道验证（题库规则验证）：
   - 调用useLibraryStore().getExpression(targetResult)获取组合表达式（如A1+B2+C3→屠龙刀）
   - 接收用户提交的元素组合（可能无序，如B2+A1+C3），通过useExpressionFormatter().sort(elements)自动按“字母+数字”规则排序→ 转换为A1+B2+C3
   - 验证转换后的元素集合是否与题库表达式完全一致（当前不校验顺序，仅校验元素是否完整匹配）
   - 若验证失败（如缺少B2），通过useFeedbackRenderer().showError("组合错误，需包含A1+B2+C3")返回提示

3. 第二道验证（全量区参数验证）：
   - 调用useEnvironmentStore().getParamStandard(elementId)获取参数标准
   - 验证用户填写的具体参数是否符合标准（如A1=180kg在范围内），验证逻辑通过composables/useParamValidator.js实现
   - 若验证失败（如A1=250kg超出范围），返回“参数错误，A1需在100-200kg之间”

4. 输出结果：两道验证均通过后，通过useFeedbackRenderer().showSuccess("匹配成功→屠龙刀", fullParams)输出结果，展示完整参数。

## 7. 环境全量区与联动功能合并说明
### 7.1 合并可行性分析
数据关联性：
- 环境全量区存储基础配置数据（卡片、选项、参数标准等），联动功能本质是这些数据的跨模式交互工具，两者属于“数据本体”与“交互能力”的强关联关系，合并后逻辑更紧密。

代码结构兼容性：
- 原实现中，环境配置变更会触发联动区的notifyEnvConfigChanged方法，说明两者已存在依赖关系；且联动功能（syncToMode、setFieldAuthorization等）核心是操作环境配置数据，合并后可减少跨模块调用。

功能合理性：
- 联动同步作为环境全量区的内置功能，符合“数据管理+交互能力”的一体化设计模式，可简化数据流转链路（减少中间环节），降低维护成本。

职责边界清晰：
- 环境全量区作为“原始信息仓库”，其核心是存储和分发基础数据；联动功能是“原始信息的跨模式传递工具”，两者均不涉及“信息组合逻辑”（该逻辑由题库专属负责），合并后不会混淆与题库的职责分工。

### 7.2 实施方案
状态结构调整：
将原linkageSync合并至environmentConfigs，作为全局状态由Pinia的useEnvironmentStore统一管理：

```javascript
// stores/environment.js
export const useEnvironmentStore = defineStore('environment', {
  state: () => ({
    cards: {},
    options: {},
    uiPresets: [],
    scoringRules: [],
    contextTemplates: [],
    // 原联动区功能整合
    linkage: {
      syncHistory: [],       // 同步历史记录
      fieldAuthorizations: {}, // 字段授权配置
      pendingSyncs: []       // 待同步任务
    }
  }),
  actions: {
    // 同步到目标模式
    syncToMode(targetMode, data) {
      // 同步逻辑实现
    },
    // 设置字段授权
    setFieldAuthorization(fieldId, isAuthorized) {
      // 授权逻辑实现
    }
  }
})
```

功能迁移：
- 将原联动区的同步逻辑（syncToMode）、授权管理（setFieldAuthorization）迁移至useEnvironmentStore的Actions中
- 同步/授权相关的局部交互逻辑（如同步进度提示、失败重试UI）抽离至composables/useLinkageHandler.js
- 保留所有核心逻辑（同步过滤、授权校验、历史记录），仅调整数据引用路径

模块交互优化：
- 主模式→环境全量区：直接调用useEnvironmentStore().syncToMode(targetMode, data)发起同步
- 环境全量区→其他模式：同步完成后通过composables/useEnvNotifier().notifyConfigChanged()发布事件，其他模式通过useEnvListener().onConfigChanged(callback)监听
- 其他模式→环境全量区：通过useEnvironmentStore().getFieldAuthorization(fieldId)查询授权状态

## 8. 附录
### 8.1 术语表
| 术语 | 定义 |
|------|------|
| 组合ID | 卡片标识+选项标识的组合（如"A1"），用于唯一定位选项 |
| 正向解析 | 数据模块将UI原始数据（可能不规范）转换为标准化格式（如去空格、补null）的过程 |
| 反向解析 | 状态管理层（Composables/Pinia）将数据模块的标准化数据转换为UI友好格式（含null→空白）的过程 |
| 同步状态（hasSync） | 控制字段是否在其他模式展示数据的标记（true=展示同步内容，false=无内容），作为全局状态由Pinia管理 |
| 授权状态（isAuthorized） | 控制字段是否允许其他模式编辑的标记（true=可编辑，false=只读），作为全局状态由Pinia管理 |
| 临时数据 | 用户编辑中未确认保存的数据，作为局部状态由Composables管理，需手动操作才持久化 |
| Composables | 封装组件内业务逻辑和局部状态的函数（composables/*.js），遵循“单一职责”原则，可被组件直接调用 |
| Pinia Store | 管理全局共享状态的容器（stores/*.js），遵循State→Getters→Actions单向数据流，仅存储跨组件复用的状态 |
| 环境全量区 | 系统原始信息的全集仓库，存储所有基础元素（卡片、选项、参数等），其状态由useEnvironmentStore管理，不包含组合逻辑，仅负责信息的存储与分发。 |
| 题库 | 组合规则的集合，定义如何将环境全量区的原始信息按特定逻辑组合，其状态由useLibraryStore管理。 |
| 组合表达式 | 题库中定义的元素关联规则（如A1+B2+C3→屠龙刀），其中元素ID（A1等）指向环境全量区的具体选项。 |
| 原子化元素 | 环境全量区中不可再拆分的基础单元（如单个选项A1及其参数），是所有组合的最小构成单位。 |
| 第一道验证 | 反馈区对用户提交的元素组合结构进行校验，依据题库的组合表达式判断元素集合是否匹配（当前自动排序后验证，不严格限制顺序）。 |
| 第二道验证 | 反馈区对用户填写的具体参数进行校验，依据环境全量区的参数标准判断是否符合基础要求（如数值范围、选项合法性）。 |
| 经书合璧 | 题库（上半部）与环境全量区（下半部）在反馈区通过两道验证实现配合，共同产出完整结果的过程。 |

### 8.2 组合顺序处理规则

| 场景 | 当前处理逻辑 | 未来扩展方向 |
|------|------------|------------|
| 顺序差异 | 自动按“字母+数字”排序后验证（如B2+A1→A1+B2），视为有效组合 | 可配置为“严格顺序验证”（如B2+A1≠A1+B2，视为无效组合） |
| 排序优先级 | 1. 卡片标识字母（A→Z→AA→AB...）<br>2. 选项标识数字（1→2→...→9→10） | 支持自定义排序规则（如按卡片创建时间、用户自定义优先级） |

### 8.3 Composition API最佳实践

1. **响应式数据使用规范**：
   - 基本类型（字符串、数字、布尔值）使用`ref`
   - 对象和数组优先使用`ref`（便于类型推断）
   - 复杂状态对象拆分多个`ref`而非单个`reactive`
   - 解构响应式对象时使用`toRefs`保持响应性

2. **代码组织建议**：
   - 组件的`setup`函数应简洁，主要负责组合功能和返回值
   - 超过3个组合式函数的组件应按功能分组
   - 相关的组合式函数放在同一目录下（如`composables/card/`下存放卡片相关的所有组合式函数）

3. **性能优化原则**：
   - 避免在计算属性和watch中执行 heavy 操作
   - 对大型列表使用`v-memo`优化渲染
   - 组合式函数中使用`shallowRef`和`shallowReactive`处理大型不可变数据
   - 合理使用`watchEffect`的清理功能避免内存泄漏

4. **类型安全**：
   - 为组合式函数的参数和返回值定义TypeScript接口
   - 为Pinia的State和Actions定义类型
   - 使用`as const`提升常量的类型精度

-----------------------------------------------------------------------------------------------------------------------------------------------------------

# 项目规范文档（完整最终版）

## 目录
1. 前言
2. Excel样式ID规范
3. 卡片数据结构与状态管理规范
4. 多模式数据处理与流转规范
5. 系统核心架构与分层职责
6. 五大模块数据流程（主线）
7. 环境全量区与联动功能合并说明
8. 附录


## 1. 前言
本文档整合项目全量规范，涵盖标识规则、数据结构、流转逻辑、架构设计及模块职责。核心目标是确保系统各环节遵循统一标准：**数据完整性优先、分层职责清晰、同步授权逻辑明确**，为开发提供唯一权威参考。本次更新明确了题库与环境全量区的"经书上下半部"关系，组合表达式的宽松排序验证规则，以及其他模式数据提交的"所见即所提"原则。


## 2. Excel样式ID规范
### 2.1 基础格式定义
采用“卡片标识+选项标识”的组合格式，用于唯一定位卡片及下属选项：
- **卡片标识**：纯大写英文字母序列（A-Z→AA-AZ→BA-BZ...），示例："A"、"BC"、"XYZ"
- **选项标识**：纯阿拉伯数字（1,2,3...），示例："1"、"5"、"12"
- **完整ID**：卡片标识+选项标识，示例："A1"（A卡片第1个选项）、"BC3"（BC卡片第3个选项）

### 2.2 生成规则
#### 2.2.1 卡片标识生成
- 初始标识为"A"，按字母顺序递增，单字母用尽后自动扩展位数：
  - 单字母：A→B→...→Z（共26个）
  - 双字母：AA→AB→...→AZ→BA→...→BZ（共26×26个）
  - 以此类推（三字母、四字母等）
- 生成函数示例：
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

#### 2.2.2 选项标识生成
- 每个卡片的首个选项标识为"1"
- 新增选项时，标识为当前卡片已有选项中的**最大标识+1**（与删除无关）：
  - 示例1：现有选项["1","2","3"]→新增为"4"
  - 示例2：现有选项["1","3","5"]→新增为"6"（最大标识为5，5+1=6）
- 生成函数示例：
  ```javascript
  function generateNextOptionId(existingOptions) {
    const maxId = existingOptions.reduce((max, id) => {
      const num = parseInt(id, 10);
      return num > max ? num : max;
    }, 0);
    return (maxId + 1).toString();
  }
  ```

### 2.3 解析规则
- 解析目标：将完整ID拆分为卡片标识和选项标识
- 解析函数示例：
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
- 无效格式示例："a1"（小写字母）、"1A"（数字在前）、"A-1"（含特殊字符）


## 3. 卡片数据结构与状态管理规范
### 3.1 核心数据结构（五项内容规范）
卡片及选项的基础结构必须包含以下字段，**无论是否有值/是否同步，字段均需存在**：

| 字段标识         | 含义                  | 数据类型                  | 空值标准（数据层） | 说明 |
|------------------|-----------------------|---------------------------|--------------------|------|
| `title`          | 卡片标题              | string \| null            | `null`             | 卡片的整体名称 |
| `optionName`     | 选项名称              | string \| null            | `null`             | 单个选项的名称 |
| `optionValue`    | 选项值                | string \| number \| null  | `null`             | 选项的具体数值或文本 |
| `optionUnit`     | 选项单位              | string \| null            | `null`             | 选项值的单位（如"kg"、"个"） |
| `selectOptions`  | 下拉菜单选项          | string[]                  | `[]`（空数组）     | 预定义的可选值列表 |

### 3.2 状态划分与管理原则
#### 3.2.1 状态分类及存储位置
- **局部状态**（组件/页面内部独有的状态）：
  - 范围：如表单临时值、UI交互状态（展开/折叠、选中状态）、组件内计算中间值
  - 存储方式：使用`reactive`或`ref`在组件内声明，或抽离至`composables`目录的逻辑函数中
  - 示例：某页面的"批量编辑"开关状态、表格分页参数

- **全局共享状态**（跨组件/页面复用的状态）：
  - 范围：如用户信息、全局配置、多模块共享的同步状态（`syncStatus`）、环境全量区基础配置
  - 存储方式：仅允许通过Pinia Store管理，遵循"最小化存储"原则（不冗余存储局部可推导的状态）
  - 示例：各模式的授权配置、卡片基础结构的全局索引

#### 3.2.2 Pinia Store设计规范
- 严格遵循**State → Getters → Actions**单向数据流：
  - State：仅存储原始数据（如`syncStatus`的原始配置、环境全量区基础参数），不包含复杂计算逻辑
  - Getters：用于派生全局状态（如"当前模式下可编辑的卡片列表"）
  - Actions：仅处理与全局状态相关的操作（如跨模式同步、授权配置更新），禁止包含UI逻辑
  
- 每个Store需明确职责边界（如`useSyncStore`负责同步状态管理、`useEnvironmentStore`负责环境全量区数据），避免创建万能Store

#### 3.2.3 同步与授权状态（syncStatus）
同步控制“是否有数据可展示”，授权控制“是否允许编辑”，两者独立且需显式配置，**作为全局状态由Pinia的`useSyncStore`管理**：

```typescript
interface SyncStatus {
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

#### 3.2.4 其他模式表现（核心逻辑）
| 场景 | 同步状态（hasSync） | 授权状态（isAuthorized） | 其他模式UI表现 |
|------|---------------------|--------------------------|----------------|
| 1    | false（未同步）     | false（未授权）          | 显示空白，控件禁用（不可编辑） |
| 2    | false（未同步）     | true（已授权）           | 显示空白，控件可交互（允许输入） |
| 3    | true（已同步）      | false（未授权）          | 显示同步的内容，控件禁用（灰色） |
| 4    | true（已同步）      | true（已授权）           | 显示同步的内容（作为提示），控件可交互（允许修改） |

### 3.3 空值处理（分层职责）
空值处理严格遵循分层原则，**禁止UI层参与数据转换**：

| 层级         | 处理逻辑                                                                 | 示例                          |
|--------------|--------------------------------------------------------------------------|-------------------------------|
| **数据层**   | 所有空值必须显式存储为`null`（禁止使用空字符串`""`、`undefined`或缺失字段） | 未填写的标题存储为`title: null` |
| **状态管理层** | 包含两种处理方式：<br>1. 组件/Composables：将`null`转换为UI层可直接使用的空白（`""`）<br>2. Pinia：仅存储原始`null`，通过getters提供转换后的值供UI使用 | 转换函数：`storageToDisplay = (v) => v === null ? "" : String(v)` |
| **UI层**     | 直接使用状态管理层传递的已转换数据（空白），不处理任何值转换逻辑              | 输入框绑定`displayValue`（空白则显示空输入框） |


## 4. 多模式数据处理与流转规范
### 4.1 核心流转规则（跨模块通用）
- **同步触发**：仅支持主模式手动点击同步按钮（无自动同步）
- **数据过滤**：按`syncStatus.hasSync`筛选字段（未同步字段在目标模式中为`null`）
- **失败处理**：同步失败仅支持手动重试（无自动重试）
- **空值传递**：流转过程中保持`null`不变，由状态管理层在各模块内转换为空白（引用3.3节）

### 4.2 临时数据与持久化规则
- **临时数据（_tempData）**：  
  - 定义：用户正在编辑但未确认保存的数据（如未点击“保存”按钮的草稿）  
  - 存储：作为局部状态，通过`composables/useTempData.js`管理（包含`ref`状态和操作方法）  
  - 转换：需手动点击“添加到题库”按钮（调用`useTempData().persistToLibrary()`）才转为持久化数据  

- **持久化数据（_persistedData）**：  
  - 存储位置：题库及环境全量区，作为全局状态由Pinia的`useLibraryStore`和`useEnvironmentStore`管理  
  - 存储范围：手动添加时，**自动存储全量信息**（包括未勾选同步的字段、未编辑的空值字段）  
  - 关联存储：添加到题库时，自动调用`useEnvironmentStore().syncRelatedConfig()`同步更新环境全量区的关联配置  


## 5. 系统核心架构与分层职责
### 5.1 分层架构
| 层级         | 技术实现                  | 核心职责                                                                 | 禁止行为                                                                 |
|--------------|---------------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **UI层**     | Vue组件（.vue）           | 1. 渲染页面元素（按钮、输入框等）<br>2. 接收用户操作并调用Composables或Pinia Actions<br>3. 展示状态管理层提供的已转换数据（空白/同步内容） | 1. 禁止直接定义复杂业务逻辑（需抽离至Composables）<br>2. 不处理数据转换（如`null→空白`）<br>3. 不直接存储状态（通过`setup()`引用Composables或Pinia） |
| **状态管理层** | 1. Composables（`composables/*.js`）<br>2. Pinia Stores（`stores/*.js`） | 1. Composables：管理局部状态（`ref/reactive`），封装组件内业务逻辑（如表单验证、临时数据处理）<br>2. Pinia：管理全局共享状态，提供跨组件数据访问和修改接口（遵循State→Getters→Actions单向流）<br>3. 统一处理`null→空白`等数据转换 | 1. Composables禁止直接修改Pinia State（需通过Actions）<br>2. Pinia禁止存储局部状态（如仅某组件使用的UI状态）<br>3. 两者均不直接操作DOM |
| **数据模块** | JavaScript模块            | 1. 存储全量持久化数据（对接本地存储或后端接口）<br>2. 执行正向解析（UI原始数据→标准化格式）<br>3. 提供数据操作接口（仅对状态管理层开放） | 1. 不处理UI交互逻辑<br>2. 不参与反向解析（不关心UI展示格式）<br>3. 不直接暴露内部数据（返回副本） |

### 5.2 单模块内部数据处理（技术细节）
以“用户在其他模式编辑选项值”为例，描述单个模块内的分层交互：  
1. **用户输入**：UI层（组件）接收原始输入（如" 5 "，带空格）→ 调用Composables的`useOptionEditor().updateValue(rawData)`  
2. **局部逻辑处理**：`useOptionEditor`（Composables）执行基础校验（如格式初步判断）→ 转发至数据模块`updateTempData(rawData)`  
3. **正向解析**：数据模块标准化处理（去空格→"5"，若为空则存`null`）→ 更新临时数据  
4. **反向解析**：`useOptionEditor`将标准化数据转换为UI格式（"5"或空白）→ 响应式更新  
5. **全局状态同步（如需）**：若该选项值需跨模块共享→ 调用Pinia的`useOptionStore().setOptionValue(standardizedData)`  
6. **UI展示**：UI层从`useOptionEditor`获取已转换数据，更新输入框显示  


## 6. 五大模块数据流程（主线）
按数据从源头到结尾的顺序描述，明确模块间的衔接关系：

### 6.1 主模式（root_admin）→ 数据源头
- **功能**：  
  1. 按ExcelID规则创建卡片/选项（引用2.2节），通过`composables/useCardCreator.js`管理创建过程的局部状态（如当前编辑的临时卡片数据）  
  2. 配置卡片数据（`title`/`optionValue`等，引用3.1节），通过`useCardConfig()`处理配置逻辑  
  3. 设定`syncStatus`（同步/授权规则，引用3.2节），通过Pinia的`useSyncStore().setSyncStatus(config)`持久化全局同步配置  
  4. 手动触发两个关键操作：  
     - 点击“保存到题库”→ 调用`useTempData().persistToLibrary()`将组合规则持久化，同步调用`useEnvironmentStore().saveBaseParams()`存储原始参数到环境全量区  
     - 点击“同步到其他模式”→ 调用`useSyncStore().syncToMode(targetMode)`向环境全量区发起同步指令，传递参数标准  

### 6.2 题库 → 规则典籍（上半部经书）  
- **核心定位**：独立存储“组合表达式”及“逻辑规则”，不存储具体参数，也不直接查询环境全量区（如同“只记载‘A1+B2+C3→屠龙刀’的公式，不记载A1/B2/C3具体是什么”）。  
- **功能**：  
  1. 存储完整组合表达式（如`A1+B2+C3→屠龙刀`），仅包含元素ID的关联逻辑，不包含任何参数值，由Pinia的`useLibraryStore`管理。  
  2. 定义表达式的“语法规则”（如：A1必须与B2同时存在，C3需在A1之后生效等），规则校验逻辑抽离至`composables/useExpressionValidator.js`。  
  3. 组合表达式的“标准顺序”遵循**先按卡片标识字母排序，再按选项标识数字排序**（如A1→A9→B1→B2→C3，即字母优先级高于数字，同字母内按数字升序）。  
  4. 表达式存储时自动按标准顺序格式化（如用户输入B2+A1，题库会自动存储为A1+B2），格式化逻辑通过`composables/useExpressionFormatter.js`实现。  
  5. 向反馈区提供“验证标准1”：通过`useLibraryStore().validateExpression(elements)`判断用户提交的元素组合是否符合表达式的元素集合要求（当前不严格验证顺序）。  

### 6.3 环境全量区 → 参数典籍（下半部经书）  
- **核心定位**：独立存储所有元素的“具体参数标准”，不包含组合逻辑，也不直接查询题库（如同“只记载A1=玄铁150kg、B2=淬火工艺、C3=500℃，但不知道这些能组合成屠龙刀”）。  
- **功能**：  
  1. 存储所有元素的参数标准（如A1的`optionValue`标准范围为100-200kg，B2的`selectOptions`必须包含“淬火”），作为全局状态由`useEnvironmentStore`管理。  
  2. 向反馈区提供“验证标准2”：通过`useEnvironmentStore().validateParam(elementId, value)`判断用户提交的元素参数是否符合基础标准。  
  3. 保留原联动同步功能（数据分发、授权管理等），同步逻辑封装在`useEnvironmentStore`的Actions中（如`syncToMode`、`setFieldAuthorization`）。  

### 6.4 其他模式交互层 → 用户操作终端
- **功能**：  
  1. 通过`useEnvironmentStore().getSyncedData(modeId)`接收环境全量区推送的同步数据（参数标准）  
  2. 状态管理层处理展示转换：`composables/useDisplayFormatter().format(data)`将`null`转换为空白（引用3.3节），UI层按3.2.4节规则展示：  
     - 未同步+未授权→ 空白+禁用  
     - 未同步+已授权→ 空白+可编辑  
     - 已同步+未授权→ 同步内容+禁用  
     - 已同步+已授权→ 同步内容+可编辑  
  3. **数据提交原则**：  
     - 提交时以**界面最终显示值**为依据（无论该值是同步而来还是用户编辑输入）  
     - 若为“已同步+未授权”状态（同步内容不可编辑），自动提交界面上显示的同步内容（如同步内容为“500克”，则提交“500克”）  
     - 若为“已同步+已授权”或“未同步+已授权”状态，提交用户最终输入/修改的内容  
     - 若界面显示为空白（包括同步内容为`null`转换的空白、用户未填写的空白），提交时通过`useDataNormalizer().toStorageFormat(value)`自动转换为`null`（遵循3.3节空值标准）  
  4. 收集用户操作后，通过`composables/useSubmitHandler().submit(data)`处理后提交至匹配引擎反馈层  

### 6.5 匹配引擎反馈层 → 经书合璧验证区  
- **核心定位**：唯一能同时调用题库（上半部）和环境全量区（下半部）的模块，通过两道验证实现“经书合璧”，输出最终结果。  
- **功能**：  
  1. **接收输入**：通过`useFeedbackReceiver().getUserInput()`获取其他模式用户填写的完整数据。  
  2. **第一道验证（题库规则验证）**：  
     - 调用`useLibraryStore().getExpression(targetResult)`获取组合表达式（如`A1+B2+C3→屠龙刀`）  
     - 接收用户提交的元素组合（可能无序，如B2+A1+C3），通过`useExpressionFormatter().sort(elements)`自动按“字母+数字”规则排序→ 转换为A1+B2+C3  
     - 验证转换后的元素集合是否与题库表达式完全一致（当前不校验顺序，仅校验元素是否完整匹配）  
     - 若验证失败（如缺少B2），通过`useFeedbackRenderer().showError("组合错误，需包含A1+B2+C3")`返回提示  
  3. **第二道验证（全量区参数验证）**：  
     - 调用`useEnvironmentStore().getParamStandard(elementId)`获取参数标准  
     - 验证用户填写的具体参数是否符合标准（如A1=180kg在范围内），验证逻辑通过`composables/useParamValidator.js`实现  
     - 若验证失败（如A1=250kg超出范围），返回“参数错误，A1需在100-200kg之间”  
  4. **输出结果**：两道验证均通过后，通过`useFeedbackRenderer().showSuccess("匹配成功→屠龙刀", fullParams)`输出结果，展示完整参数。  


## 7. 环境全量区与联动功能合并说明
### 7.1 合并可行性分析
1. **数据关联性**：  
   环境全量区存储基础配置数据（卡片、选项、参数标准等），联动功能本质是这些数据的跨模式交互工具，两者属于“数据本体”与“交互能力”的强关联关系，合并后逻辑更紧密。

2. **代码结构兼容性**：  
   原实现中，环境配置变更会触发联动区的`notifyEnvConfigChanged`方法，说明两者已存在依赖关系；且联动功能（`syncToMode`、`setFieldAuthorization`等）核心是操作环境配置数据，合并后可减少跨模块调用。

3. **功能合理性**：  
   联动同步作为环境全量区的内置功能，符合“数据管理+交互能力”的一体化设计模式，可简化数据流转链路（减少中间环节），降低维护成本。

4. **职责边界清晰**：  
   环境全量区作为“原始信息仓库”，其核心是存储和分发基础数据；联动功能是“原始信息的跨模式传递工具”，两者均不涉及“信息组合逻辑”（该逻辑由题库专属负责），合并后不会混淆与题库的职责分工。

### 7.2 实施方案
1. **状态结构调整**：  
   将原`linkageSync`合并至`environmentConfigs`，作为全局状态由Pinia的`useEnvironmentStore`统一管理：  
   ```javascript
   // stores/environment.js
   export const useEnvironmentStore = defineStore('environment', {
     state: () => ({
       cards: {},
       options: {},
       uiPresets: [],
       scoringRules: [],
       contextTemplates: [],
       // 原联动区功能整合
       linkage: {
         syncHistory: [],       // 同步历史记录
         fieldAuthorizations: {}, // 字段授权配置
         pendingSyncs: []       // 待同步任务
       }
     }),
     actions: {
       // 同步到目标模式
       syncToMode(targetMode, data) {
         // 同步逻辑实现
       },
       // 设置字段授权
       setFieldAuthorization(fieldId, isAuthorized) {
         // 授权逻辑实现
       }
     }
   })
   ```

2. **功能迁移**：  
   - 将原联动区的同步逻辑（`syncToMode`）、授权管理（`setFieldAuthorization`）迁移至`useEnvironmentStore`的Actions中  
   - 同步/授权相关的局部交互逻辑（如同步进度提示、失败重试UI）抽离至`composables/useLinkageHandler.js`  
   - 保留所有核心逻辑（同步过滤、授权校验、历史记录），仅调整数据引用路径  

3. **模块交互优化**：  
   - 主模式→环境全量区：直接调用`useEnvironmentStore().syncToMode(targetMode, data)`发起同步  
   - 环境全量区→其他模式：同步完成后通过`composables/useEnvNotifier().notifyConfigChanged()`发布事件，其他模式通过`useEnvListener().onConfigChanged(callback)`监听  
   - 其他模式→环境全量区：通过`useEnvironmentStore().getFieldAuthorization(fieldId)`查询授权状态  


## 8. 附录
### 8.1 术语表
| 术语 | 定义 |  
|------|------|  
| 组合ID | 卡片标识+选项标识的组合（如"A1"），用于唯一定位选项 |  
| 正向解析 | 数据模块将UI原始数据（可能不规范）转换为标准化格式（如去空格、补`null`）的过程 |  
| 反向解析 | 状态管理层（Composables/Pinia）将数据模块的标准化数据转换为UI友好格式（含`null→空白`）的过程 |  
| 同步状态（hasSync） | 控制字段是否在其他模式展示数据的标记（true=展示同步内容，false=无内容），作为全局状态由Pinia管理 |  
| 授权状态（isAuthorized） | 控制字段是否允许其他模式编辑的标记（true=可编辑，false=只读），作为全局状态由Pinia管理 |  
| 临时数据 | 用户编辑中未确认保存的数据，作为局部状态由Composables管理，需手动操作才持久化 |  
| Composables | 封装组件内业务逻辑和局部状态的函数（`composables/*.js`），遵循“单一职责”原则，可被组件直接调用 |  
| Pinia Store | 管理全局共享状态的容器（`stores/*.js`），遵循State→Getters→Actions单向数据流，仅存储跨组件复用的状态 |  
| 环境全量区 | 系统原始信息的全集仓库，存储所有基础元素（卡片、选项、参数等），其状态由`useEnvironmentStore`管理，不包含组合逻辑，仅负责信息的存储与分发。 |  
| 题库 | 组合规则的集合，定义如何将环境全量区的原始信息按特定逻辑组合，其状态由`useLibraryStore`管理。 |  
| 组合表达式 | 题库中定义的元素关联规则（如`A1+B2+C3→屠龙刀`），其中元素ID（A1等）指向环境全量区的具体选项。 |  
| 原子化元素 | 环境全量区中不可再拆分的基础单元（如单个选项A1及其参数），是所有组合的最小构成单位。 |  
| 第一道验证 | 反馈区对用户提交的元素组合结构进行校验，依据题库的组合表达式判断元素集合是否匹配（当前自动排序后验证，不严格限制顺序）。 |  
| 第二道验证 | 反馈区对用户填写的具体参数进行校验，依据环境全量区的参数标准判断是否符合基础要求（如数值范围、选项合法性）。 |  
| 经书合璧 | 题库（上半部）与环境全量区（下半部）在反馈区通过两道验证实现配合，共同产出完整结果的过程。 |  

### 8.2 组合顺序处理规则  
| 场景 | 当前处理逻辑 | 未来扩展方向 |  
|------|--------------|--------------|  
| 顺序差异 | 自动按“字母+数字”排序后验证（如B2+A1→A1+B2），视为有效组合 | 可配置为“严格顺序验证”（如B2+A1≠A1+B2，视为无效组合） |  
| 排序优先级 | 1. 卡片标识字母（A→Z→AA→AB...）<br>2. 选项标识数字（1→2→...→9→10） | 支持自定义排序规则（如按卡片创建时间、用户自定义优先级） |

-----------------------------------------------------------------------------------------------------

# 项目规范文档（前版）

## 目录
1. 前言
2. Excel样式ID规范
3. 卡片数据结构与状态管理规范
4. 多模式数据处理与流转规范
5. 系统核心架构与分层职责
6. 六大模块数据流程（主线）
7. 附录


## 1. 前言
本文档整合项目全量规范，涵盖标识规则、数据结构、流转逻辑、架构设计及模块职责。核心目标是确保系统各环节遵循统一标准：**数据完整性优先、分层职责清晰、同步授权逻辑明确**，为开发提供唯一权威参考。


## 2. Excel样式ID规范
### 2.1 基础格式定义
采用“卡片标识+选项标识”的组合格式，用于唯一定位卡片及下属选项：
- **卡片标识**：纯大写英文字母序列（A-Z→AA-AZ→BA-BZ...），示例："A"、"BC"、"XYZ"
- **选项标识**：纯阿拉伯数字（1,2,3...），示例："1"、"5"、"12"
- **完整ID**：卡片标识+选项标识，示例："A1"（A卡片第1个选项）、"BC3"（BC卡片第3个选项）

### 2.2 生成规则
#### 2.2.1 卡片标识生成
- 初始标识为"A"，按字母顺序递增，单字母用尽后自动扩展位数：
  - 单字母：A→B→...→Z（共26个）
  - 双字母：AA→AB→...→AZ→BA→...→BZ（共26×26个）
  - 以此类推（三字母、四字母等）
- 生成函数示例：
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

#### 2.2.2 选项标识生成
- 每个卡片的首个选项标识为"1"
- 新增选项时，标识为当前卡片已有选项中的**最大标识+1**（与删除无关）：
  - 示例1：现有选项["1","2","3"]→新增为"4"
  - 示例2：现有选项["1","3","5"]→新增为"6"（最大标识为5，5+1=6）
- 生成函数示例：
  ```javascript
  function generateNextOptionId(existingOptions) {
    const maxId = existingOptions.reduce((max, id) => {
      const num = parseInt(id, 10);
      return num > max ? num : max;
    }, 0);
    return (maxId + 1).toString();
  }
  ```

### 2.3 解析规则
- 解析目标：将完整ID拆分为卡片标识和选项标识
- 解析函数示例：
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
- 无效格式示例："a1"（小写字母）、"1A"（数字在前）、"A-1"（含特殊字符）


## 3. 卡片数据结构与状态管理规范
### 3.1 核心数据结构（五项内容规范）
卡片及选项的基础结构必须包含以下字段，**无论是否有值/是否同步，字段均需存在**：

| 字段标识         | 含义                  | 数据类型                  | 空值标准（数据层） | 说明 |
|------------------|-----------------------|---------------------------|--------------------|------|
| `title`          | 卡片标题              | string \| null            | `null`             | 卡片的整体名称 |
| `optionName`     | 选项名称              | string \| null            | `null`             | 单个选项的名称 |
| `optionValue`    | 选项值                | string \| number \| null  | `null`             | 选项的具体数值或文本 |
| `optionUnit`     | 选项单位              | string \| null            | `null`             | 选项值的单位（如"kg"、"个"） |
| `selectOptions`  | 下拉菜单选项          | string[]                  | `[]`（空数组）     | 预定义的可选值列表 |

### 3.2 同步与授权状态（syncStatus）
同步控制“是否有数据可展示”，授权控制“是否允许编辑”，两者独立且需显式配置：

#### 3.2.1 状态结构interface SyncStatus {
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
#### 3.2.2 其他模式表现（核心逻辑）
| 场景 | 同步状态（hasSync） | 授权状态（isAuthorized） | 其他模式UI表现 |
|------|---------------------|--------------------------|----------------|
| 1    | false（未同步）     | false（未授权）          | 显示空白，控件禁用（不可编辑） |
| 2    | false（未同步）     | true（已授权）           | 显示空白，控件可交互（允许输入） |
| 3    | true（已同步）      | false（未授权）          | 显示同步的内容，控件禁用（灰色） |
| 4    | true（已同步）      | true（已授权）           | 显示同步的内容（作为提示），控件可交互（允许修改） |

### 3.3 空值处理（分层职责）
空值处理严格遵循分层原则，**禁止UI层参与数据转换**：

| 层级         | 处理逻辑                                                                 | 示例                          |
|--------------|--------------------------------------------------------------------------|-------------------------------|
| **数据层**   | 所有空值必须显式存储为`null`（禁止使用空字符串`""`、`undefined`或缺失字段） | 未填写的标题存储为`title: null` |
| **状态管理** | 负责反向解析：将数据层的`null`转换为UI层可直接使用的空白（`""`）           | 转换函数：`storageToDisplay = (v) => v === null ? "" : String(v)` |
| **UI层**     | 直接使用状态管理传递的已转换数据（空白），不处理任何值转换逻辑              | 输入框绑定状态管理的`displayValue`（空白则显示空输入框） |


## 4. 多模式数据处理与流转规范
### 4.1 核心流转规则（跨模块通用）
- **同步触发**：仅支持主模式手动点击同步按钮（无自动同步）
- **数据过滤**：按`syncStatus.hasSync`筛选字段（未同步字段在目标模式中为`null`）
- **失败处理**：同步失败仅支持手动重试（无自动重试）
- **空值传递**：流转过程中保持`null`不变，由状态管理在各模块内转换为空白（引用3.3节）

### 4.2 临时数据与持久化规则
- **临时数据（_tempData）**：  
  - 定义：用户正在编辑但未确认保存的数据（如未点击“保存”按钮的草稿）  
  - 存储：仅存在于内存，关闭页面或刷新后丢失  
  - 转换：需手动点击“添加到题库”按钮（`persistToLibrary()`）才转为持久化数据  

- **持久化数据（_persistedData）**：  
  - 存储位置：题库及环境全量信息区  
  - 存储范围：手动添加时，**自动存储全量信息**（包括未勾选同步的字段、未编辑的空值字段）  
  - 关联存储：添加到题库时，自动同步更新环境全量信息区的关联配置  


## 5. 系统核心架构与分层职责
### 5.1 分层架构
| 层级         | 技术实现          | 核心职责                                                                 | 禁止行为                                                                 |
|--------------|-------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **UI层**     | Vue组件（.vue）   | 1. 渲染页面元素（按钮、输入框等）<br>2. 接收用户操作并调用状态管理方法<br>3. 展示状态管理提供的已转换数据（空白/同步内容） | 1. 禁止直接访问数据模块<br>2. 不处理任何数据转换（如`null→空白`）<br>3. 不存储数据（所有数据从状态管理获取） |
| **状态管理** | Vue Pinia         | 1. 作为中间层，转发UI层指令到数据模块<br>2. 执行反向解析（含`null→空白`转换）<br>3. 维护响应式状态供UI层使用 | 1. 不存储原始数据（从数据模块获取，不缓存副本）<br>2. 不参与正向解析（不处理UI原始数据的标准化） |
| **数据模块** | JavaScript模块    | 1. 存储全量数据（临时+持久化）<br>2. 执行正向解析（UI原始数据→标准化格式）<br>3. 提供数据操作接口（仅对状态管理开放） | 1. 不处理UI交互逻辑<br>2. 不参与反向解析（不关心UI展示格式）<br>3. 不直接暴露内部数据（返回副本） |

### 5.2 单模块内部数据处理（技术细节）
以“用户在其他模式编辑选项值”为例，描述单个模块内的分层交互：  
1. **用户输入**：UI层接收原始输入（如" 5 "，带空格）→ 调用状态管理`updateOptionValue(rawData)`  
2. **指令转发**：状态管理将原始数据转发给数据模块`updateTempData(rawData)`  
3. **正向解析**：数据模块标准化处理（去空格→"5"，若为空则存`null`）→ 更新临时数据  
4. **反向解析**：状态管理从数据模块获取标准化数据→ 转换为UI格式（"5"或空白）  
5. **UI展示**：UI层从状态管理获取已转换数据，更新输入框显示  


## 6. 六大模块数据流程（主线）
按数据从源头到结尾的顺序描述，明确模块间的衔接关系：

### 6.1 主模式（root_admin）→ 数据源头
- **功能**：  
  1. 按ExcelID规则创建卡片/选项（引用2.2节）  
  2. 配置卡片数据（`title`/`optionValue`等，引用3.1节）  
  3. 设定`syncStatus`（同步/授权规则，引用3.2节）  
  4. 手动触发两个关键操作：  
     - 点击“保存到题库”→ 将临时数据持久化到题库（引用4.2节）  
     - 点击“同步到其他模式”→ 将数据推送至联动同步授权推送区  

### 6.2 题库 → 数据存储中心
- **功能**：  
  1. 接收主模式的持久化数据（全量存储，包括未同步字段）  
  2. 存储配方规则及选项依赖关系  
  3. 向环境全量信息区同步数据（自动关联存储）  

### 6.3 环境全量信息区 → 数据分发枢纽
- **功能**：  
  1. 接收题库的全量数据，作为系统统一信息源  
  2. 为所有模块提供数据查询接口（如主模式查询历史配置、其他模式查询基础结构）  

### 6.4 联动同步授权推送区 → 数据中转站
- **功能**：  
  1. 接收主模式的同步指令及数据  
  2. 按`syncStatus`过滤数据（未同步字段设为`null`，引用4.1节）  
  3. 将过滤后的数据推送至目标“其他模式”  

### 6.5 其他模式交互层 → 用户操作终端
- **功能**：  
  1. 接收联动同步授权推送区的同步数据  
  2. 状态管理将`null`转换为空白（引用3.3节），UI层按3.2.2节规则展示：  
     - 未同步+未授权→ 空白+禁用  
     - 未同步+已授权→ 空白+可编辑  
     - 已同步+未授权→ 同步内容+禁用  
     - 已同步+已授权→ 同步内容+可编辑  
  3. 收集用户操作（选择/输入），提交至匹配引擎  

### 6.6 匹配引擎反馈层 → 结果输出终端
- **功能**：  
  1. 接收其他模式提交的用户操作数据  
  2. 与题库中的配方规则进行匹配（粗糙保留基础逻辑）  
  3. 向其他模式返回匹配结果，由UI层展示  


## 7. 附录
### 7.1 术语表
| 术语 | 定义 |
|------|------|
| 组合ID | 卡片标识+选项标识的组合（如"A1"），用于唯一定位选项 |
| 正向解析 | 数据模块将UI原始数据（可能不规范）转换为标准化格式（如去空格、补`null`）的过程 |
| 反向解析 | 状态管理将数据模块的标准化数据转换为UI友好格式（含`null→空白`）的过程 |
| 同步状态（hasSync） | 控制字段是否在其他模式展示数据的标记（true=展示同步内容，false=无内容） |
| 授权状态（isAuthorized） | 控制字段是否允许其他模式编辑的标记（true=可编辑，false=只读） |
| 临时数据 | 用户编辑中未确认保存的数据，需手动操作才持久化 |