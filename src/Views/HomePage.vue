<template>
  <div class="home-page" @click="handleContainerClick">
    <!-- 加载状态指示 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">加载中...</div>
    </div>
    
    <!-- 错误提示 -->
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- 正常内容 -->
    <div v-else>
      <!-- 顶部控制按钮 -->
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

      <!-- 卡片列表 -->
      <div class="cards-container">
        <div
          v-for="card in cards"
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
            <button class="delete-card-button" @click.stop="confirmDeleteCard(card.id)">×</button>
          </div>
        </div>
      </div>

      <!-- 数据管理部分 -->
      <div class="data-management-section">
        <h3 class="section-title">数据管理</h3>
        
        <div class="data-controls">
          <div class="storage-type-selector">
            <label>存储类型: </label>
            <select v-model="storageType" @change="changeStorageType">
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useCardStore } from '../components/Data/store';
import UniversalCard from '../components/UniversalCard/UniversalCard.vue';

const cardStore = useCardStore();
const loading = ref(true);
const error = ref(null);

// 从store获取状态
const cards = computed(() => cardStore.cards);
const selectedCardId = computed({
  get: () => cardStore.selectedCardId,
  set: (value) => cardStore.selectedCardId = value
});
const deletingCardId = computed({
  get: () => cardStore.deletingCardId,
  set: (value) => cardStore.deletingCardId = value
});
const storageType = computed({
  get: () => cardStore.storageType,
  set: (value) => cardStore.changeStorageType(value)
});
const selectedCard = computed(() => cardStore.selectedCard);
const dataPreview = computed(() => cardStore.dataPreview);
const viewMode = computed({
  get: () => cardStore.viewMode,
  set: (value) => cardStore.setViewMode(value)
});

// 初始化
onMounted(() => {
  loadAllData().finally(() => {
    loading.value = false;
  });
});

// 添加卡片
const addCard = () => {
  cardStore.addCard({
    data: {
      title: `新卡片 ${cards.value.length + 1}`,
      options: [{ id: 1, name: "新选项", value: "", unit: "", checked: false }],
      selectOptions: [{ id: 1, label: "新选项" }],
      selectedValue: "",
    }
  });
};

// 选择卡片
const selectCard = (id) => {
  selectedCardId.value = id;
  deletingCardId.value = null;
};

// 准备删除卡片
const prepareDeleteCard = () => {
  if (selectedCardId.value) {
    deletingCardId.value = selectedCardId.value;
  }
};

// 确认删除卡片
const confirmDeleteCard = (id) => {
  cardStore.deleteCard(id);
};

// 切换标题编辑状态
const toggleTitleEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleTitleEditing(selectedCardId.value);
  }
};

// 切换选项编辑状态
const toggleOptionsEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleOptionsEditing(selectedCardId.value);
  }
};

// 切换下拉菜单编辑状态
const toggleSelectEditing = () => {
  if (selectedCardId.value) {
    cardStore.toggleSelectEditing(selectedCardId.value);
  }
};

// 切换可编辑字段
const toggleEditableField = (field) => {
  if (selectedCardId.value) {
    cardStore.toggleEditableField(selectedCardId.value, field);
  }
};

// 添加选项
const handleAddOption = (cardId, afterId) => {
  cardStore.addOption(cardId, afterId);
};

// 删除选项
const handleDeleteOption = (cardId, optionId) => {
  cardStore.deleteOption(cardId, optionId);
};

// 添加下拉选项
const handleAddSelectOption = (cardId, label) => {
  cardStore.addSelectOption(cardId, label);
};

// 删除下拉选项
const handleDeleteSelectOption = (cardId, optionId) => {
  cardStore.deleteSelectOption(cardId, optionId);
};

// 设置下拉菜单显示状态
const setShowDropdown = (cardId, value) => {
  cardStore.setShowDropdown(cardId, value);
};

// 处理容器点击
const handleContainerClick = (event) => {
  const isButtonClick = event.target.closest('.test-button') !== null;
  const isCardControlsClick = event.target.closest('.card-controls') !== null;
  if (!isButtonClick && !isCardControlsClick) {
    selectedCardId.value = null;
    deletingCardId.value = null;
  }
};

// 保存所有数据
const saveAllData = () => {
  try {
    cardStore.saveCardsToLocal();
    alert('数据已保存到本地存储');
  } catch (error) {
    alert('保存数据失败: ' + error.message);
  }
};

// 加载所有数据
const loadAllData = async () => {
  try {
    await cardStore.loadCardsFromLocal();
    alert('数据已从本地存储加载');
    
    // 如果没有数据，添加一个默认卡片
    if (cards.value.length === 0) {
      addCard();
    }
  } catch (err) {
    error.value = '加载数据失败: ' + err.message;
    alert('加载数据失败: ' + err.message);
    console.error('加载数据失败:', err);
    
    // 如果加载失败，添加一个默认卡片
    addCard();
  }
};

// 导出数据
const exportData = () => {
  cardStore.exportData();
};

// 导入数据
const importData = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    await cardStore.importData(file);
    alert('数据导入成功');
    event.target.value = '';
  } catch (error) {
    alert('导入数据失败: ' + error.message);
  }
};

// 清空所有数据
const clearAllData = () => {
  if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
    cardStore.clearAllData();
    alert('数据已清空');
  }
};
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

/* 新增的加载状态样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  font-size: 24px;
  color: #333;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-message {
  padding: 20px;
  background-color: #ffebee;
  color: #b71c1c;
  border-radius: 4px;
  margin: 20px;
  text-align: center;
  font-size: 16px;
}
</style>