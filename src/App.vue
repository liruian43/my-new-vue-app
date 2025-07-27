<template>
  <div class="app-container" @click="handleContainerClick">
    <h1>通用卡片组件测试页</h1>

    <div class="card-controls">
      <button class="test-button" @click="addCard">添加卡片</button>
      <button
        class="test-button"
        @click="prepareDeleteCard"
        :disabled="!selectedCardId"
      >
        删除卡片
      </button>

      <button
        class="test-button"
        @click="setIsTitleEditing(true)"
        :disabled="!selectedCardId"
      >
        启用标题编辑
      </button>
      <button
        class="test-button"
        @click="setIsTitleEditing(false)"
        :disabled="!selectedCardId"
      >
        禁用标题编辑
      </button>

      <button
        class="test-button"
        @click="setIsOptionsEditing(true)"
        :disabled="!selectedCardId"
      >
        启用选项编辑
      </button>
      <button
        class="test-button"
        @click="setIsOptionsEditing(false)"
        :disabled="!selectedCardId"
      >
        禁用选项编辑
      </button>

      <button
        class="test-button"
        @click="setEditableField('optionName', true)"
        :disabled="!selectedCardId"
      >
        启用选项名称编辑
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionName', false)"
        :disabled="!selectedCardId"
      >
        禁用选项名称编辑
      </button>

      <button
        class="test-button"
        @click="setEditableField('optionValue', true)"
        :disabled="!selectedCardId"
      >
        启用选项值编辑
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionValue', false)"
        :disabled="!selectedCardId"
      >
        禁用选项值编辑
      </button>

      <button
        class="test-button"
        @click="setEditableField('optionUnit', true)"
        :disabled="!selectedCardId"
      >
        启用选项单位编辑
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionUnit', false)"
        :disabled="!selectedCardId"
      >
        禁用选项单位编辑
      </button>

      <button
        class="test-button"
        @click="setEditableField('optionCheckbox', true)"
        :disabled="!selectedCardId"
      >
        显示选项复选框
      </button>
      <button
        class="test-button"
        @click="setEditableField('optionCheckbox', false)"
        :disabled="!selectedCardId"
      >
        隐藏选项复选框
      </button>

      <button
        class="test-button"
        @click="enableSelectEditing"
        :disabled="!selectedCardId"
      >
        启用下拉菜单编辑
      </button>
      <button
        class="test-button"
        @click="disableSelectEditing"
        :disabled="!selectedCardId"
      >
        禁用下拉菜单编辑
      </button>

      <button
        class="test-button"
        @click="showOptionActions"
        :disabled="!selectedCardId"
      >
        显示选项增减按钮
      </button>
      <button
        class="test-button"
        @click="hideOptionActions"
        :disabled="!selectedCardId"
      >
        隐藏选项增减按钮
      </button>
    </div>

    <div class="cards-container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card-wrapper"
        :class="{ deleting: deletingCardId === card.id }"
        @click.stop="selectCard(card.id)"
      >
        <UniversalCard
          v-model:modelValue="card.data.title"
          v-model:options="card.data.options"
          v-model:selectedValue="card.data.selectedValue"
          :selectOptions="card.data.selectOptions"
          :showDropdown="card.showDropdown"
          :isTitleEditing="card.isTitleEditing"
          :isOptionsEditing="card.isOptionsEditing"
          :isSelectEditing="card.isSelectEditing"
          :editableFields="card.editableFields"
          @add-option="(afterId) => handleAddOption(card.id, afterId)"
          @delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
          @add-select-option="(label) => handleAddSelectOption(card.id, label)"
          @delete-select-option="
            (optionId) => handleDeleteSelectOption(card.id, optionId)
          "
          @dropdown-toggle="(value) => setShowDropdown(card.id, value)"
          :class="{ selected: selectedCardId === card.id }"
        />

        <div v-if="deletingCardId === card.id" class="delete-overlay">
          <button
            class="delete-card-button"
            @click.stop="confirmDeleteCard(card.id)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import UniversalCard from "./components/UniversalCard/UniversalCard.vue";

const cards = ref([
  {
    id: 1,
    data: {
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
    },
    showDropdown: false,
    isTitleEditing: false,
    isOptionsEditing: false,
    isSelectEditing: false,
    editableFields: {
      optionName: true,
      optionValue: true,
      optionUnit: true,
      optionCheckbox: true,
      optionActions: true,
      select: true,
    },
  },
]);

