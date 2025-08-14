<template>
  <div class="data-management">
    <!-- 顶部工具栏 - 保持原样不修改 -->
    <div class="data-controls">
      <button class="data-button import" @click="triggerImport">导入数据</button>
      <button class="data-button export" @click="exportData">导出数据</button>
      <button 
        class="data-button manager" 
        @click="toggleManager"
        :class="{ active: isManager }"
      >
        {{ isManager ? '退出管理' : '数据管理' }}
      </button>
      <button class="data-button clear" @click="clearFilters">清除筛选</button>
    </div>
    
    <!-- 筛选栏 - 保持原样不修改 -->
    <div class="filter-section">
      <div class="filter-group">
        <span class="filter-label">数据类型:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: filterType === 'all' }]" @click="filterType = 'all'">全部</button>
          <button :class="['filter-option', 'question', { active: filterType === 'question' }]" @click="filterType = 'question'">资料题库</button>
          <button :class="['filter-option', 'root', { active: filterType === 'root' }]" @click="filterType = 'root'">主模式</button>
          <button :class="['filter-option', 'other-mode', { active: filterType === 'other-mode' }]" @click="filterType = 'other-mode'">其他模式</button>
          <button :class="['filter-option', 'config', { active: filterType === 'config' }]" @click="filterType = 'config'">环境配置</button>
        </div>
      </div>

      <div class="filter-group" v-if="isRootMode">
        <span class="filter-label">同步状态:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: syncFilter === 'all' }]" @click="syncFilter = 'all'">全部</button>
          <button :class="['filter-option', 'synced', { active: syncFilter === 'synced' }]" @click="syncFilter = 'synced'">已同步</button>
          <button :class="['filter-option', 'unsynced', { active: syncFilter === 'unsynced' }]" @click="syncFilter = 'unsynced'">未同步</button>
          <button :class="['filter-option', 'conflict', { active: syncFilter === 'conflict' }]" @click="syncFilter = 'conflict'">冲突</button>
        </div>
      </div>
    </div>
    
    <!-- 管理操作栏 -->
    <div v-if="isManager" class="management-section">
      <div class="selection-info">
        <label>
          <input type="checkbox" v-model="selectAll" @change="handleSelectAll">
          全选 (已选: {{ selectedCount }})
        </label>
      </div>
      <div class="management-actions">
        <button class="data-button delete" @click="deleteSelected" :disabled="!selectedCount || hasModeDataSelected">
          删除选中
        </button>
      </div>
    </div>
    
    <!-- 预览数据提示 -->
    <div v-if="hasPreview" class="preview-section">
      <span class="preview-info">
        预览数据: 共 {{ previewData.totalCount }} 条 
        (环境配置: {{ previewData.configs.length }}, 资料题库: {{ previewData.questions.length }})
      </span>
      <div class="preview-actions">
        <button class="data-button apply" @click="applyPreview">应用预览</button>
        <button class="data-button cancel" @click="cancelPreview">取消预览</button>
        <button class="data-button switch" @click="isPreview = !isPreview">
          {{ isPreview ? '查看原始数据' : '查看预览数据' }}
        </button>
      </div>
    </div>
    
    <!-- Excel风格表格（无分隔线，空格分隔） -->
    <div class="excel-table-container">
      <!-- 表头 - 固定 -->
      <div class="excel-header-row">
        <div class="excel-cell checkbox-col" v-if="isManager">
          <span>选</span>
        </div>
        <div class="excel-cell id-col">ID</div>
        <div class="excel-cell type-col">类型</div>
        <div class="excel-cell sync-col" v-if="isRootMode">同步状态</div>
        <div class="excel-cell summary-col">内容摘要</div>
        <div class="excel-cell mode-col">所属模式</div>
        <div class="excel-cell actions-col">操作</div>
      </div>

      <!-- 表格内容 - 可滚动 -->
      <div class="excel-body">
        <div 
          v-for="(item, index) in filteredData" 
          :key="index" 
          class="excel-row"
          :class="{ 'even-row': index % 2 === 1 }"
          :title="getItemTooltip(item)"
        >
          <!-- 复选框列 - 预留位置 -->
          <div class="excel-cell checkbox-col" v-if="isManager">
            <input 
              type="checkbox" 
              v-model="item.selected" 
              @change="updateSelected"
              :disabled="isModeData(item)"
            >
          </div>
          
          <!-- ID列 -->
          <div class="excel-cell id-col">{{ item.id }}</div>
          
          <!-- 类型列 -->
          <div class="excel-cell type-col">{{ item.typeText }}</div>
          
          <!-- 同步状态列 -->
          <div class="excel-cell sync-col" v-if="isRootMode">
            <span :class="getSyncClass(item.syncStatus)">{{ getSyncText(item.syncStatus) }}</span>
          </div>
          
          <!-- 内容摘要列（自动省略） -->
          <div class="excel-cell summary-col">{{ item.summary || '无数据' }}</div>
          
          <!-- 所属模式列 -->
          <div class="excel-cell mode-col" :class="getModeClass(item)">
            {{ item.modeId }}
          </div>
          
          <!-- 操作列 -->
          <div class="excel-cell actions-col">
            <button 
              class="action-btn delete" 
              @click="deleteItem(item)" 
              v-if="!isPreview && !isModeData(item)"
            >
              删除
            </button>
            <button 
              class="action-btn edit" 
              @click="editItem(item)" 
              v-if="!isPreview && !isModeData(item) && canEditItem(item)"
            >
              编辑
            </button>
          </div>
        </div>

        <div class="empty-state" v-if="filteredData.length === 0">
          <p>{{ isPreview ? '没有预览数据' : '没有符合条件的数据' }}</p>
        </div>
      </div>
    </div>
    
    <input type="file" ref="fileInput" class="hidden" @change="handleImport" accept=".json">
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue';
import { useCardStore } from '../components/Data/store';
import DataManager from '../components/Data/manager';

