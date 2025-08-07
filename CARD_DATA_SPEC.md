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