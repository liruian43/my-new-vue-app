<template>
  <div class="app-container">
    <h1>通用卡片组件测试页</h1>

    <div class="card-controls">
      <button class="test-button" @click="setIsTitleEditing(true)">
        启用标题编辑
      </button>
      <button class="test-button" @click="setIsTitleEditing(false)">
        禁用标题编辑
      </button>

      <button class="test-button" @click="setIsOptionsEditing(true)">
        启用选项编辑
      </button>
      <button class="test-button" @click="setIsOptionsEditing(false)">
        禁用选项编辑
      </button>

      <button class="test-button" @click="setEditableField('optionName', true)">
        启用选项名称编辑
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionName', false)"
      >
        禁用选项名称编辑
      </button>

      <button
        class="test-button"
        @click="setEditableField('optionValue', true)"
      >
        启用选项值编辑
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionValue', false)"
      >
        禁用选项值编辑
      </button>

      <button class="test-button" @click="setEditableField('optionUnit', true)">
        启用选项单位编辑
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionUnit', false)"
      >
        禁用选项单位编辑
      </button>

      <button
        class="test-button"
        @click="setEditableField('optionCheckbox', true)"
      >
        显示选项复选框
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionCheckbox', false)"
      >
        隐藏选项复选框
      </button>

      <button class="test-button" @click="enableSelectEditing">
        启用下拉菜单编辑
      </button>
      <button class="test-button" @click="disableSelectEditing">
        禁用下拉菜单编辑
      </button>
    </div>

    <UniversalCard
      v-model:modelValue="testData.title"
      v-model:options="testData.options"
      v-model:selectedValue="testData.selectedValue"
      :selectOptions="testData.selectOptions"
      :showDropdown="showDropdown"
      :isTitleEditing="isTitleEditing"
      :isOptionsEditing="isOptionsEditing"
      :isSelectEditing="isSelectEditing"
      :editableFields="editableFields"
      @add-option="handleAddOption"
      @delete-option="handleDeleteOption"
      @add-select-option="handleAddSelectOption"
      @delete-select-option="handleDeleteSelectOption"
      @dropdown-toggle="setShowDropdown"
    />
  </div>
</template>

<script>
import { ref } from "vue";
import UniversalCard from "./components/UniversalCard/UniversalCard.vue";

export default {
  name: "App",
  components: {
    UniversalCard,
  },
  setup() {
    const testData = ref({
      title: "默认标题",
      options: [
        { id: 1, name: "选项1", value: "100", unit: "元", checked: false },
        { id: 2, name: "选项2", value: "200", unit: "元", checked: false },
      ],
      selectOptions: [
        { id: 1, label: "选项A" },
        { id: 2, label: "选项B" },
        { id: 3, label: "选项C" },
      ],
      selectedValue: "选项A",
    });

    const isTitleEditing = ref(false);
    const isOptionsEditing = ref(false);
    const isSelectEditing = ref(false);
    const showDropdown = ref(false);

    const editableFields = ref({
      optionName: true,
      optionValue: true,
      optionUnit: true,
      select: true,
      optionCheckbox: true,
      optionActions: true,
    });

    const handleAddOption = (afterId) => {
      const newId = Date.now();
      const newOption = {
        id: newId,
        name: "新选项",
        value: "",
        unit: "",
        checked: false,
      };

      if (!afterId) {
        testData.value.options.push(newOption);
      } else {
        const index = testData.value.options.findIndex((o) => o.id === afterId);
        testData.value.options.splice(index + 1, 0, newOption);
      }
    };

    const handleDeleteOption = (optionId) => {
      testData.value.options = testData.value.options.filter(
        (option) => option.id !== optionId
      );
    };

    const handleAddSelectOption = (label) => {
      const newId = Date.now();
      testData.value.selectOptions.push({ id: newId, label });
    };

    const handleDeleteSelectOption = (optionId) => {
      testData.value.selectOptions = testData.value.selectOptions.filter(
        (option) => option.id !== optionId
      );
    };

    const setIsTitleEditing = (value) => {
      isTitleEditing.value = value;
    };

    const setIsOptionsEditing = (value) => {
      isOptionsEditing.value = value;
    };

    const setEditableField = (field, value) => {
      editableFields.value[field] = value;
    };

    const enableSelectEditing = () => {
      isSelectEditing.value = true;
      editableFields.value.select = true;
    };

    const disableSelectEditing = () => {
      isSelectEditing.value = false;
      editableFields.value.select = false;
    };

    const setShowDropdown = (value) => {
      showDropdown.value = value;
    };

    return {
      testData,
      isTitleEditing,
      isOptionsEditing,
      isSelectEditing,
      showDropdown,
      editableFields,
      handleAddOption,
      handleDeleteOption,
      handleAddSelectOption,
      handleDeleteSelectOption,
      setIsTitleEditing,
      setIsOptionsEditing,
      setEditableField,
      enableSelectEditing,
      disableSelectEditing,
      setShowDropdown,
    };
  },
};
</script>

<style>
.app-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.card-controls {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.test-button {
  margin: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
}
</style>