// 注入和初始化
const store = useCardStore();
const router = inject('router');
const dataManager = new DataManager();

// 组件状态（仅UI相关）
const isManager = ref(false);
const filterType = ref('all');
const syncFilter = ref('all');
const isPreview = ref(false);
const previewData = ref({ configs: [], questions: [], totalCount: 0 });
const selectAll = ref(false);
const selectedCount = ref(0);

// 初始化数据
async function initialize() {
  await store.initialize();
}

onMounted(() => {
  initialize();
});

// 主模式判断
const isRootMode = computed(() => store.isRootMode);

// 整合数据：按时间戳倒序排列（最新的在上）
const allData = computed(() => {
  // 环境配置数据
  const configData = store.environmentConfigs.contextTemplates.map(item => ({
    id: item.questionId,
    dataType: 'config',
    typeText: '环境配置',
    summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
    modeId: store.currentModeId,
    syncStatus: store.getCardSyncStatus(item.questionId),
    timestamp: new Date(item.createdAt).getTime()
  }));
  
  // 题库数据
  const questionData = store.questionBank.questions.map(item => ({
    id: item.id,
    dataType: 'question',
    typeText: '资料题库',
    summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
    modeId: store.currentModeId,
    syncStatus: store.getCardSyncStatus(item.id),
    difficulty: item.difficulty,
    timestamp: new Date(item.createdAt).getTime()
  }));
  
  // 模式数据
  const modeData = [
    {
      id: 'root_admin',
      dataType: 'root',
      typeText: '主模式',
      summary: '系统主模式，包含所有源数据',
      modeId: 'root_admin',
      isModeData: true,
      timestamp: new Date().getTime()
    },
    ...store.modes.map(item => ({
      id: item.id,
      dataType: 'other-mode',
      typeText: '其他模式',
      summary: item.description || '用户创建的子模式',
      modeId: item.id,
      isModeData: true,
      timestamp: new Date().getTime() - (store.modes.indexOf(item) * 1000)
    }))
  ];
  
  // 按时间戳降序排序（最新的在上）
  return [...configData, ...questionData, ...modeData]
    .sort((a, b) => b.timestamp - a.timestamp);
});

