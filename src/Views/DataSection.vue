<template>
  <div class="data-section">
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
</template>

<script setup>
import { computed } from 'vue';
import { useCardStore } from '../components/Data/store';

const cardStore = useCardStore();

// 从store获取状态
const storageType = computed({
  get: () => cardStore.storageType,
  set: (value) => cardStore.changeStorageType(value)
});
const dataPreview = computed(() => cardStore.dataPreview);
const viewMode = computed({
  get: () => cardStore.viewMode,
  set: (value) => cardStore.setViewMode(value)
});

// 更改存储类型
const changeStorageType = () => {
  cardStore.changeStorageType(storageType.value);
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
  } catch (err) {
    alert('加载数据失败: ' + err.message);
    console.error('加载数据失败:', err);
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

<style scoped>
.data-section {
  margin-top: 20px;
}

.data-management-section {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
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