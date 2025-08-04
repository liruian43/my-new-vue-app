<template>
  <div class="data-management">
    <!-- 顶部工具栏 -->
    <div class="data-controls">
      <button class="data-button import" @click="triggerImport">
        导入数据
      </button>
      <button class="data-button export" @click="exportData">
        导出数据
      </button>
      <button 
        class="data-button manager" 
        @click="toggleManager"
        :class="{ active: isManager }"
      >
        {{ isManager ? '退出管理' : '数据管理' }}
      </button>
      <button class="data-button clear" @click="clearFilters">
        清除筛选
      </button>
    </div>
    
    <!-- 筛选栏 -->
    <div class="filter-section">
      <!-- 数据类型筛选 -->
      <div class="filter-group">
        <span class="filter-label">数据类型:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: filterType === 'all' }]" @click="filterType = 'all'">全部</button>
          <button :class="['filter-option', 'root', { active: filterType === 'root' }]" @click="filterType = 'root'">主模式</button>
          <button :class="['filter-option', 'template', { active: filterType === 'template' }]" @click="filterType = 'template'">模板</button>
          <button :class="['filter-option', 'current', { active: filterType === 'current' }]" @click="filterType = 'current'">当前模式</button>
          <button :class="['filter-option', 'other', { active: filterType === 'other' }]" @click="filterType = 'other'">其他</button>
        </div>
      </div>

      <!-- 数据级别筛选 -->
      <div class="filter-group">
        <span class="filter-label">数据级别:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: levelFilter === 'all' }]" @click="levelFilter = 'all'">全部</button>
          <button :class="['filter-option', 'long', { active: levelFilter === 'long' }]" @click="levelFilter = 'long'">长期</button>
          <button :class="['filter-option', 'medium', { active: levelFilter === 'medium' }]" @click="levelFilter = 'medium'">中期</button>
          <button :class="['filter-option', 'session', { active: levelFilter === 'session' }]" @click="levelFilter = 'session'">会话</button>
          <button :class="['filter-option', 'temp', { active: levelFilter === 'temp' }]" @click="levelFilter = 'temp'">临时</button>
        </div>
      </div>

      <!-- 同步状态筛选 -->
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
          全选 ({{ selectedCount }})
        </label>
      </div>
      <div class="management-actions">
        <button class="data-button delete" @click="deleteSelected" :disabled="!selectedCount">
          删除选中
        </button>
      </div>
    </div>
    
    <!-- 预览数据提示 -->
    <div v-if="hasPreview" class="preview-section">
      <span class="preview-info">预览数据: {{ previewData.length }} 条</span>
      <div class="preview-actions">
        <button class="data-button apply" @click="applyPreview">应用预览</button>
        <button class="data-button cancel" @click="cancelPreview">取消预览</button>
        <button class="data-button switch" @click="isPreview = !isPreview">
          {{ isPreview ? '查看原始数据' : '查看预览数据' }}
        </button>
      </div>
    </div>
    
    <!-- 数据表格 -->
    <div class="data-table-container">
      <!-- 表头 -->
      <div class="table-header">
        <div class="table-cell checkbox" v-if="isManager">
          <span class="cell-header"></span>
        </div>
        <div class="table-cell id">
          <span class="cell-header">ID</span>
        </div>
        <div class="table-cell type">
          <span class="cell-header">类型</span>
        </div>
        <div class="table-cell level">
          <span class="cell-header">级别</span>
        </div>
        <div class="table-cell sync-status" v-if="isRootMode">
          <span class="cell-header">同步状态</span>
        </div>
        <div class="table-cell summary">
          <span class="cell-header">内容摘要</span>
        </div>
        <div class="table-cell mode">
          <span class="cell-header">所属模式</span>
        </div>
        <div class="table-cell actions">
          <span class="cell-header">操作</span>
        </div>
      </div>

      <!-- 表格内容区 -->
      <div class="table-content">
        <!-- 数据行 -->
        <div 
          v-for="(item, index) in filteredData" 
          :key="index" 
          class="table-row"
          :title="getItemTooltip(item)"
        >
          <div class="table-cell checkbox" v-if="isManager">
            <input type="checkbox" v-model="item.selected" @change="updateSelected">
          </div>
          <div class="table-cell id">{{ item.id }}</div>
          <div class="table-cell type">{{ item.type }}</div>
          <div class="table-cell level" :class="`level-bg-${item.dataLevel}`">
            {{ getLevelText(item.dataLevel) }}
          </div>
          <div class="table-cell sync-status" v-if="isRootMode">
            {{ getSyncText(item.syncStatus) }}
          </div>
          <div class="table-cell summary">{{ item.summary }}</div>
          <div class="table-cell mode" :class="getModeClass(item)">
            {{ item.modeId }}
          </div>
          <div class="table-cell actions">
            <button class="action-btn delete" @click="deleteItem(item)" v-if="!isPreview">删除</button>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="empty-state" v-if="filteredData.length === 0">
          <p>{{ isPreview ? '没有预览数据' : '没有符合条件的数据' }}</p>
        </div>
      </div>
    </div>
    
    <!-- 隐藏的文件输入 -->
    <input type="file" ref="fileInput" class="hidden" @change="handleImport" accept=".json">
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useCardStore } from '../components/Data/store';

