<template>
  <div class="data-management">
    <!-- 顶部工具栏 -->
    <div class="data-controls">
      <button class="data-button import" @click="triggerImport">导入数据</button>
      <button class="data-button export" @click="store.exportData">导出数据</button>
      <button 
        class="data-button manager" 
        @click="store.toggleManager"
        :class="{ active: store.isManager }"
      >
        {{ store.isManager ? '退出管理' : '数据管理' }}
      </button>
      <button class="data-button clear" @click="store.clearFilters">清除筛选</button>
    </div>
    
    <!-- 筛选栏 -->
    <div class="filter-section">
      <div class="filter-group">
        <span class="filter-label">数据类型:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: store.filterType === 'all' }]" @click="store.filterType = 'all'">全部</button>
          <button :class="['filter-option', 'question', { active: store.filterType === 'question' }]" @click="store.filterType = 'question'">资料题库</button>
          <button :class="['filter-option', 'root', { active: store.filterType === 'root' }]" @click="store.filterType = 'root'">主模式</button>
          <button :class="['filter-option', 'other-mode', { active: store.filterType === 'other-mode' }]" @click="store.filterType = 'other-mode'">其他模式</button>
          <button :class="['filter-option', 'config', { active: store.filterType === 'config' }]" @click="store.filterType = 'config'">环境配置</button>
        </div>
      </div>

      <div class="filter-group" v-if="store.isRootMode">
        <span class="filter-label">同步状态:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: store.syncFilter === 'all' }]" @click="store.syncFilter = 'all'">全部</button>
          <button :class="['filter-option', 'synced', { active: store.syncFilter === 'synced' }]" @click="store.syncFilter = 'synced'">已同步</button>
          <button :class="['filter-option', 'unsynced', { active: store.syncFilter === 'unsynced' }]" @click="store.syncFilter = 'unsynced'">未同步</button>
          <button :class="['filter-option', 'conflict', { active: store.syncFilter === 'conflict' }]" @click="store.syncFilter = 'conflict'">冲突</button>
        </div>
      </div>
    </div>
    
    <!-- 管理操作栏 -->
    <div v-if="store.isManager" class="management-section">
      <div class="selection-info">
        <label>
          <input type="checkbox" v-model="store.selectAll" @change="store.handleSelectAll">
          全选 (已选: {{ store.selectedCount }})
        </label>
      </div>
      <div class="management-actions">
        <button class="data-button delete" @click="store.deleteSelected" :disabled="!store.selectedCount || store.hasModeDataSelected">
          删除选中
        </button>
      </div>
    </div>
    
    <!-- 预览数据提示 -->
    <div v-if="store.hasPreview" class="preview-section">
      <span class="preview-info">
        预览数据: 共 {{ store.previewData.totalCount }} 条 
        (环境配置: {{ store.previewData.configs.length }}, 资料题库: {{ store.previewData.questions.length }})
      </span>
      <div class="preview-actions">
        <button class="data-button apply" @click="store.applyPreview">应用预览</button>
        <button class="data-button cancel" @click="store.cancelPreview">取消预览</button>
        <button class="data-button switch" @click="store.isPreview = !store.isPreview">
          {{ store.isPreview ? '查看原始数据' : '查看预览数据' }}
        </button>
      </div>
    </div>
    
    <!-- Excel风格表格 -->
    <div class="excel-table-container">
      <!-- 表头 -->
      <div class="excel-header-row">
        <div class="excel-cell checkbox-col" v-if="store.isManager">
          <span>选</span>
        </div>
        <div class="excel-cell id-col">ID</div>
        <div class="excel-cell type-col">类型</div>
        <div class="excel-cell sync-col" v-if="store.isRootMode">同步状态</div>
        <div class="excel-cell summary-col">内容摘要</div>
        <div class="excel-cell mode-col">所属模式</div>
        <div class="excel-cell actions-col">操作</div>
      </div>

      <!-- 表格内容 -->
      <div class="excel-body">
        <div 
          v-for="(item, index) in store.filteredData" 
          :key="index" 
          class="excel-row"
          :class="{ 'even-row': index % 2 === 1 }"
          :title="store.generateTooltip(item)"
        >
          <!-- 复选框列 -->
          <div class="excel-cell checkbox-col" v-if="store.isManager">
            <input 
              type="checkbox" 
              v-model="item.selected" 
              @change="store.updateSelected"
              :disabled="store.isModeData(item)"
            >
          </div>
          
          <!-- ID列 -->
          <div class="excel-cell id-col">{{ item.id }}</div>
          
          <!-- 类型列 -->
          <div class="excel-cell type-col">{{ item.typeText }}</div>
          
          <!-- 同步状态列 -->
          <div class="excel-cell sync-col" v-if="store.isRootMode">
            <span :class="store.getSyncClass(item.syncStatus)">{{ store.getSyncText(item.syncStatus) }}</span>
          </div>
          
          <!-- 内容摘要列 -->
          <div class="excel-cell summary-col">{{ item.summary || '无数据' }}</div>
          
          <!-- 所属模式列 -->
          <div class="excel-cell mode-col" :class="store.getModeClass(item)">
            {{ item.modeId }}
          </div>
          
          <!-- 操作列 -->
          <div class="excel-cell actions-col">
            <button 
              class="action-btn delete" 
              @click="store.deleteItem(item)" 
              v-if="!store.isPreview && !store.isModeData(item)"
            >
              删除
            </button>
            <button 
              class="action-btn edit" 
              @click="editItem(item)" 
              v-if="!store.isPreview && !store.isModeData(item) && store.canEditItem(item)"
            >
              编辑
            </button>
          </div>
        </div>

        <div class="empty-state" v-if="store.filteredData.length === 0">
          <p>{{ store.isPreview ? '没有预览数据' : '没有符合条件的数据' }}</p>
        </div>
      </div>
    </div>
    
    <input type="file" ref="fileInput" class="hidden" @change="handleImport" accept=".json">
  </div>
