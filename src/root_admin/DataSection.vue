<template>
  <div class="data-management">
    <!-- 顶部工具栏 -->
    <div class="data-controls">
      <button class="data-button import" @click="triggerImport">导入数据</button>
      <button class="data-button export" @click="exportData">导出数据</button>
      <button class="data-button" @click="scanLocalStorage">刷新数据</button>
      <button 
        class="data-button manager" 
        @click="toggleManager"
        :class="{ active: isManager }"
      >
        {{ isManager ? '退出管理' : '数据管理' }}
      </button>
      <button class="data-button clear" @click="clearSelection" v-if="selectedCount > 0">清除筛选</button>
    </div>
    
    <!-- 筛选栏 -->
    <div class="filter-section">
      <div class="filter-group">
        <span class="filter-label">数据类型:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: filterType === 'all' }]" @click="setFilterType('all')">全部</button>
          <button :class="['filter-option', 'question', { active: filterType === 'question' }]" @click="setFilterType('question')">题库</button>
          <button :class="['filter-option', 'env', { active: filterType === 'env' }]" @click="setFilterType('env')">全量区</button>
          <button :class="['filter-option', 'answers', { active: filterType === 'answers' }]" @click="setFilterType('answers')">回答</button>
          <button :class="['filter-option', 'root', { active: filterType === 'root' }]" @click="setFilterType('root')">主模式</button>
          <button :class="['filter-option', 'other-mode', { active: filterType === 'other-mode' }]" @click="setFilterType('other-mode')">其他模式</button>
        </div>
      </div>

      <div class="filter-group" v-if="isRootMode">
        <span class="filter-label">同步状态:</span>
        <div class="filter-options">
          <button :class="['filter-option', { active: syncFilter === 'all' }]" @click="setSyncFilter('all')">全部</button>
          <button :class="['filter-option', 'pushed', { active: syncFilter === 'pushed' }]" @click="setSyncFilter('pushed')">已推送</button>
          <button :class="['filter-option', 'unpushed', { active: syncFilter === 'unpushed' }]" @click="setSyncFilter('unpushed')">未推送</button>
          <button :class="['filter-option', 'synced', { active: syncFilter === 'synced' }]" @click="setSyncFilter('synced')">已同步</button>
          <button :class="['filter-option', 'unsynced', { active: syncFilter === 'unsynced' }]" @click="setSyncFilter('unsynced')">未同步</button>
          <button :class="['filter-option', 'conflict', { active: syncFilter === 'conflict' }]" @click="setSyncFilter('conflict')">冲突</button>
        </div>
      </div>
    </div>
    
    <!-- 管理操作栏 -->
    <div v-if="isManager" class="management-section">
      <div class="selection-info">
        <label>
          <input type="checkbox" v-model="selectAll" @change="toggleSelectAll">
          全选 (已选: {{ selectedCount }})
        </label>
      </div>
      <div class="management-actions">
        <button class="data-button delete" @click="deleteSelected" :disabled="selectedCount === 0">
          删除选中
        </button>
      </div>
    </div>
    
    <!-- Excel风格表格 -->
    <div class="excel-table-container">
      <!-- 表头 -->
      <div class="excel-header-row">
        <div class="excel-cell checkbox-col" v-if="isManager">
          <span>选</span>
        </div>
        <div class="excel-cell version-col">版号</div>
        <div class="excel-cell type-col">类型</div>
        <div class="excel-cell mode-col">模式</div>
        <div class="excel-cell content-col">所有内容</div>
        <div class="excel-cell push-col">推送状态</div>
        <div class="excel-cell sync-col">同步状态</div>
        <div class="excel-cell conflict-col">有无冲突</div>
      </div>

      <!-- 表格内容 -->
      <div class="excel-body">
        <div 
          v-for="(item, index) in filteredData" 
          :key="item.key" 
          class="excel-row"
          :class="{ 'even-row': index % 2 === 1 }"
          :title="item.tooltip"
        >
          <!-- 复选框列 -->
          <div class="excel-cell checkbox-col" v-if="isManager">
            <input 
              type="checkbox" 
              v-model="item.selected"
            >
          </div>
          
          <!-- 版号列 -->
          <div class="excel-cell version-col">{{ item.version }}</div>
          
          <!-- 类型列 -->
          <div class="excel-cell type-col">{{ item.typeText }}</div>
          
          <!-- 模式列 -->
          <div class="excel-cell mode-col" :class="item.modeClass">
            {{ item.modeId }}
          </div>
          
          <!-- 内容列 -->
          <div class="excel-cell content-col">{{ item.content }}</div>
          
          <!-- 推送状态列 -->
          <div class="excel-cell push-col">
            <span :class="item.pushClass">{{ item.pushText }}</span>
          </div>
          
          <!-- 同步状态列 -->
          <div class="excel-cell sync-col">
            <span :class="item.syncClass">{{ item.syncText }}</span>
          </div>
          
          <!-- 冲突状态列 -->
          <div class="excel-cell conflict-col">
            <span :class="item.conflictClass">{{ item.conflictText }}</span>
          </div>
        </div>

        <div class="empty-state" v-if="filteredData.length === 0">
          <p>暂无数据</p>
        </div>
      </div>
    </div>
    
    <!-- 隐藏文件输入 -->
    <input type="file" ref="fileInput" class="hidden" accept=".json" @change="handleImport">
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ID } from '../components/Data/services/id.js'