// 核心状态
const cardStore = useCardStore();
const isManager = ref(false);        // 管理模式开关
const filterType = ref('all');       // 数据类型筛选
const levelFilter = ref('all');      // 数据级别筛选
const syncFilter = ref('all');       // 同步状态筛选
const isPreview = ref(false);        // 是否查看预览数据
const previewData = ref([]);         // 预览数据
const selectAll = ref(false);        // 全选状态
const selectedCount = ref(0);        // 选中数量

// 判断是否为主模式
const isRootMode = computed(() => {
  return cardStore.currentModeId === 'root_admin';
});

// 计算属性 - 整合所有级别数据
const allData = computed(() => {
  // 整合所有存储级别的数据
  const tempData = (cardStore.tempCards || []).map(item => ({
    ...item,
    type: 'card',
    dataLevel: 'temp',
    rawData: item,
    timestamp: item.id
  }));
  
  const sessionData = (cardStore.sessionCards || []).map(item => ({
    ...item,
    type: 'card',
    dataLevel: 'session',
    rawData: item,
    timestamp: item.addedToSessionAt ? new Date(item.addedToSessionAt).getTime() : item.id
  }));
  
  const mediumData = (cardStore.mediumCards || []).map(item => ({
    ...item,
    type: 'card',
    dataLevel: 'medium',
    rawData: item,
    timestamp: item.storedAt ? new Date(item.storedAt).getTime() : item.id
  }));
  
  // 合并所有数据并按时间排序
  return [...tempData, ...sessionData, ...mediumData]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(formatDataItem);
});

// 筛选后的数据
const filteredData = computed(() => {
  const sourceData = isPreview.value ? previewData.value : allData.value;
  let result = [...sourceData];
  
  // 应用类型筛选
  if (filterType.value === 'root') {
    result = result.filter(item => item.modeId === 'root_admin');
  } else if (filterType.value === 'template') {
    result = result.filter(item => item.isTemplate);
  } else if (filterType.value === 'current') {
    result = result.filter(item => item.modeId === cardStore.currentModeId);
  } else if (filterType.value === 'other') {
    result = result.filter(item => 
      item.modeId !== 'root_admin' && 
      !item.isTemplate && 
      item.modeId !== cardStore.currentModeId
    );
  }
  
  // 应用级别筛选
  if (levelFilter.value !== 'all') {
    result = result.filter(item => item.dataLevel === levelFilter.value);
  }
  
  // 应用同步状态筛选
  if (isRootMode.value && syncFilter.value !== 'all') {
    result = result.filter(item => item.syncStatus === syncFilter.value);
  }
  
  return result;
});

// 辅助计算属性
const hasPreview = computed(() => previewData.value.length > 0);

// 工具函数 - 格式化数据项，确保摘要显示不全时带省略号
function formatDataItem(item) {
  let summary = '';
  if (item.type === 'card') {
    summary = item.data?.title || '未命名卡片';
    summary += ` (选项: ${item.optionCount || 0})`;
  } else if (item.type === 'mode') {
    summary = item.data?.name || '未命名模式';
  } else {
    // 限制摘要长度，超出部分用省略号
    const rawSummary = JSON.stringify(item.data);
    summary = rawSummary.length > 50 ? rawSummary.substring(0, 50) + '...' : rawSummary;
  }
  
  return {
    ...item,
    summary,
    selected: false,
    syncStatus: item.syncStatus || 'unsynced'
  };
}