// 筛选数据
const filteredData = computed(() => {
  const sourceData = isPreview.value 
    ? [...previewData.value.configs, ...previewData.value.questions].map(item => ({
        ...item,
        summary: item.content || item.questionId || '未命名数据',
        timestamp: item.timestamp || new Date().getTime()
      }))
    : allData.value;
  
  let result = [...sourceData];
  
  // 类型筛选
  if (filterType.value !== 'all') {
    result = result.filter(item => item.dataType === filterType.value);
  }
  
  // 同步状态筛选
  if (isRootMode.value && syncFilter.value !== 'all') {
    result = result.filter(item => 
      dataManager.checkSyncStatus(item.syncStatus, syncFilter.value)
    );
  }
  
  // 确保始终按时间排序
  return result.sort((a, b) => b.timestamp - a.timestamp);
});

// 辅助计算属性
const hasModeDataSelected = computed(() => 
  filteredData.value.some(item => item.selected && isModeData(item))
);
const hasPreview = computed(() => previewData.value.totalCount > 0);

// 工具方法
function isModeData(item) {
  return item.isModeData || item.dataType === 'root' || item.dataType === 'other-mode';
}

function getItemTooltip(item) {
  return dataManager.generateTooltip(item, isRootMode.value);
}

function getModeClass(item) {
  if (item.dataType === 'root') return 'mode-root';
  if (item.dataType === 'other-mode') return 'mode-other';
  if (item.modeId === store.currentModeId) return 'mode-current';
  return '';
}

function getSyncText(status) {
  return dataManager.getSyncText(status);
}

function getSyncClass(status) {
  switch(status) {
    case 'synced': return 'sync-synced';
    case 'unsynced': return 'sync-unsynced';
    case 'conflict': return 'sync-conflict';
    default: return '';
  }
}

function canEditItem(item) {
  if (item.dataType === 'question') {
    return store.currentMode.permissions.card.editOptions;
  }
  if (item.dataType === 'config') {
    return store.currentMode.permissions.data.save;
  }
  return false;
}

// 选择逻辑
function updateSelected() {
  const count = filteredData.value.filter(item => item.selected && !isModeData(item)).length;
  selectedCount.value = count;
  selectAll.value = count > 0 && count === filteredData.value.filter(item => !isModeData(item)).length;
}

function handleSelectAll() {
  filteredData.value.forEach(item => {
    if (!isModeData(item)) item.selected = selectAll.value;
  });
  updateSelected();
}

// 数据操作
function deleteItem(item) {
  if (isModeData(item)) return;
  
  if (confirm(`确定要删除 ${item.id || '该数据'} 吗？`)) {
    if (item.dataType === 'config') {
      store.environmentConfigs.contextTemplates = store.environmentConfigs.contextTemplates
        .filter(template => template.questionId !== item.id);
      store.saveEnvironmentConfigs(store.environmentConfigs);
    } else if (item.dataType === 'question') {
      store.removeQuestionFromBank(item.id);
    }
  }
}

function deleteSelected() {
  if (selectedCount.value === 0 || hasModeDataSelected.value) return;
  
  if (confirm(`确定要删除选中的 ${selectedCount.value} 条数据吗？`)) {
    filteredData.value.forEach(item => {
      if (item.selected && !isModeData(item)) {
        if (item.dataType === 'config') {
          store.environmentConfigs.contextTemplates = store.environmentConfigs.contextTemplates
            .filter(template => template.questionId !== item.id);
        } else if (item.dataType === 'question') {
          store.removeQuestionFromBank(item.id);
        }
      }
    });
    
    // 保存更改
    if (store.environmentConfigs.contextTemplates.length > 0) {
      store.saveEnvironmentConfigs(store.environmentConfigs);
    }
    
    selectAll.value = false;
    selectedCount.value = 0;
  }
}

// 编辑数据
function editItem(item) {
  if (item.dataType === 'question') {
    router.push(`/edit-question/${item.id}`);
  } else if (item.dataType === 'config') {
    router.push(`/edit-config/${item.id}`);
  }
}

