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
        <button class="add-first-option" @click="emitAddOption(null)">
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
            v-if="editableFields.optionActions && editableFields.optionName"
            type="text"
            v-model="option.name"
            @input="updateOption(option.id, { name: option.name })"
            class="option-name-input"
          />
          <span v-else class="option-name">{{ option.name || "未命名" }}</span>

          <input
            v-if="editableFields.optionActions && editableFields.optionValue"
            type="text"
            v-model="option.value"
            @input="updateOption(option.id, { value: option.value || null })"
            class="option-value-input"
          />
          <span v-else class="option-value">{{ option.value ?? "-" }}</span>

          <input
            v-if="editableFields.optionActions && editableFields.optionUnit"
            type="text"
            v-model="option.unit"
            @input="updateOption(option.id, { unit: option.unit || null })"
            class="option-unit-input"
          />
          <span v-else class="option-unit">{{ option.unit ?? "-" }}</span>

          <div v-if="editableFields.optionActions" class="option-actions">
            <button @click="emitAddOption(option.id)" class="action-button add">
              +
            </button>
            <button
              @click="emitDeleteOption(option.id)"
              class="action-button delete"
              :disabled="localOptions.length <= 1"
            >
              -
            </button>
          </div>
        </div>
      </div>

      <div class="searchable-select">
        <div class="select-input-container">
          <input
            type="text"
            v-model="localSelectedValue"
            @input="updateSelectedValue(localSelectedValue)"
            @click="emitDropdownToggle(true)"
            @blur="handleBlur"
            :class="[
              'select-input',
              isSelectEditing && editableFields.select ? 'editable' : '',
            ]"
          />

          <div
            v-if="isSelectEditing && editableFields.select"
            class="dropdown-actions"
          >
            <button
              class="action-button add"
              @click="emitAddSelectOption"
              :disabled="!(localSelectedValue || '').trim()"
            >
              +
            </button>

            <button
              class="action-button delete"
              @click="emitDeleteSelectOption"
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
import { ref, computed, watch, onMounted } from "vue";

// 显式导入 defineProps 和 defineEmits 以兼容 Vue <3.3
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
    validator: (value) => {
      return value.every(
        (option) =>
          option &&
          typeof option === "object" &&
          "id" in option &&
          "name" in option
      );
    },
  },
  selectedValue: {
    type: String,
    default: "",
  },
  selectOptions: {
    type: Array,
    default: () => [],
    validator: (value) => {
      return value.every(
        (option) =>
          option &&
          typeof option === "object" &&
          "id" in option &&
          "label" in option
      );
    },
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
  editableFields: {
    type: Object,
    default: () => ({
      title: true,
      optionName: true,
      optionValue: true,
      optionUnit: true,
      optionCheckbox: true,
      select: true,
      optionActions: true,
    }),
    validator: (value) => {
      const validFields = [
        "title",
        "optionName",
        "optionValue",
        "optionUnit",
        "optionCheckbox",
        "select",
        "optionActions",
      ];
      return Object.keys(value).every((key) => validFields.includes(key));
    },
  },
});

const emit = defineEmits([
  "update:modelValue",
  "update:options",
  "update:selectedValue",
  "add-option",
  "delete-option",
  "add-select-option",
  "delete-select-option",
  "dropdown-toggle",
]);

// 数据状态
const localModelValue = ref(props.modelValue);
const localOptions = ref([...props.options]);
const localSelectedValue = ref(props.selectedValue);
const titleInputRef = ref(null);

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

// 监听 props 变化
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
  },
  { deep: true }
);

watch(
  () => props.selectedValue,
  (newValue) => {
    localSelectedValue.value = newValue;
  }
);

// 方法
const updateTitle = (newTitle) => {
  localModelValue.value = newTitle;
  emit("update:modelValue", newTitle);
};

const updateOption = (optionId, changes) => {
  const index = localOptions.value.findIndex((o) => o.id === optionId);
  if (index !== -1) {
    localOptions.value[index] = { ...localOptions.value[index], ...changes };
    emit("update:options", [...localOptions.value]);
  }
};

const updateSelectedValue = (newValue) => {
  localSelectedValue.value = newValue;
  emit("update:selectedValue", newValue);
};

const selectOption = (option) => {
  updateSelectedValue(option.label);
  emitDropdownToggle(false);
};

const emitAddOption = (afterId) => {
  emit("add-option", afterId);
};

const emitDeleteOption = (optionId) => {
  emit("delete-option", optionId);
};

const emitAddSelectOption = () => {
  if ((localSelectedValue.value || "").trim()) {
    emit("add-select-option", localSelectedValue.value.trim());
    updateSelectedValue("");
  }
};

const emitDeleteSelectOption = () => {
  if (selectedOption.value) {
    emit("delete-select-option", selectedOption.value.id);
    updateSelectedValue("");
  }
};

const emitDropdownToggle = (value) => {
  emit("dropdown-toggle", value);
};

const handleBlur = () => {
  setTimeout(() => emitDropdownToggle(false), 200);
};

// 生命周期钩子
onMounted(() => {
  if (props.isTitleEditing && titleInputRef.value) {
    titleInputRef.value.focus();
  }
});
</script>

<style scoped>
.universal-card,
.card-title,
.card-title-input,
.card-content,
.options-list,
.option,
.empty-options,
.searchable-select,
.select-dropdown,
.dropdown-option {
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
  max-width: 240px;
  margin: 0 auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  background-color: #fff;
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
  white-space: nowrap;
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