// 获取悬停提示文本（简介）
function getItemTooltip(item) {
  // 显示更详细的简介，但不是完整数据
  const details = [];
  details.push(`ID: ${item.id}`);
  details.push(`类型: ${item.type}`);
  details.push(`级别: ${getLevelText(item.dataLevel)}`);
  if (isRootMode.value) {
    details.push(`同步状态: ${getSyncText(item.syncStatus)}`);
  }
  details.push(`所属模式: ${item.modeId}`);
  
  // 卡片类型显示额外信息
  if (item.type === 'card' && item.data) {
    if (item.data.title) details.push(`标题: ${item.data.title}`);
    if (item.data.options && item.data.options.length) {
      details.push(`选项数量: ${item.data.options.length}`);
    }
  }
  
  return details.join(' | ');
}

// 获取模式文字颜色类
function getModeClass(item) {
  if (item.modeId === 'root_admin') return 'mode-root';
  if (item.isTemplate) return 'mode-template';
  if (item.modeId === cardStore.currentModeId) return 'mode-current';
  return 'mode-other';
}

// 获取级别文本
function getLevelText(level) {
  const levelMap = {
    long: '长期',
    medium: '中期',
    session: '会话',
    temp: '临时'
  };
  return levelMap[level] || '未知';
}

// 获取同步状态文本
function getSyncText(status) {
  const syncMap = {
    synced: '已同步',
    unsynced: '未同步',
    conflict: '冲突'
  };
  return syncMap[status] || '未知';
}

// 选择相关逻辑
function updateSelected() {
  const count = filteredData.value.filter(item => item.selected).length;
  selectedCount.value = count;
  selectAll.value = count > 0 && count === filteredData.value.length;
}

function handleSelectAll() {
  filteredData.value.forEach(item => {
    item.selected = selectAll.value;
  });
  updateSelected();
}

// 数据操作 - 仅保留删除功能
function deleteItem(item) {
  if (confirm(`确定要删除 ${item.id} 吗？`)) {
    if (item.dataLevel === 'temp') {
      cardStore.deleteTempCard(item.id);
    } else if (item.dataLevel === 'session') {
      cardStore.deleteSessionCard(item.id);
    } else {
      cardStore.removeFromMedium([item.id]);
    }
  }
}

function deleteSelected() {
  if (selectedCount.value === 0) return;
  
  if (confirm(`确定要删除选中的 ${selectedCount.value} 条数据吗？`)) {
    filteredData.value.forEach(item => {
      if (item.selected) {
        if (item.dataLevel === 'temp') {
          cardStore.deleteTempCard(item.id);
        } else if (item.dataLevel === 'session') {
          cardStore.deleteSessionCard(item.id);
        } else {
          cardStore.removeFromMedium([item.id]);
        }
      }
    });
    selectAll.value = false;
    updateSelected();
  }
}

// 导入导出功能
function triggerImport() {
  const fileInput = document.querySelector('.hidden');
  if (fileInput) fileInput.click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const content = await file.text();
    const data = JSON.parse(content);
    previewData.value = data.map(formatDataItem);
    isPreview.value = true;
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
  e.target.value = '';
}

function exportData() {
  try {
    cardStore.exportData();
  } catch (err) {
    alert('导出失败: ' + err.message);
  }
}

// 预览数据处理
function applyPreview() {
  if (previewData.value.length > 0) {
    cardStore.importData(previewData.value);
    previewData.value = [];
    isPreview.value = false;
    alert('预览数据已应用');
  }
}

function cancelPreview() {
  previewData.value = [];
  isPreview.value = false;
}

// 管理模式切换
function toggleManager() {
  isManager.value = !isManager.value;
  if (!isManager.value) {
    filteredData.value.forEach(item => {
      item.selected = false;
    });
    selectAll.value = false;
    selectedCount.value = 0;
  }
}

// 清除筛选条件
function clearFilters() {
  filterType.value = 'all';
  levelFilter.value = 'all';
  syncFilter.value = 'all';
}

// 监听筛选条件变化
watch([filterType, levelFilter, syncFilter, isPreview], updateSelected);
</script>

<style scoped>
/* 主容器样式 */
.data-management {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

/* 控制按钮栏 */
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

/* 按钮样式 */
.data-button.import {
  background-color: #42b983;
  color: white;
}

.data-button.export {
  background-color: #2196f3;
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
  background-color: #9e9e9e;
  color: white;
}

.data-button.delete {
  background-color: #e74c3c;
  color: white;
}

.data-button.apply {
  background-color: #42b983;
  color: white;
}

.data-button.cancel {
  background-color: #9e9e9e;
  color: white;
}

.data-button.switch {
  background-color: #2196f3;
  color: white;
}

.data-button.close {
  background-color: #9e9e9e;
  color: white;
  padding: 5px 10px;
  font-size: 13px;
}

.data-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 筛选区域 */
.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  color: #444;
  white-space: nowrap;
}