// 导入导出
function triggerImport() {
  const input = document.querySelector('.hidden');
  if (input) input.click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const importedData = await dataManager.importFromFile(file);
    let configs = [];
    let questions = [];
    
    if (importedData.questions) {
      questions = importedData.questions.map(q => dataManager.normalizeQuestion(q));
    }
    
    if (importedData.contextTemplates) {
      configs = importedData.contextTemplates;
    }
    
    previewData.value = {
      configs,
      questions,
      totalCount: configs.length + questions.length
    };
    isPreview.value = true;
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
  e.target.value = '';
}

function exportData() {
  try {
    const exportData = {
      questions: store.questionBank.questions,
      contextTemplates: store.environmentConfigs.contextTemplates,
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-export-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出失败: ' + err.message);
  }
}

// 预览数据处理
function applyPreview() {
  if (previewData.value.totalCount === 0) return;
  
  if (previewData.value.questions.length > 0) {
    previewData.value.questions.forEach(question => {
      store.addQuestionToBank(question);
    });
  }
  
  if (previewData.value.configs.length > 0) {
    previewData.value.configs.forEach(config => {
      const index = store.environmentConfigs.contextTemplates
        .findIndex(t => t.questionId === config.questionId);
      
      if (index >= 0) {
        store.environmentConfigs.contextTemplates[index] = config;
      } else {
        store.environmentConfigs.contextTemplates.push(config);
      }
    });
    store.saveEnvironmentConfigs(store.environmentConfigs);
  }
  
  previewData.value = { configs: [], questions: [], totalCount: 0 };
  isPreview.value = false;
  alert(`已导入 ${previewData.value.questions.length} 条题目和 ${previewData.value.configs.length} 条环境配置`);
}

function cancelPreview() {
  previewData.value = { configs: [], questions: [], totalCount: 0 };
  isPreview.value = false;
}

// 管理模式切换
function toggleManager() {
  isManager.value = !isManager.value;
  if (!isManager.value) {
    filteredData.value.forEach(item => item.selected = false);
    selectAll.value = false;
    selectedCount.value = 0;
  }
}

function clearFilters() {
  filterType.value = 'all';
  syncFilter.value = 'all';
}

// 监听筛选条件变化
watch([filterType, syncFilter, isPreview], updateSelected);
</script>

<style scoped>
/* 保持原有容器宽度不变 */
.data-management {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  /* 不改变原有宽度 */
}

/* 顶部工具栏保持原样 */
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

/* 筛选栏保持原样 */
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

/* 管理栏样式 */
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

/* 预览栏样式 */
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

/* Excel风格表格 - 核心修改部分 */
.excel-table-container {
  font-family: "Segoe UI", Arial, sans-serif;
  margin-top: 10px;
  max-height: 600px;
  overflow: hidden;
}

/* 表头行 */
.excel-header-row {
  display: flex;
  font-weight: bold;
  background-color: #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 10;
  white-space: nowrap;
}

/* 内容区域 - 可滚动 */
.excel-body {
  overflow-y: auto;
  max-height: calc(600px - 36px); /* 减去表头高度 */
}

/* 数据行 */
.excel-row {
  display: flex;
  white-space: nowrap;
  padding: 2px 0;
}

/* 交替行背景色 - Excel风格 */
.even-row {
  background-color: #f9f9f9;
}

/* 单元格样式 - 无分隔线，用空格和固定宽度分隔 */
.excel-cell {
  padding: 6px 12px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 关键：去掉所有边框，用固定宽度和空格分隔 */
}

/* 列宽设置 - 确保内容对齐 */
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

/* 同步状态样式 */
.sync-synced {
  color: #28a745;
}

.sync-unsynced {
  color: #ffc107;
}

.sync-conflict {
  color: #dc3545;
}

/* 模式样式 */
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

/* 操作按钮 */
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

/* 空状态 */
.empty-state {
  padding: 40px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

/* 隐藏文件输入 */
.hidden {
  display: none;
}

/* 滚动条美化 */
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
