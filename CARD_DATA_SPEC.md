### 卡片数据八项内容规范备忘录（开发者版）

#### 一、核心原则
1. **结构完整性优先**：无论是否有值/是否授权，8项内容必须在数据结构中完整存在（不允许因空值缺失字段）
2. **同步与授权分离**：
   - 同步（`hasSync`）：控制是否展示值（空值需显式用`null`）
   - 授权（`isAuthorized`）：控制是否允许编辑（未授权时输入框禁用）
3. **空值明确化**：所有未填充/未同步的值必须显式设置为`null`，禁止使用`undefined`或省略字段


#### 二、八项内容定义及规范（必存在）

| 序号 | 字段标识                | 含义                  | 存在要求                | 同步规则                  | 空值处理          |
|------|-------------------------|-----------------------|-------------------------|---------------------------|-------------------|
| 1    | `cardCount`             | 卡片数量              | 通过数组长度隐式体现    | 固定同步（源数组长度决定） | 数组长度为0       |
| 2    | `options`               | 选项数据数组          | 必须为数组（允许空数组） | 固定同步（结构必传）      | `[]`（空数组）    |
| 3    | `cardOrder`             | 卡片顺序              | 通过数组索引隐式体现    | 固定同步（源数组顺序决定） | 索引自然排序      |
| 4    | `title`                 | 卡片标题              | 必须有`title`字段       | 可配置同步（用户选择）    | `null`            |
| 5    | `optionName`            | 选项名称（`options`子项） | 每个`option`必须有`name`字段 | 可配置同步（用户选择） | `null`            |
| 6    | `optionValue`           | 选项值（`options`子项）  | 每个`option`必须有`value`字段 | 可配置同步（用户选择） | `null`            |
| 7    | `optionUnit`            | 选项单位（`options`子项） | 每个`option`必须有`unit`字段 | 可配置同步（用户选择） | `null`            |
| 8    | `selectOptions`         | 下拉菜单选项          | 必须为数组（允许空数组） | 固定同步（结构必传）      | `[]`（空数组）    |


#### 三、同步/授权状态标记（必存在）
每个可配置字段需包含状态标记（在`syncStatus`对象中）：
```javascript
{
  syncStatus: {
    title: {
      hasSync: boolean,  // 是否同步（控制是否展示值）
      isAuthorized: boolean  // 是否授权（控制是否可编辑）
    },
    options: {
      name: { hasSync, isAuthorized },
      value: { hasSync, isAuthorized },
      unit: { hasSync, isAuthorized }
    },
    selectOptions: {
      hasSync: true,  // 固定为true
      isAuthorized: false  // 固定为false
    }
  }
}
```


#### 四、反例警示（禁止出现）
1. **错误**：因`title`未同步而删除该字段
   ```javascript
   // 禁止 ❌
   { data: { options: [], selectOptions: [] } }  // 缺失title字段
   ```
   
2. **错误**：因`optionName`未授权而删除子项字段
   ```javascript
   // 禁止 ❌
   { data: { options: [{ value: 10, unit: 'kg' }] } }  // 缺失name字段
   ```
   
3. **错误**：用`undefined`表示空值
   ```javascript
   // 禁止 ❌
   { data: { title: undefined, options: [] } }
   ```

4. **正确示例**：完整结构（含空值）
   ```javascript
   // 正确 ✅
   {
     data: {
       title: null,  // 显式null
       options: [{ name: null, value: null, unit: null }],  // 子项完整
       selectOptions: []  // 空数组
     },
     syncStatus: { /* 状态标记完整 */ }
   }
   ```


#### 五、关键逻辑映射
- **展示规则**：`hasSync === true` 时显示`value`，否则显示空白（但字段必须存在）
- **编辑规则**：`isAuthorized === true` 时输入框可编辑，否则禁用
- **灰色提示**：`hasSync && isAuthorized` 时显示“同步值：xxx”（父组件控制，不依赖子组件）

--- 

此规范确保所有模式下的卡片数据结构一致，避免因空值/未授权导致的解析错误，前端渲染逻辑可统一处理。



______________________________________________________________________________



在多模式推送场景中，`空字符 ↔ null` 的转换逻辑需要严格遵循“**存储层统一用 null，展示层按需转空字符**”的原则，具体分工和流程如下：


### 一、推送前（主模式处理）：空字符 → null
**责任方：主模式的状态管理（cardStore）**  
- 主模式用户在编辑时，若输入空字符（如清空标题输入框），主模式的状态管理会在保存时（如 `updateCardTitle` 方法）自动将空字符转为 `null`（确保主模式本地存储符合规范）。  
- 推送前的校验（`validateConfiguration`）会强制检查：所有空值必须是 `null`，若存在未转换的空字符，会阻断推送（避免源头数据污染）。  


### 二、推送中（数据流转）：保持 null 传递
**责任方：状态管理的同步逻辑（syncToMode 方法）**  
- 主模式向目标模式推送时，状态管理会按同步规则处理字段：  
  - 对于**已勾选同步的字段**：直接传递主模式的 `null` 值（不转为空字符），确保目标模式接收的原始数据符合规范。  
  - 对于**未勾选同步的字段**：强制设为 `null`（而非空字符），例如未同步 `title` 时，目标模式的 `title` 必须是 `null`（符合“结构完整但值为空”的要求）。  
- 示例代码（核心转换逻辑）：  
  ```javascript
  // 同步时确保空值始终为null
  const syncedCard = {
    data: {
      title: syncFields.includes('title') ? sourceCard.data.title : null, // 直接传递null
      options: sourceCard.data.options.map(opt => ({
        name: syncFields.includes('optionName') ? opt.name : null, // 未同步字段强制为null
        value: syncFields.includes('optionValue') ? opt.value : null,
        unit: syncFields.includes('optionUnit') ? opt.unit : null
      }))
    }
  };
  ```


### 三、推送后（目标模式处理）：存储用 null，展示转空字符
1. **存储环节（目标模式接收）**  
   **责任方：目标模式的状态管理**  
   - 目标模式加载推送数据时（`loadSessionCards` 方法），直接保留 `null` 值（不做转换），确保本地存储的原始数据符合规范。  

2. **展示环节（目标模式渲染）**  
   **责任方：目标模式的组件（如卡片组件）**  
   - 目标模式组件在渲染时（如输入框展示），将 `null` 转为空字符（`''`），避免用户看到“null”字样（仅为视觉优化，不改变原始数据）。  

3. **目标模式编辑后**  
   **责任方：目标模式的状态管理**  
   - 若目标模式用户清空输入框（输入空字符），其状态管理会在保存时（如 `updateModeCardLocalValue` 方法）将空字符转为 `null`，确保修改后的数据仍符合规范。  


### 四、兜底保障：数据模块（如 DataManager）
- 若涉及跨模式持久化（如存入 localStorage），数据模块在读写时会二次校验：  
  - 写入前：将所有空字符强制转为 `null`（防止中间环节疏漏）。  
  - 读取后：将意外出现的空字符（如手动修改存储数据）转为 `null` 再交给状态管理。  


### 核心结论
- **所有存储环节（主模式存储、推送过程、目标模式存储）**：由**状态管理**负责将空字符转为 `null`，确保数据规范统一。  
- **所有展示环节（主模式/目标模式的UI）**：由**组件**负责将 `null` 转为空字符，仅影响视觉展示，不改变原始数据。  

这种分工保证了多模式间数据流转时，空值处理的一致性，严格遵循你定义的“空值必须显式为 null”的规范。