<template>
  <div class="home-page" @click="handleContainerClick">
    <div class="card-controls">
      <button class="test-button" @click="navigateToDataManagement">数据管理</button>
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
        @click="toggleTitleEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isTitleEditing }"
      >
        {{ selectedCard?.isTitleEditing ? "完成标题编辑" : "编辑标题" }}
      </button>

      <button
        class="test-button"
        @click="toggleOptionsEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isOptionsEditing }"
      >
        {{ selectedCard?.isOptionsEditing ? "完成选项编辑" : "编辑选项" }}
      </button>

      <button
        class="test-button"
        @click="toggleSelectEditing"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.isSelectEditing }"
      >
        {{ selectedCard?.isSelectEditing ? "完成下拉菜单编辑" : "编辑下拉菜单" }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionName')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionName }"
      >
        {{
          selectedCard?.editableFields.optionName ? "完成名称编辑" : "编辑选项名称"
        }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionValue')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionValue }"
      >
        {{
          selectedCard?.editableFields.optionValue ? "完成值编辑" : "编辑选项值"
        }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionUnit')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionUnit }"
      >
        {{
          selectedCard?.editableFields.optionUnit ? "完成单位编辑" : "编辑选项单位"
        }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionCheckbox')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionCheckbox }"
      >
        {{
          selectedCard?.editableFields.optionCheckbox ? "隐藏选项复选框" : "显示选项复选框"
        }}
      </button>

      <button
        class="test-button"
        @click="() => toggleEditableField('optionActions')"
        :disabled="!selectedCardId"
        :class="{ active: selectedCard?.editableFields.optionActions }"
      >
        {{
          selectedCard?.editableFields.optionActions ? "隐藏选项按钮" : "显示选项按钮"
        }}
      </button>
    </div>

    <div class="cards-container">
      <div
        v-for="card in appData.cards"
        :key="card.id"
        class="card-wrapper"
        :class="{ deleting: deletingCardId === card.id, selected: selectedCardId === card.id }"
        @click.stop="selectCard(card.id)"
      >
        <!-- 保持 selected 类绑定不变，完全不改动 UniversalCard 组件 -->
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
import { ref, computed, onMounted } from "vue";
import UniversalCard from "../components/UniversalCard/UniversalCard.vue";
import { useRouter } from "vue-router";

const appData = ref({
  cards: []
});

if (appData.value.cards.length === 0) {
  appData.value.cards = [
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
  ];
}

const selectedCardId = ref(null);
const deletingCardId = ref(null);
const router = useRouter();

const selectedCard = computed(() => {
  return appData.value.cards.find((card) => card.id === selectedCardId.value);
});

const addCard = () => {
  const newId = Date.now();
  const newCard = {
    id: newId,
    data: {
      title: `新卡片 ${appData.value.cards.length + 1}`,
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
    const index = appData.value.cards.findIndex(
      (card) => card.id === selectedCardId.value
    );
    appData.value.cards.splice(index, 0, newCard);
  } else {
    appData.value.cards.push(newCard);
  }

  selectedCardId.value = newId;
};

const selectCard = (id) => {
  selectedCardId.value = id;
  deletingCardId.value = null;
};

const prepareDeleteCard = () => {
  if (selectedCardId.value) {
    deletingCardId.value = selectedCardId.value;
  }
};

const confirmDeleteCard = (id) => {
  appData.value.cards = appData.value.cards.filter((card) => card.id !== id);
  deletingCardId.value = null;
  selectedCardId.value = null;
};

const toggleTitleEditing = () => {
  if (selectedCard.value) {
    selectedCard.value.isTitleEditing = !selectedCard.value.isTitleEditing;
  }
};

const toggleOptionsEditing = () => {
  if (selectedCard.value) {
    selectedCard.value.isOptionsEditing = !selectedCard.value.isOptionsEditing;
  }
};

const toggleSelectEditing = () => {
  if (selectedCard.value) {
    selectedCard.value.isSelectEditing = !selectedCard.value.isSelectEditing;
  }
};

const toggleEditableField = (field) => {
  if (selectedCard.value) {
    selectedCard.value.editableFields[field] =
      !selectedCard.value.editableFields[field];
  }
};

const handleAddOption = (cardId, afterId) => {
  const cardIndex = appData.value.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const newId = Date.now();
  const newOption = {
    id: newId,
    name: "新选项",
    value: "",
    unit: "",
    checked: false,
  };

  const card = appData.value.cards[cardIndex];
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
  const cardIndex = appData.value.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const card = appData.value.cards[cardIndex];
  card.data.options = card.data.options.filter((option) => option.id !== optionId);
};

const handleAddSelectOption = (cardId, label) => {
  const cardIndex = appData.value.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const newId = Date.now();
  const card = appData.value.cards[cardIndex];
  card.data.selectOptions = [...card.data.selectOptions, { id: newId, label }];
};

const handleDeleteSelectOption = (cardId, optionId) => {
  const cardIndex = appData.value.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const card = appData.value.cards[cardIndex];
  card.data.selectOptions = card.data.selectOptions.filter((option) => option.id !== optionId);
};

const setShowDropdown = (cardId, value) => {
  const card = appData.value.cards.find((c) => c.id === cardId);
  if (card) {
    card.showDropdown = value;
  }
};

const navigateToDataManagement = () => {
  router.push('/data-management');
};

const handleContainerClick = (event) => {
  const isButtonClick = event.target.closest('.test-button') !== null;
  const isCardControlsClick = event.target.closest('.card-controls') !== null;
  if (!isButtonClick && !isCardControlsClick) {
    selectedCardId.value = null;
    deletingCardId.value = null;
  }
};

onMounted(() => {
  console.log("HomePage.vue 已挂载");
});
</script>

<style>
.card-controls {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
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

.test-button.active {
  background-color: #2196f3;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
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

/* 修改这里的 CSS 选择器 - 关键修改 */
.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

/* 保留删除效果的样式 - 这个似乎工作正常 */
.card-wrapper.deleting .universal-card {
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
  opacity: 0.9;
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
</style>