</template>

<script setup>
import { ref, onMounted, inject, watch } from 'vue';
import { useDataSectionStore } from '../components/Data/store/DataSectionStore';

// 注入和初始化
const store = useDataSectionStore();
const router = inject('router');
const fileInput = ref(null);

// 初始化数据
async function initialize() {
  await store.initialize();
}

onMounted(() => {
  initialize();
});

// 编辑数据
function editItem(item) {
  if (item.dataType === 'question') {
    router.push(`/edit-question/${item.id}`);
  } else if (item.dataType === 'config') {
    router.push(`/edit-config/${item.id}`);
  }
}

// 导入数据
function triggerImport() {
  if (fileInput.value) fileInput.value.click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    await store.importDataFromFile(file);
  } catch (err) {
    alert(err.message);
  }
  e.target.value = '';
}

// 监听筛选条件变化，更新选中状态
watch([() => store.filterType, () => store.syncFilter, () => store.isPreview], () => {
  store.updateSelected();
});
</script>

<style scoped>
/* 样式保持不变 */
.data-management {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.data-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.data-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 14px;
}

.data-button.import {
  background-color: #4CAF50;
  color: white;
}

.data-button.export {
  background-color: #2196F3;
  color: white;
}

.data-button.manager {
  background-color: #ff9800;
  color: white;
}

.data-button.manager.active {
  background-color: #e65100;
}

.data-button.clear {
  background-color: #f5f5f5;
  color: #333;
}

.data-button.delete {
  background-color: #f44336;
  color: white;
}

.data-button.delete:disabled {
  background-color: #ffcccc;
  cursor: not-allowed;
}

.data-button.apply {
  background-color: #4CAF50;
  color: white;
}

.data-button.cancel {
  background-color: #f44336;
  color: white;
}

.data-button.switch {
  background-color: #2196F3;
  color: white;
}

.filter-section {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.filter-group {
  margin-bottom: 10px;
}

.filter-label {
  display: inline-block;
  margin-right: 10px;
  font-weight: bold;
  color: #555;
}

.filter-options {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-option {
  padding: 4px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 13px;
}

.filter-option.active {
  background-color: #2196F3;
  color: white;
  border-color: #2196F3;
}

.management-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 15px;
}

.selection-info {
  font-size: 14px;
}

.preview-section {
  background-color: #fff8e1;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-info {
  color: #ff8f00;
  font-size: 14px;
}

.preview-actions {
  display: flex;
  gap: 10px;
}

.excel-table-container {
  font-family: "Segoe UI", Arial, sans-serif;
  margin-top: 10px;
  max-height: 600px;
  overflow: hidden;
}

.excel-header-row {
  display: flex;
  font-weight: bold;
  background-color: #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 10;
  white-space: nowrap;
}

.excel-body {
  overflow-y: auto;
  max-height: calc(600px - 36px);
}

.excel-row {
  display: flex;
  white-space: nowrap;
  padding: 2px 0;
}

.even-row {
  background-color: #f9f9f9;
}

.excel-cell {
  padding: 6px 12px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.checkbox-col {
  width: 50px;
  text-align: center;
}

.id-col {
  width: 100px;
}

.type-col {
  width: 100px;
}

.sync-col {
  width: 100px;
}

.summary-col {
  min-width: 300px;
  width: 300px;
}

.mode-col {
  width: 120px;
}

.actions-col {
  width: 120px;
  text-align: center;
}

.sync-synced {
  color: #28a745;
}

.sync-unsynced {
  color: #ffc107;
}

.sync-conflict {
  color: #dc3545;
}

.mode-root {
  color: #dc3545;
  font-weight: bold;
}

.mode-other {
  color: #007bff;
}

.mode-current {
  background-color: #e3f2fd;
}

.action-btn {
  padding: 4px 8px;
  margin: 0 3px;
  border: 1px solid #ddd;
  border-radius: 2px;
  background-color: white;
  cursor: pointer;
  font-size: 12px;
}

.action-btn.delete {
  color: #dc3545;
}

.action-btn.edit {
  color: #28a745;
}

.action-btn:hover {
  background-color: #f0f0f0;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.hidden {
  display: none;
}

.excel-body::-webkit-scrollbar {
  width: 8px;
}

.excel-body::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.excel-body::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.excel-body::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
</style>
