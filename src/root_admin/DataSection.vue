<template>
  <div class="data-management">
    <!-- 顶部工具栏 - 按钮禁用 -->
    <div class="data-controls">
      <button class="data-button import" @click.prevent>导入数据</button>
      <button class="data-button export" @click.prevent>导出数据</button>
      <button 
        class="data-button manager" 
        @click.prevent
        :class="{ active: isManager }"
      >
        {{ isManager ? '退出管理' : '数据管理' }}
      </button>
      <button class="data-button clear" @click.prevent>清除筛选</button>
    </div>
    
    <!-- 筛选栏 - 筛选选项禁用 -->
    <div class="filter-section">
      <div class="filter-group">
        <span class="filter-label">数据类型:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: filterType === 'all' }]" @click.prevent>全部</button>
          <button :class="['filter-option', 'question', { active: filterType === 'question' }]" @click.prevent>资料题库</button>
          <button :class="['filter-option', 'root', { active: filterType === 'root' }]" @click.prevent>主模式</button>
          <button :class="['filter-option', 'other-mode', { active: filterType === 'other-mode' }]" @click.prevent>其他模式</button>
          <button :class="['filter-option', 'config', { active: filterType === 'config' }]" @click.prevent>环境配置</button>
        </div>
      </div>

      <div class="filter-group" v-if="isRootMode">
        <span class="filter-label">同步状态:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: syncFilter === 'all' }]" @click.prevent>全部</button>
          <button :class="['filter-option', 'synced', { active: syncFilter === 'synced' }]" @click.prevent>已同步</button>
          <button :class="['filter-option', 'unsynced', { active: syncFilter === 'unsynced' }]" @click.prevent>未同步</button>
          <button :class="['filter-option', 'conflict', { active: syncFilter === 'conflict' }]" @click.prevent>冲突</button>
        </div>
      </div>
    </div>
    
    <!-- 管理操作栏 - 保持显示但功能禁用 -->
    <div v-if="isManager" class="management-section">
      <div class="selection-info">
        <label>
          <input type="checkbox" v-model="selectAll" @change.prevent>
          全选 (已选: {{ selectedCount }})
        </label>
      </div>
      <div class="management-actions">
        <button class="data-button delete" @click.prevent :disabled="true">
          删除选中
        </button>
      </div>
    </div>
    
    <!-- 预览数据提示 - 保持显示但功能禁用 -->
    <div v-if="hasPreview" class="preview-section">
      <span class="preview-info">
        预览数据: 共 {{ previewTotalCount }} 条 
        (环境配置: {{ previewConfigsCount }}, 资料题库: {{ previewQuestionsCount }})
      </span>
      <div class="preview-actions">
        <button class="data-button apply" @click.prevent>应用预览</button>
        <button class="data-button cancel" @click.prevent>取消预览</button>
        <button class="data-button switch" @click.prevent>
          {{ isPreview ? '查看原始数据' : '查看预览数据' }}
        </button>
      </div>
    </div>
    
    <!-- Excel风格表格 - 保持显示但交互禁用 -->
    <div class="excel-table-container">
      <!-- 表头 -->
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

      <!-- 表格内容 - 使用静态数据展示 -->
      <div class="excel-body">
        <div 
          v-for="(item, index) in staticData" 
          :key="index" 
          class="excel-row"
          :class="{ 'even-row': index % 2 === 1 }"
          :title="item.tooltip"
        >
          <!-- 复选框列 - 禁用状态 -->
          <div class="excel-cell checkbox-col" v-if="isManager">
            <input 
              type="checkbox" 
              :checked="false" 
              disabled
            >
          </div>
          
          <!-- ID列 -->
          <div class="excel-cell id-col">{{ item.id }}</div>
          
          <!-- 类型列 -->
          <div class="excel-cell type-col">{{ item.typeText }}</div>
          
          <!-- 同步状态列 -->
          <div class="excel-cell sync-col" v-if="isRootMode">
            <span :class="item.syncClass">{{ item.syncText }}</span>
          </div>
          
          <!-- 内容摘要列 -->
          <div class="excel-cell summary-col">{{ item.summary || '无数据' }}</div>
          
          <!-- 所属模式列 -->
          <div class="excel-cell mode-col" :class="item.modeClass">
            {{ item.modeId }}
          </div>
          
          <!-- 操作列 - 按钮禁用 -->
          <div class="excel-cell actions-col">
            <button 
              class="action-btn delete" 
              @click.prevent
              disabled
            >
              删除
            </button>
            <button 
              class="action-btn edit" 
              @click.prevent
              disabled
            >
              编辑
            </button>
          </div>
        </div>

        <div class="empty-state" v-if="staticData.length === 0">
          <p>数据功能已禁用</p>
        </div>
      </div>
    </div>
    
    <!-- 隐藏文件输入 -->
    <input type="file" ref="fileInput" class="hidden" accept=".json">
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 静态状态变量 - 替代store中的状态
const isManager = ref(false);
const filterType = ref('all');
const syncFilter = ref('all');
const isRootMode = ref(true);
const selectAll = ref(false);
const selectedCount = ref(0);
const hasPreview = ref(false);
const previewTotalCount = ref(0);
const previewConfigsCount = ref(0);
const previewQuestionsCount = ref(0);
const isPreview = ref(false);

// 静态数据 - 用于展示表格结构
const staticData = ref([
  {
    id: 'root_admin',
    typeText: '主模式',
    syncStatus: 'synced',
    syncClass: 'sync-synced',
    syncText: '已同步',
    summary: '系统主模式，包含所有源数据',
    modeId: 'root_admin',
    modeClass: 'mode-root',
    tooltip: '主模式数据'
  },
  {
    id: 'conf_001',
    typeText: '环境配置',
    syncStatus: 'synced',
    syncClass: 'sync-synced',
    syncText: '已同步',
    summary: '系统基础配置信息',
    modeId: 'root_admin',
    modeClass: 'mode-root',
    tooltip: '环境配置数据'
  },
  {
    id: 'q_001',
    typeText: '资料题库',
    syncStatus: 'synced',
    syncClass: 'sync-synced',
    syncText: '已同步',
    summary: '基础资料信息示例',
    modeId: 'root_admin',
    modeClass: 'mode-root',
    tooltip: '题库数据'
  }
]);

const fileInput = ref(null);

// 空函数 - 替代原有功能方法
function initialize() {}
function editItem() {}
function triggerImport() {}
function handleImport() {}

onMounted(() => {
  // 不执行任何初始化操作
});
</script>

<style scoped>
/* 保持原有样式不变 */
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
  cursor: not-allowed; /* 禁用状态光标 */
  transition: background-color 0.3s;
  font-size: 14px;
  opacity: 0.7; /* 视觉上区分禁用状态 */
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
  cursor: not-allowed; /* 禁用状态光标 */
  font-size: 13px;
  opacity: 0.7;
}

.filter-option.active {
  background-color: #2196F3;
  color: white;
  border-color: #2196F3;
  opacity: 0.8;
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
  cursor: not-allowed;
  font-size: 12px;
  opacity: 0.7;
}

.action-btn.delete {
  color: #dc3545;
}

.action-btn.edit {
  color: #28a745;
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
    