.filter-options {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.filter-option {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-option.active {
  background-color: #e0e0e0;
  border-color: #bbb;
  font-weight: 500;
}

.filter-option.root.active {
  background-color: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}

.filter-option.template.active {
  background-color: #fff3e0;
  border-color: #ff9800;
  color: #e65100;
}

.filter-option.current.active {
  background-color: #e3f2fd;
  border-color: #2196f3;
  color: #1565c0;
}

.filter-option.long.active {
  background-color: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}

.filter-option.medium.active {
  background-color: #e3f2fd;
  border-color: #2196f3;
  color: #1565c0;
}

.filter-option.session.active {
  background-color: #fff3e0;
  border-color: #ff9800;
  color: #e65100;
}

.filter-option.temp.active {
  background-color: #ffebee;
  border-color: #f44336;
  color: #d32f2f;
}

.filter-option.synced.active {
  background-color: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}

.filter-option.unsynced.active {
  background-color: #fff3e0;
  border-color: #ff9800;
  color: #e65100;
}

.filter-option.conflict.active {
  background-color: #ffebee;
  border-color: #f44336;
  color: #d32f2f;
}

/* 管理操作区 */
.management-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  flex-wrap: wrap;
  gap: 10px;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
}

.management-actions {
  display: flex;
  gap: 10px;
}

/* 预览数据区 */
.preview-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 15px;
  background-color: #fff3cd;
  border-radius: 4px;
  color: #856404;
  flex-wrap: wrap;
  gap: 10px;
}

.preview-info {
  font-size: 14px;
}

.preview-actions {
  display: flex;
  gap: 10px;
}

/* 表格容器 */
.data-table-container {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

/* 表头样式 */
.table-header {
  display: flex;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 500;
}

/* 表格内容区 */
.table-content {
  overflow-y: auto;
  max-height: 500px;
  flex-grow: 1;
}

/* 表格行样式 */
.table-row {
  display: flex;
  border-bottom: 1px solid #f1f3f5;
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: #f9f9f9;
}

/* 单元格样式 */
.table-cell {
  padding: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  border-right: 1px solid #f1f3f5;
}

.table-cell:last-child {
  border-right: none;
}

.cell-header {
  color: #555;
}

/* 单元格宽度分配 */
.table-cell.checkbox {
  width: 50px;
  text-align: center;
}

.table-cell.id {
  width: 100px;
}

.table-cell.type {
  width: 100px;
}

.table-cell.level {
  width: 100px;
  font-weight: 500;
}

.table-cell.sync-status {
  width: 120px;
}

.table-cell.summary {
  flex-grow: 1;
  min-width: 200px;
}

.table-cell.mode {
  width: 150px;
  font-weight: 500;
}

.table-cell.actions {
  width: 80px;
  display: flex;
  gap: 5px;
  justify-content: center;
}

/* 操作按钮 */
.action-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 3px;
  font-size: 13px;
  cursor: pointer;
}

.action-btn.delete {
  background-color: #ffebee;
  color: #d32f2f;
}

/* 存储级别背景色 */
.level-bg-long {
  background-color: #e8f5e9;
  color: #333;
}

.level-bg-medium {
  background-color: #e3f2fd;
  color: #333;
}

.level-bg-session {
  background-color: #fff3e0;
  color: #333;
}

.level-bg-temp {
  background-color: #ffebee;
  color: #333;
}

/* 模式字体颜色 */
.mode-root {
  color: #2e7d32;
}

.mode-template {
  color: #e65100;
}

.mode-current {
  color: #1565c0;
}

.mode-other {
  color: #616161;
}

/* 空状态 */
.empty-state {
  padding: 30px;
  text-align: center;
  color: #888;
  font-style: italic;
  border-bottom: 1px solid #f1f3f5;
}

/* 隐藏元素 */
.hidden {
  display: none;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .filter-section, .data-controls, .management-section, .preview-section {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .filter-options {
    flex-grow: 1;
    width: 100%;
  }
  
  .table-cell {
    font-size: 13px;
    padding: 8px 5px;
  }
  
  .table-cell.id, .table-cell.type, .table-cell.level,
  .table-cell.sync-status {
    min-width: 70px;
  }
}
</style>
    