// 状态变量
const isManager = ref(false)
const filterType = ref('all')
const syncFilter = ref('all')
const isRootMode = ref(true)
const selectAll = ref(false)
const fileInput = ref(null)

// 数据存储
const allData = ref([])

// 计算属性
const selectedCount = computed(() => {
  return allData.value.filter(item => item.selected).length
})

const filteredData = computed(() => {
  let result = [...allData.value]
  
  // 数据类型筛选
  if (filterType.value !== 'all') {
    switch (filterType.value) {
      case 'question':
        result = result.filter(item => item.type === ID.TYPES.QUESTION_BANK)
        break
      case 'env':
        result = result.filter(item => 
          item.type === ID.TYPES.ENV_FULL || 
          item.type === '@meta' // 将元数据显示在全量区筛选中
        )
        break
      case 'answers':
        result = result.filter(item => item.type === ID.TYPES.ANSWERS)
        break
      case 'root':
        result = result.filter(item => item.modeId === ID.ROOT_ADMIN_MODE_ID)
        break
      case 'other-mode':
        result = result.filter(item => item.modeId !== ID.ROOT_ADMIN_MODE_ID)
        break
    }
  }
  
  // 同步状态筛选
  if (syncFilter.value !== 'all') {
    result = result.filter(item => {
      switch (syncFilter.value) {
        case 'pushed':
          return item.pushStatus === 'pushed'
        case 'unpushed':
          return item.pushStatus === 'unpushed'
        case 'synced':
          return item.syncStatus === 'synced'
        case 'unsynced':
          return item.syncStatus === 'unsynced'
        case 'conflict':
          return item.conflictStatus === 'conflict'
        default:
          return true
      }
    })
  }
  
  return result
})

// 方法
const toggleManager = () => {
  isManager.value = !isManager.value
  if (!isManager.value) {
    // 退出管理时清除所有选择
    allData.value.forEach(item => {
      item.selected = false
    })
    selectAll.value = false
  }
}

const setFilterType = (type) => {
  filterType.value = type
}

const setSyncFilter = (status) => {
  syncFilter.value = status
}

const toggleSelectAll = () => {
  const newSelectedState = selectAll.value
  filteredData.value.forEach(item => {
    item.selected = newSelectedState
  })
}

const clearSelection = () => {
  allData.value.forEach(item => {
    item.selected = false
  })
  selectAll.value = false
}

const deleteSelected = () => {
  if (selectedCount.value === 0) return
  
  if (confirm(`确定要删除选中的 ${selectedCount.value} 条数据吗？`)) {
    // 过滤掉选中的数据
    allData.value = allData.value.filter(item => !item.selected)
    selectAll.value = false
  }
}

const triggerImport = () => {
  fileInput.value.click()
}

const handleImport = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      // 这里应该处理导入的数据
      console.log('导入数据:', data)
      alert('数据导入成功')
    } catch (error) {
      console.error('导入数据失败:', error)
      alert('数据导入失败: ' + error.message)
    }
  }
  reader.readAsText(file)
  event.target.value = '' // 重置文件输入
}

const exportData = () => {
  // 导出所有数据
  const dataStr = JSON.stringify(allData.value, null, 2)
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
  
  const exportFileDefaultName = 'data-export.json'
  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', dataUri)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()
}

