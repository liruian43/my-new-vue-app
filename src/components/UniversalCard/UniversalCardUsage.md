# UniversalCard 使用指南

本指南覆盖 UniversalCard 在“纯受控 + 单向流 + 芯片式复用”定位下的全部用法，以及从旧版本迁移到新版本的注意事项。还包含“两个基础功能组合”的示例（例如：添加预设由父组件组合实现）。

## 一、设计定位与核心原则
- 受控组件：父组件是唯一事实来源。UniversalCard 仅渲染传入数据，并通过事件把用户输入回传。
- 单向数据流：父 → 子（状态与配置）；子 → 父（输入内容变化）。
- 组件不存业务态：是否可编辑（name/value/unit）由父组件通过 `editState`/`editDefaults` 声明式下发；子组件不再维护内部编辑态缓存，不再执行命令式指令。

## 二、关键 Props 与事件

必备受控数据（沿用旧版）
- `v-model:modelValue`：卡片标题。
- `v-model:options`：选项数组，形如：
  ```js
  {
    id: string,
    name: string,
    value: string | null,
    unit: string | null,
    checked: boolean
  }
v-model:selectedValue：下拉输入框内容。
selectOptions：下拉可选项，形如 { id, label }[]。
showDropdown：是否显示下拉。
isTitleEditing / isOptionsEditing / isSelectEditing：是否处于相应的编辑模式。
显示类能力（保留）

editableFields：只控制“是否显示某些控件”，不再决定是否可编辑 name/value/unit。
optionCheckbox：是否显示选项复选框
optionActions：是否显示选项加减按钮
select：是否显示/启用下拉编辑面板
optionName/optionValue/optionUnit 在新版本仅为兼容保留，不参与编辑态判断
新增（这次的重要变更）

editState: { [optionId]: { name?: boolean, value?: boolean, unit?: boolean } }
稀疏映射：只放变化点（单个或少量选项的编辑态）。
editDefaults: { name?: boolean, value?: boolean, unit?: boolean }
字段级默认回退：未在 editState 指定时按该值渲染。
不提供时缺省为 false（只读）。
编辑态渲染规则

对每个选项的每个字段：

effective = editState[id]?.[field] ?? editDefaults[field] ?? false
子组件不存内部编辑态，不做合并与优先级判断。
事件（保持不变）

update:modelValue(newTitle)：标题编辑时触发。
update:options(newOptions)：选项内容/勾选/加减变动时触发。
update:selectedValue(newValue)：下拉输入时触发。
onAddOption(afterId) / onDeleteOption(optionId)：选项加减。
onAddSelectOption(label) / onDeleteSelectOption(optionId)：下拉选项增删。
onDropdownToggle(boolean)：打开/关闭下拉。
废弃

writeField：旧的命令式接口已废弃。新版本仍接受该 prop，但仅打印警告，忽略其内容。
三、父组件如何控制“编辑/只读”切换
1) 批量切换（不设优先级，最新指令生效）
父组件遍历选项 id，写同一个字段的布尔值：


// 切换【名称】为可编辑
for (const opt of card.data.options) {
  card.editState[opt.id] = { ...(card.editState[opt.id] || {}), name: true };
}
// 可选：更新默认回退，便于新增选项沿用
card.editDefaults.name = true;
2) 单独切换某个选项的某个字段

const id = targetOptionId;
const current = !!(card.editState[id]?.value ?? card.editDefaults.value ?? false);
card.editState[id] = { ...(card.editState[id] || {}), value: !current };
3) 新增选项
不写 editState 也可正常工作：它会自然回退到 editDefaults 中的值。
若希望“立即显式化”为某种状态，可在新增后立刻为该 id 写入对应布尔位。
4) 删除选项
同步清理 editState[deletedId]（可选，利于整洁）。
5) 响应式注意
替换子对象，确保 Vue 追踪：

card.editState[id] = { ...(card.editState[id] || {}), [field]: value };
card.editState = { ...card.editState }; // 若有必要，整体替换提升响应性
四、“添加预设”等组合功能（父组件内实现）
“预设”本质是把“勾选选项 + 编辑态布尔位”的一组状态保存起来，未来一键回放。全部在父组件实现，UniversalCard 对预设无感。

示例数据结构


presets: [
  {
    id: 'p1',
    label: '预设A',
    checkedOptionIds: ['opt1', 'opt3'],
    editStateSnapshot: {
      opt1: { name: true, value: false, unit: true },
      opt3: { name: false }
    }
  }
]
保存预设


function savePresetFromCard(card) {
  const checkedOptionIds = card.data.options.filter(o => o.checked).map(o => o.id);
  const snapshot = JSON.parse(JSON.stringify(card.editState || {})); // 深拷贝
  const preset = { id: genId(), label: '新的预设', checkedOptionIds, editStateSnapshot: snapshot };
  presets.push(preset);
}
应用预设


function applyPresetToCard(preset, card) {
  // 勾选回放
  for (const o of card.data.options) {
    o.checked = preset.checkedOptionIds.includes(o.id);
  }
  // 编辑态回放
  card.editState = { ...(preset.editStateSnapshot || {}) };
  // 可选：同时设置 editDefaults，控制未显式指定的选项/字段的回退
  // card.editDefaults = { name: true, value: false, unit: true };
}
不恢复数值

若只做“勾选捆绑/编辑态捆绑”，上面的做法即可。
以后若需要“恢复内容值”，也应由父组件直接改 card.data.options[*].value/name/unit 并通过 v-model:options 下发。
五、从旧版迁移到新版
旧版特点

子组件内部维护编辑态缓存，通过 writeField 命令式更新。
editableFields.optionName/Value/Unit 参与编辑态判断。
新版变化

编辑态改为父侧受控：用 editState（稀疏）+ editDefaults（回退）。
editableFields 仅用于“显示类能力”，不再决定 name/value/unit 的编辑态。
writeField 废弃；子组件不再 watch 实施，仅打印警告。
迁移步骤

在父组件为每张卡片新增受控状态：

card.editState = {};                  // 稀疏映射
card.editDefaults = { name: true, value: true, unit: true }; // 示例默认
把原来写 writeField 的地方，改为直接改 card.editState（单个/批量）或 card.editDefaults（默认）。
保留 editableFields 用于控制“复选框/加减按钮/下拉”的显示。
移除对子组件编辑态的任何本地推断或合并逻辑。
对比：单项切换（旧 → 新）

旧：card.writeField = { type: 'single', field: 'name', value: true, optionId }
新：

card.editState[optionId] = { ...(card.editState[optionId] || {}), name: true };
对比：批量切换（旧 → 新）

旧：card.writeField = { type: 'batch', field: 'value', value: false }
新：

for (const o of card.data.options) {
  card.editState[o.id] = { ...(card.editState[o.id] || {}), value: false };
}
// 可选：同步默认
card.editDefaults.value = false;
六、最佳实践小贴士
安全缺省：当 editState 和 editDefaults 都没指定时，子组件按只读渲染，防止误编辑。
稀疏优先：只把变化点写进 editState，把“通用初始值”放在 editDefaults，降低父组件维护成本。
最新指令生效：同一个布尔位最后写入的值即当前界面状态。无需设优先级。
受控边界清晰：UniversalCard 不知道预设、不知道你的业务策略；它只知道“是否可编辑”和“是否显示哪些控件”。
七、接口速查
子组件 Props（主要）

modelValue: string，options: Option[]，selectedValue: string，selectOptions: {id,label}[]
showDropdown: boolean，isTitleEditing: boolean，isOptionsEditing: boolean，isSelectEditing: boolean
editableFields: { optionCheckbox, optionActions, select, ...兼容项 }
editState: { [optionId]: { name?, value?, unit? } }
editDefaults: { name?, value?, unit? }
子组件 Emits

update:modelValue(newTitle)
update:options(newOptions)
update:selectedValue(newValue)
子组件回调 props

onAddOption(afterId) / onDeleteOption(optionId)
onAddSelectOption(label) / onDeleteSelectOption(optionId)
onDropdownToggle(boolean)
onSearchTermChange(input)
废弃

writeField（保留入参但无效，控制台告警）


说明
- 我严格在你提供的原代码基础上做了“最小侵入修改”：仅移除了内部编辑态缓存与 `writeField` 的实际处理，新增了 `editState`/`editDefaults` 两个受控输入，并将 `isEdit` 切换为使用新规则；其它结构、样式、已有回调与 v-model 行为完全保留。
- 测试页会在你下一步按“使用指南”的方式迁移后，恢复并增强对“批量/单独/预设”的控制能力。现在子组件已经具备正确的受控接口，父组件可以按“最新指令生效”的原则自由组合。