const selectedCardId = ref(null);
const deletingCardId = ref(null);

const addCard = () => {
  const newId = Date.now();
  const newCard = {
    id: newId,
    data: {
      title: `新卡片 ${cards.value.length + 1}`,
      options: [{ id: 1, name: "新选项", value: "", unit: "", checked: false }],
      selectOptions: [{ id: 1, label: "新选项" }],
      selectedValue: "",
    },
    showDropdown: false,
    isTitleEditing: false,
    isOptionsEditing: false,
    isSelectEditing: false,
    editableFields: {
      optionName: true,
      optionValue: true,
      optionUnit: true,
      optionCheckbox: true,
      optionActions: true,
      select: true,
    },
  };

  if (selectedCardId.value) {
    const index = cards.value.findIndex(
      (card) => card.id === selectedCardId.value
    );
    cards.value.splice(index, 0, newCard);
  } else {
    cards.value.push(newCard);
  }

  selectedCardId.value = newId;
};

const selectCard = (id) => {
  selectedCardId.value = id;
  deletingCardId.value = null;
};

const handleContainerClick = () => {
  selectedCardId.value = null;
  deletingCardId.value = null;
};

const prepareDeleteCard = () => {
  if (selectedCardId.value) {
    deletingCardId.value = selectedCardId.value;
  }
};

const confirmDeleteCard = (id) => {
  cards.value = cards.value.filter((card) => card.id !== id);
  deletingCardId.value = null;
  selectedCardId.value = null;
};

const getSelectedCard = () => {
  return cards.value.find((card) => card.id === selectedCardId.value);
};

const setIsTitleEditing = (value) => {
  const card = getSelectedCard();
  if (card) card.isTitleEditing = value;
};

const setIsOptionsEditing = (value) => {
  const card = getSelectedCard();
  if (card) card.isOptionsEditing = value;
};

const setIsSelectEditing = (value) => {
  const card = getSelectedCard();
  if (card) card.isSelectEditing = value;
};

const setEditableField = (field, value) => {
  const card = getSelectedCard();
  if (card) card.editableFields[field] = value;
};

const enableSelectEditing = () => {
  setIsSelectEditing(true);
};

const disableSelectEditing = () => {
  setIsSelectEditing(false);
};

const showOptionActions = () => {
  setEditableField("optionActions", true);
};

const hideOptionActions = () => {
  setEditableField("optionActions", false);
};

// 以下方法保持不变
const handleAddOption = (cardId, afterId) => {
  const cardIndex = cards.value.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const newId = Date.now();
  const newOption = {
    id: newId,
    name: "新选项",
    value: "",
    unit: "",
    checked: false,
  };

  const card = cards.value[cardIndex];
  const options = [...card.data.options];

  if (!afterId) {
    options.push(newOption);
  } else {
    const index = options.findIndex((o) => o.id === afterId);
    if (index !== -1) {
      options.splice(index + 1, 0, newOption);
    }
  }

  card.data.options = options;
};

const handleDeleteOption = (cardId, optionId) => {
  const cardIndex = cards.value.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const card = cards.value[cardIndex];
  card.data.options = card.data.options.filter(
    (option) => option.id !== optionId
  );
};

const handleAddSelectOption = (cardId, label) => {
  const cardIndex = cards.value.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const newId = Date.now();
  const card = cards.value[cardIndex];
  card.data.selectOptions = [...card.data.selectOptions, { id: newId, label }];
};

const handleDeleteSelectOption = (cardId, optionId) => {
  const cardIndex = cards.value.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const card = cards.value[cardIndex];
  card.data.selectOptions = card.data.selectOptions.filter(
    (option) => option.id !== optionId
  );
};

const setShowDropdown = (cardId, value) => {
  const card = cards.value.find((c) => c.id === cardId);
  if (card) {
    card.showDropdown = value;
  }
};
</script>

<style>
.app-container {
  padding: 20px;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
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

.cards-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.card-wrapper {
  position: relative;
  width: 240px;
}

.card-wrapper.selected .universal-card {
  box-shadow: 0 0 0 3px #4caf50;
}

.card-wrapper.deleting .universal-card {
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
  opacity: 0.9;
}

.card-wrapper .universal-card.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

.delete-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 0, 0, 0.1);
  border-radius: inherit;
  display: flex;
  justify-content: flex-end;
  padding: 10px;
}

.delete-card-button {
  width: 30px;
  height: 30px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>