// 扫描本地存储获取数据
const scanLocalStorage = () => {
  const data = []
  
  // 遍历所有localStorage项
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    
    // 只处理本系统数据 (以APP:开头)
    if (key && key.startsWith('APP:')) {
      try {
        const value = localStorage.getItem(key)
        const parsedValue = JSON.parse(value)
        
        // 解析key的各个部分
        const keyParts = key.split(':')
        if (keyParts.length >= 5) {
          const prefix = decodeURIComponent(keyParts[0])
          const modeId = decodeURIComponent(keyParts[1])
          const version = decodeURIComponent(keyParts[2])
          const type = decodeURIComponent(keyParts[3])
          const excelId = decodeURIComponent(keyParts[4])
          
          // 确定数据类型文本
          let typeText = '未知'
          if (type === ID.TYPES.QUESTION_BANK) {
            typeText = '题库'
          } else if (type === ID.TYPES.ENV_FULL) {
            typeText = '全量区'
          } else if (type === ID.TYPES.ANSWERS) {
            typeText = '回答'
          } else if (type === '@meta') {
            typeText = '元数据'
          } else if (type) {
            typeText = type
          }
          
          // 生成内容摘要 - 根据实际数据结构
          let content = ''
          if (type === ID.TYPES.QUESTION_BANK && Array.isArray(parsedValue.questions)) {
            content = `${parsedValue.questions.length}个题库条目`
          } else if (type === ID.TYPES.ENV_FULL && typeof parsedValue === 'object') {
            // 对于全量区数据，显示一些关键信息
            const cardCount = parsedValue.cards ? Object.keys(parsedValue.cards).length : 0
            const optionCount = parsedValue.options ? Object.keys(parsedValue.options).length : 0
            content = `cards: ${cardCount}, options: ${optionCount}`
          } else if (type === ID.TYPES.ANSWERS && typeof parsedValue === 'object') {
            // 对于回答数据，显示答案信息
            const selectionCount = parsedValue.questionBankAnswers?.selectedOptions?.length || 0
            const paramCount = Object.keys(parsedValue.envFullAnswers || {}).length
            const packageType = parsedValue.packageType || '未知类型'
            content = `${packageType}: ${selectionCount}个选择, ${paramCount}个参数`
          } else if (type === '@meta' && typeof parsedValue === 'object') {
            // 元数据显示特定字段
            if (parsedValue.lastUpdated) {
              content = `最后更新: ${new Date(parsedValue.lastUpdated).toLocaleString()}`
            } else {
              content = '元数据配置'
            }
          } else if (typeof parsedValue === 'object') {
            // 通用对象显示
            content = JSON.stringify(parsedValue).substring(0, 50) + '...'
          } else {
            // 其他类型数据
            content = String(parsedValue).substring(0, 50) + '...'
          }
          
          // 特殊处理：如果内容太短，尝试提供更多有用信息
          if (content.length < 10 && typeof parsedValue === 'object') {
            const keys = Object.keys(parsedValue)
            if (keys.length > 0) {
              content = keys.slice(0, 3).join(', ') + (keys.length > 3 ? '...' : '')
            }
          }
          
          data.push({
            key: key,
            version: version || '未指定',
            type: type || '未指定',
            typeText: typeText,
            modeId: modeId || '未指定',
            modeClass: modeId === ID.ROOT_ADMIN_MODE_ID ? 'mode-root' : 'mode-other',
            content: content,
            pushStatus: Math.random() > 0.5 ? 'pushed' : 'unpushed', // 模拟推送状态
            pushClass: Math.random() > 0.5 ? 'push-pushed' : 'push-unpushed',
            pushText: Math.random() > 0.5 ? '已推送' : '未推送',
            syncStatus: Math.random() > 0.5 ? 'synced' : 'unsynced', // 模拟同步状态
            syncClass: Math.random() > 0.5 ? 'sync-synced' : 'sync-unsynced',
            syncText: Math.random() > 0.5 ? '已同步' : '未同步',
            conflictStatus: Math.random() > 0.8 ? 'conflict' : 'no-conflict', // 模拟冲突状态
            conflictClass: Math.random() > 0.8 ? 'conflict-yes' : 'conflict-no',
            conflictText: Math.random() > 0.8 ? '有冲突' : '无冲突',
            selected: false,
            tooltip: key
          })
        }
      } catch (error) {
        // 即使解析失败，也显示基本信息
        data.push({
          key: key,
          version: '解析错误',
          type: '解析错误',
          typeText: '解析错误',
          modeId: '解析错误',
          modeClass: 'mode-other',
          content: '数据解析失败',
          pushStatus: 'unpushed',
          pushClass: 'push-unpushed',
          pushText: '解析失败',
          syncStatus: 'unsynced',
          syncClass: 'sync-unsynced',
          syncText: '解析失败',
          conflictStatus: 'no-conflict',
          conflictClass: 'conflict-no',
          conflictText: '无冲突',
          selected: false,
          tooltip: key
        })
        console.error('解析数据失败:', key, error)
      }
    }
  }
  
  allData.value = data
}
onMounted(() => {
  scanLocalStorage()
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
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

.data-button.import:hover {
  background-color: #45a049;
}

.data-button.export {
  background-color: #2196F3;
  color: white;
}

.data-button.export:hover {
  background-color: #1976D2;
}

.data-button.manager {
  background-color: #ff9800;
  color: white;
}

.data-button.manager:hover {
  background-color: #f57c00;
}

.data-button.manager.active {
  background-color: #e65100;
}

.data-button.clear {
  background-color: #f5f5f5;
  color: #333;
}

.data-button.clear:hover {
  background-color: #e0e0e0;
}

.data-button.delete {
  background-color: #f44336;
  color: white;
}

.data-button.delete:hover:not(:disabled) {
  background-color: #d32f2f;
}

.data-button.delete:disabled {
  background-color: #ffcccc;
  cursor: not-allowed;
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

.filter-option:hover {
  background-color: #f0f0f0;
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

.version-col {
  width: 100px;
}

.type-col {
  width: 100px;
}

.mode-col {
  width: 120px;
}

.content-col {
  min-width: 200px;
  width: 200px;
}

.push-col {
  width: 100px;
}

.sync-col {
  width: 100px;
}

.conflict-col {
  width: 100px;
}

.mode-root {
  color: #dc3545;
  font-weight: bold;
}

.mode-other {
  color: #007bff;
}

.push-pushed {
  color: #28a745;
}

.push-unpushed {
  color: #ffc107;
}

.sync-synced {
  color: #28a745;
}

.sync-unsynced {
  color: #ffc107;
}

.conflict-yes {
  color: #dc3545;
}

.conflict-no {
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