# UniversalCard 最小化升级说明

## 升级内容

### 🎯 零破坏性升级
升级前后的 `UniversalCard.vue` 除了增加选项级别控制外，完全保持原样，没有增加额外冗余内容。

### 📝 具体变化

#### 变化1：选项复选框控制
```javascript
// 升级前
v-if="editableFields.optionCheckbox"

// 升级后（完全向后兼容）
v-if="editableFields.optionCheckbox || option.itemCheckbox"
```

#### 变化2：选项名称编辑控制
```javascript
// 升级前
v-if="editableFields.optionActions && editableFields.optionName"

// 升级后（完全向后兼容）
v-if="(editableFields.optionActions && editableFields.optionName) || option.itemName"
```

#### 变化3：选项值编辑控制
```javascript
// 升级前
v-if="editableFields.optionActions && editableFields.optionValue"

// 升级后（完全向后兼容）
v-if="(editableFields.optionActions && editableFields.optionValue) || option.itemValue"
```

#### 变化4：选项单位编辑控制
```javascript
// 升级前
v-if="editableFields.optionActions && editableFields.optionUnit"

// 升级后（完全向后兼容）
v-if="(editableFields.optionActions && editableFields.optionUnit) || option.itemUnit"
```

#### 变化5：选项操作按钮控制
```javascript
// 升级前
v-if="editableFields.optionActions"

// 升级后（完全向后兼容）
v-if="editableFields.optionActions || option.itemActions"
```

## 使用说明

### ✅ 原有用法完全不变
所有现有的父组件（如 `CardSection.vue`）无需任何修改，功能完全保持一致。

### ✅ 新增选项级别控制（可选）
父组件现在可以选择性地为特定选项设置独立编辑权限：

```javascript
// 为选项添加独立编辑权限（可选）
const option = {
  id: 'opt-1',
  itemCheckbox: true,  // 该选项单独显示复选框
  itemName: true,      // 该选项的名称可编辑
  itemValue: false,    // 该选项的值不可编辑
  itemUnit: true,      // 该选项的单位可编辑
  itemActions: false   // 该选项不显示+/-按钮
}
```

### 🔄 三种控制模式

1. **原有模式**：不设置选项级控制字段，完全使用卡片级控制
2. **选项级别控制**：设置选项级控制字段（`itemXXXXXX`），独立使用独立控制
3. **混合控制**：同时使用两种控制方式，任一控制字段为`true`即生效

## 核心优势

- ✅ **零破坏性**：现有代码完全不受影响
- ✅ **最小修改**：仅通过逻辑或（||）扩展控制能力
- ✅ **完全向后兼容**：新功能为可选，不使用时表现完全一致
- ✅ **保持受控组件纯粹性**：所有控制逻辑由父组件决定，组件仅负责渲染
- ✅ **彻底独立隔离**：卡片级与选项级控制字段完全不重名，避免冲突