<template>
  <div :class="['universal-card', className]" :style="style">
    <!-- 标题：使用 v-model 绑定本地副本 -->
    <div v-if="!isTitleEditing" class="card-title">{{ modelValue }}</div>
    <input
      v-else
      type="text"
      v-model="localModelValue"
      @input="updateTitle(localModelValue)"
      class="card-title-input"
      ref="titleInputRef"
    />

    <div class="card-content">
      <div v-if="localOptions.length === 0" class="empty-options">
        <p>没有选项，请添加至少一个选项</p>
        <button class="add-first-option" @click="onAddOption(null)">
          添加选项
        </button>
      </div>
      <div v-else class="options-list">
        <div
          v-for="option in localOptions"
          :key="option.id"
          :class="['option', isOptionsEditing ? 'editing' : 'view']"
        >
          <input
            v-if="editableFields.optionCheckbox"
            type="checkbox"
            v-model="option.checked"
            @change="updateOption(option.id, { checked: option.checked })"
          />

          <input
            v-if="isEdit(option.id, 'name')"
            type="text"
            v-model="option.name"
            @input="updateOption(option.id, { name: option.name })"
            class="option-name-input"
          />
          <span v-else-if="!isEdit(option.id, 'name')" class="option-name">{{ option.name || "未命名" }}</span>

          <input
            v-if="isEdit(option.id, 'value')"
            type="text"
            v-model="option.value"
            @input="updateOption(option.id, { value: option.value || null })"
            class="option-value-input"
          />
          <span v-else-if="!isEdit(option.id, 'value')" class="option-value">{{ option.value ?? "-" }}</span>

          <input
            v-if="isEdit(option.id, 'unit')"
            type="text"
            v-model="option.unit"
            @input="updateOption(option.id, { unit: option.unit || null })"
            class="option-unit-input"
          />
          <span v-else-if="!isEdit(option.id, 'unit')" class="option-unit">{{ option.unit ?? "-" }}</span>

          <div v-if="editableFields.optionActions" class="option-actions">
            <button @click="onAddOption(option.id)" class="action-button add">
              +
            </button>
            <button
              @click="onDeleteOption(option.id)"
              class="action-button delete"
              :disabled="localOptions.length <= 1"
            >
              -
            </button>
          </div>
        </div>
      </div>

      <div class="searchable-select" ref="selectContainerRef">
        <div class="select-input-container">
          <input
            type="text"
            v-model="localSelectedValue"
            @input="updateSelectedValue(localSelectedValue)"
            @click="onDropdownToggle(true)"
            @blur="handleBlur"
            :class="[
              'select-input',
              isSelectEditing && editableFields.select ? 'editable' : '',
            ]"
            ref="selectInputRef"
          />

          <div
            v-if="isSelectEditing && editableFields.select"
            class="dropdown-actions"
          >
            <button
              class="action-button add"
              @click="addSelectOption"
              :disabled="!(localSelectedValue || '').trim()"
            >
              +
            </button>

            <button
              class="action-button delete"
              @click="deleteSelectedOption"
              :disabled="!canDelete"
            >
              -
            </button>
          </div>
        </div>

        <div
          v-if="showDropdown"
          :class="[
            'select-dropdown',
            isSelectEditing && editableFields.select ? 'editable' : '',
          ]"
          ref="dropdownRef"
          :style="dropdownInlineStyle"
        >
          <div v-if="filteredOptions.length === 0" class="dropdown-empty">
            {{
              isSelectEditing && editableFields.select
                ? "没有匹配的选项，输入内容后点击+添加"
                : "没有匹配的选项"
            }}
          </div>
          <div v-else>
            <div
              v-for="option in filteredOptions"
              :key="option.id"
              class="dropdown-option"
              @click="selectOption(option)"
            >
              {{ option.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  defineProps,
  defineEmits
} from "vue";

// 定义 props
const props = defineProps({
  // 原有：className 和 style
  className: {
    type: String,
    default: ''
  },
  style: {
    type: Object,
    default: () => ({})
  },
  // 原有受控数据 props（保持不变）
  modelValue: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  selectedValue: {
    type: String,
    default: "",
  },
  selectOptions: {
    type: Array,
    default: () => [],
  },
  showDropdown: {
    type: Boolean,
    required: true,
  },
  isTitleEditing: {
    type: Boolean,
    default: false,
  },
  isOptionsEditing: {
    type: Boolean,
    default: false,
  },
  isSelectEditing: {
    type: Boolean,
    default: false,
  },

  // 可见性类能力（保留）：不再用于 name/value/unit 的编辑态控制
  editableFields: {
    type: Object,
    default: () => ({
      title: true,
      optionName: true,   // 兼容保留，但不再用于编辑态判断
      optionValue: true,  // 兼容保留，但不再用于编辑态判断
      optionUnit: true,   // 兼容保留，但不再用于编辑态判断
      optionCheckbox: true,
      select: true,
      optionActions: true,
    }),
  },

  // 回调（保持不变）
  onAddOption: {
    type: Function,
    required: true,
  },
  onDeleteOption: {
    type: Function,
    required: true,
  },
  onAddSelectOption: {
    type: Function,
    required: true,
  },
  onDeleteSelectOption: {
    type: Function,
    required: true,
  },
  onDropdownToggle: {
    type: Function,
    required: true,
  },
  onSearchTermChange: {
    type: Function,
    default: () => {},
  },

  // 新增：声明式受控编辑态（父组件提供；稀疏映射）
  // 形如：{ [optionId]: { name?: boolean, value?: boolean, unit?: boolean } }
  editState: {
    type: Object,
    default: () => ({})
  },
  // 新增：字段级默认回退（父组件提供；不提供则默认 false）
  // 形如：{ name?: boolean, value?: boolean, unit?: boolean }
  editDefaults: {
    type: Object,
    default: () => ({})
  },

  // 兼容保留（已废弃）：命令式指令，不再在子组件内落地为状态
  writeField: {
    type: Object,
    default: () => ({})
  }
});

// emits（保持不变）
const emits = defineEmits([
  "update:modelValue",
  "update:options",
  "update:selectedValue",
]);

// 本地镜像（受控数据）
const localModelValue = ref(props.modelValue);
const localOptions = ref([...props.options]);
const localSelectedValue = ref(props.selectedValue);
const titleInputRef = ref(null);

// 下拉定位 refs
const selectContainerRef = ref(null);
const selectInputRef = ref(null);
const dropdownRef = ref(null);
const dropdownInlineStyle = ref({});

// 计算属性
const filteredOptions = computed(() => {
  return props.selectOptions.filter((option) =>
    option.label
      .toLowerCase()
      .includes((localSelectedValue.value || "").toLowerCase())
  );
});

const selectedOption = computed(() => {
  if (!localSelectedValue.value) return null;
  return props.selectOptions.find(
    (option) => option.label === localSelectedValue.value
  );
});

const canDelete = computed(() => {
  return (
    props.isSelectEditing &&
    props.editableFields.select &&
    selectedOption.value !== undefined &&
    props.selectOptions.length > 1
  );
});

// 纯受控编辑态：由 editState + editDefaults 决定
const isEdit = (id, f) => {
  const st = props.editState?.[id]?.[f];
  if (typeof st === 'boolean') return st;
  const def = props.editDefaults?.[f];
  if (typeof def === 'boolean') return def;
  return false; // 安全缺省：只读
};

// 方法
const updateTitle = (newTitle) => {
  localModelValue.value = newTitle;
  emits("update:modelValue", newTitle);
};

const updateOption = (optionId, changes) => {
  const index = localOptions.value.findIndex((o) => o.id === optionId);
  if (index !== -1) {
    localOptions.value[index] = { ...localOptions.value[index], ...changes };
    emits("update:options", [...localOptions.value]);
  }
};

const updateSelectedValue = (newValue) => {
  localSelectedValue.value = newValue;
  emits("update:selectedValue", newValue);
  props.onSearchTermChange(newValue);
};

const selectOption = (option) => {
  updateSelectedValue(option.label);
  props.onDropdownToggle(false);
};

const addSelectOption = () => {
  if ((localSelectedValue.value || "").trim()) {
    props.onAddSelectOption(localSelectedValue.value.trim());
    updateSelectedValue("");
  }
};

const handleBlur = () => {
  setTimeout(() => props.onDropdownToggle(false), 200);
};

const deleteSelectedOption = () => {
  if (selectedOption.value) {
    props.onDeleteSelectOption(selectedOption.value.id);
    updateSelectedValue("");
  }
};

// 下拉定位
const updateDropdownPosition = () => {
  if (!selectContainerRef.value || !selectInputRef.value || !dropdownRef.value) return;

  const containerRect = selectContainerRef.value.getBoundingClientRect();
  const inputRect = selectInputRef.value.getBoundingClientRect();
  const left = inputRect.left - containerRect.left;

  dropdownInlineStyle.value = {
    left: `${left}px`,
    right: 'auto',
    marginLeft: '0px',
    marginRight: '0px',
  };
};

watch(
  () => [props.showDropdown, props.isSelectEditing, props.editableFields.select],
  async () => {
    await nextTick();
    if (props.showDropdown) updateDropdownPosition();
  }
);

const handleResize = () => {
  if (props.showDropdown) updateDropdownPosition();
};

// 生命周期
onMounted(() => {
  if (props.isTitleEditing && titleInputRef.value) {
    titleInputRef.value.focus();
  }

  window.addEventListener('resize', handleResize);

  if (props.showDropdown) {
    nextTick(() => updateDropdownPosition());
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

// 同步 props → 本地镜像
watch(
  () => props.modelValue,
  (newValue) => {
    localModelValue.value = newValue;
  }
);

watch(
  () => props.options,
  (newOptions) => {
    localOptions.value = [...newOptions];
  }
);

watch(
  () => props.selectedValue,
  (newValue) => {
    localSelectedValue.value = newValue;
  }
);

// 兼容提示：writeField 已废弃，子组件不再处理（避免破坏单向流）
watch(
  () => props.writeField,
  (wf) => {
    if (wf && (wf.type || wf.field)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[UniversalCard] writeField 已废弃，请在父组件维护 editState/editDefaults 并下发；当前传入的 writeField 将被忽略：',
        wf
      );
    }
  },
  { deep: true, immediate: true }
);
</script>

<style scoped>
/* 样式保持不变 */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.universal-card,
.card-title,
.card-title-input,
.card-content,
.options-list,
.option,
.empty-options,
.searchable-select,
.select-dropdown,
.dropdown-option,
.delete-selected-btn {
  margin-top: 4px;
  margin-bottom: 4px;
}

.universal-card > :first-child,
.card-content > :first-child,
.options-list > :first-child,
.select-dropdown > :first-child {
  margin-top: 0;
}

.universal-card > :last-child,
.card-content > :last-child,
.options-list > :last-child,
.select-dropdown > :last-child {
  margin-bottom: 0;
}

.universal-card {
  max-width: 240px !important;
  margin: 0 auto !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 8px !important;
  padding: 4px !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05) !important;
  background-color: #fff !important;
}

.card-title {
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  padding: 4px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.card-title-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 16px;
  font-weight: bold;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 4px;
  text-align: center;
}

.card-content {
  padding: 4px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-options {
  padding: 8px;
  font-size: 14px;
  color: #666;
}

.empty-options .add-first-option {
  margin-top: 4px;
  padding: 4px 8px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.option {
  display: flex;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #eee;
  gap: 4px;
}

.option.view {
  cursor: pointer;
}

.option.editing {
  gap: 4px;
}

.option-name,
.option-value,
.option-unit {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.option-name {
  flex: 2;
}

.option-value {
  flex: 1;
  text-align: right;
}

.option-unit {
  flex: 1;
}

.option-input {
  padding: 2px 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  width: 43px;
  max-width: 43px;
  overflow-x: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-input::-webkit-scrollbar {
  display: none;
}

.option-name-input,
.option-value-input,
.option-unit-input {
  overflow-x: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap.
}

.option-name-input {
  flex: 2;
  width: 54px;
  max-width: 54px;
}

.option-value-input {
  flex: 1;
  width: 40px;
  max-width: 40px;
  text-align: right;
}

.option-unit-input {
  flex: 1;
  width: 30px;
  max-width: 30px;
}

.option input[type="checkbox"] {
  flex-shrink: 0;
  width: 20px;
  margin: 0 4px 0 0;
}

.option-actions {
  display: flex;
  gap: 4px;
  margin-left: 0;
  flex-shrink: 0;
  min-width: 46px;
}

.action-button {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.action-button.add {
  background-color: #4caf50;
  color: white;
}

.action-button.delete {
  background-color: #f44336;
  color: white;
}

.delete-selected-btn {
  margin-top: 4px;
  padding: 4px 8px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.searchable-select {
  position: relative;
  margin-top: 8px;
  display: flex;
  justify-content: center;
}

.select-input-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: auto;
}

.select-input {
  width: 161px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.add-option-button,
.delete-option-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s ease;
  background-color: #2196f3;
  color: white;
}

.add-option-button {
  background-color: #2196f3;
}

.delete-option-button {
  background-color: #f44336;
}

.add-option-button:hover {
  background-color: #1976d2;
}

.delete-option-button:hover {
  background-color: #e53935;
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin: 0 auto;
  width: 161px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.select-dropdown.editable .dropdown-option {
  padding-right: 30px;
}

.dropdown-option {
  padding: 6px 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dropdown-option:hover {
  background-color: #f0f0f0;
}

.delete-option-button {
  width: 20px;
  height: 20px;
  border: none;
  background-color: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-option-button:hover {
  color: #f44336;
}

.dropdown-empty {
  padding: 6px 8px;
  color: #999;
  text-align: center;
  font-size: 14px;
}

.editable {
  border-color: #2196f3;
  box-shadow: 0 0 0 1px rgba(33, 150, 243, 0.2);
}

.dropdown-actions {
  display: flex;
  gap: 4px;
  margin-left: 4px;
}

.dropdown-actions .action-button {
  width: 20px;
  height: 20px;
}
</style>