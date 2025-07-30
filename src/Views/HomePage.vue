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
          @delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
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

    <div class="data-management-section">
      <h3 class="section-title">数据管理</h3>
      
      <div class="data-controls">
        <div class="storage-type-selector">
          <label>存储类型: </label>
          <select v-model="selectedStorageType" @change="changeStorageType">
            <option value="local">LocalStorage</option>
            <option value="session">SessionStorage</option>
            <option value="memory">内存存储</option>
          </select>
        </div>
        
        <div class="data-actions">
          <button class="data-button" @click="saveAllData">保存所有数据</button>
          <button class="data-button" @click="loadAllData">加载所有数据</button>
          <button class="data-button" @click="exportData">导出数据</button>
          <label class="data-button" for="file-import">
            导入数据
            <input id="file-import" type="file" @change="importData" accept=".json" class="file-input" />
          </label>
          <button class="data-button" @click="clearAllData">清空所有数据</button>
        </div>
      </div>
      
      <div class="data-viewer">
        <div class="data-viewer-header">
          <h4>数据查看器</h4>
          <div class="data-viewer-controls">
            <button class="view-mode-button" 
                    :class="{ active: viewMode === 'tree' }"
                    @click="viewMode = 'tree'">树状视图</button>
            <button class="view-mode-button" 
                    :class="{ active: viewMode === 'json' }"
                    @click="viewMode = 'json'">JSON视图</button>
          </div>
        </div>
        
        <div class="data-content">
          <div v-if="viewMode === 'tree'">
            <div class="tree-view">
              <div class="tree-node" v-for="(card, index) in dataPreview" :key="index">
                <div class="tree-node-header">
                  <span class="tree-node-key">卡片 {{ card.id }}</span>
                  <span class="tree-node-type">Object</span>
                </div>
                <div class="nested-node">
                  <div class="tree-node-header">
                    <span class="tree-node-key">title</span>
                    <span class="tree-node-type">String</span>
                  </div>
                  <div class="tree-node-value">
                    {{ card.data.title }}
                  </div>
                </div>
                <div class="nested-node">
                  <div class="tree-node-header">
                    <span class="tree-node-key">options</span>
                    <span class="tree-node-type">Array</span>
                  </div>
                  <div v-for="(option, optIndex) in card.data.options" :key="optIndex" class="nested-node">
                    <div class="tree-node-header">
                      <span class="tree-node-key">选项 {{ option.id }}</span>
                      <span class="tree-node-type">Object</span>
                    </div>
                    <div class="nested-node">
                      <div class="tree-node-header">
                        <span class="tree-node-key">name</span>
                        <span class="tree-node-type">String</span>
                      </div>
                      <div class="tree-node-value">
                        {{ option.name }}
                      </div>
                    </div>
                    <div class="nested-node">
                      <div class="tree-node-header">
                        <span class="tree-node-key">value</span>
                        <span class="tree-node-type">String</span>
                      </div>
                      <div class="tree-node-value">
                        {{ option.value }}
                      </div>
                    </div>
                    <div class="nested-node">
                      <div class="tree-node-header">
                        <span class="tree-node-key">unit</span>
                        <span class="tree-node-type">String</span>
                      </div>
                      <div class="tree-node-value">
                        {{ option.unit }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="nested-node">
                  <div class="tree-node-header">
                    <span class="tree-node-key">selectOptions</span>
                    <span class="tree-node-type">Array</span>
                  </div>
                  <div v-for="(select, selIndex) in card.data.selectOptions" :key="selIndex" class="nested-node">
                    <div class="tree-node-header">
                      <span class="tree-node-key">下拉选项 {{ select.id }}</span>
                      <span class="tree-node-type">Object</span>
                    </div>
                    <div class="nested-node">
                      <div class="tree-node-header">
                        <span class="tree-node-key">label</span>
                        <span class="tree-node-type">String</span>
                      </div>
                      <div class="tree-node-value">
                        {{ select.label }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else>
            <pre class="json-view">{{ JSON.stringify(dataPreview, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import UniversalCard from "../components/UniversalCard/UniversalCard.vue";
import { useRouter } from "vue-router";
import DataManager, { 
  DATA_TYPES, 
  LocalStorageStrategy, 
  SessionStorageStrategy, 
  MemoryStorage 
} from "../components/Data/manager.js";

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

DataManager.registerData('cards', appData.value.cards, DATA_TYPES.ARRAY, { autoSave: true });

const selectedCardId = ref(null);
const deletingCardId = ref(null);
const router = useRouter();
const selectedStorageType = ref('local');
const viewMode = ref('tree');

const selectedCard = computed(() => {
  return appData.value.cards.find((card) => card.id === selectedCardId.value);
});

const dataPreview = computed(() => {
  return DataManager.getData('cards')?.value || [];
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

const saveAllData = async () => {
  try {
    await DataManager.saveData('cards');
    alert('数据已保存');
  } catch (error) {
    alert('保存数据失败: ' + error.message);
  }
};

const loadAllData = async () => {
  try {
    const loadedData = await DataManager.loadData('cards', DATA_TYPES.ARRAY);
    appData.value.cards = loadedData;
    alert('数据已加载');
  } catch (error) {
    alert('加载数据失败: ' + error.message);
  }
};

const exportData = async () => {
  await DataManager.exportData('cards', 'card_data.json');
};

const importData = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    await DataManager.importData('cards', file);
    appData.value.cards = DataManager.getData('cards');
    alert('数据导入成功');
    event.target.value = '';
  } catch (error) {
    alert('导入数据失败: ' + error.message);
  }
};

const clearAllData = () => {
  if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
    DataManager.deleteData('cards');
    appData.value.cards = [];
    alert('数据已清空');
  }
};

const changeStorageType = () => {
  let newStorage;
  
  switch (selectedStorageType.value) {
    case 'local':
      newStorage = new LocalStorageStrategy();
      break;
    case 'session':
      newStorage = new SessionStorageStrategy();
      break;
    case 'memory':
      newStorage = new MemoryStorage();
      break;
  }
  
  DataManager.storage = newStorage;
  alert('存储类型已更改');
};

const isObjectOrArray = (value) => {
  return value !== null && typeof value === 'object';
};

const getValueType = (value) => {
  if (Array.isArray(value)) return 'Array';
  if (value === null) return 'Null';
  return typeof value;
};

const formatValue = (value) => {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') return JSON.stringify(value);
  return value.toString();
};

onMounted(() => {
  console.log("HomePage.vue 已挂载");
  loadAllData();
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

.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

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

.data-management-section {
  margin-top: 40px;
  padding: 20px;
  border-top: 1px solid #ddd;
}

.section-title {
  margin-top: 0;
  color: #333;
  font-size: 1.5rem;
  text-align: center;
}

.data-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.storage-type-selector {
  display: flex;
  align-items: center;
}

.storage-type-selector label {
  margin-right: 10px;
  font-weight: bold;
}

.storage-type-selector select {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.data-actions {
  display: flex;
  gap: 10px;
}

.data-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #2196f3;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.data-button:hover {
  background-color: #0b7dda;
}

.file-input {
  display: none;
}

.data-viewer {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.data-viewer-header {
  padding: 10px 15px;
  background-color: #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ddd;
}

.data-viewer-header h4 {
  margin: 0;
}

.data-viewer-controls {
  display: flex;
}

.view-mode-button {
  padding: 5px 10px;
  border: 1px solid #ddd;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.view-mode-button.active {
  background-color: #e0e0e0;
}

.view-mode-button:first-child {
  border-radius: 4px 0 0 4px;
}

.view-mode-button:last-child {
  border-radius: 0 4px 4px 0;
}

.data-content {
  padding: 15px;
  max-height: 300px;
  overflow-y: auto;
}

.tree-view {
  font-family: monospace;
}

.tree-node {
  margin-bottom: 10px;
  padding-left: 15px;
  border-left: 1px dashed #ddd;
}

.tree-node-header {
  display: flex;
  gap: 10px;
  margin-bottom: 5px;
}

.tree-node-key {
  font-weight: bold;
  color: #333;
}

.tree-node-type {
  color: #888;
  font-size: 0.9em;
}

.nested-node {
  margin-left: 20px;
  margin-bottom: 5px;
}

.json-view {
  font-family: monospace;
  white-space: pre-wrap;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
}
</style>  