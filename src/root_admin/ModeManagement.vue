<template>
  <div class="mode-management">
    <!-- 原模式管理功能区域 -->
    <div class="mode-management-container">
      <div class="mode-controls">
        <!-- 新建模式按钮 -->
        <button 
          class="mode-button" 
          @click="toggleCreateMode"
          :class="{ active: isCreating }"
        >
          {{ isCreating ? '取消创建' : '新建模式' }}
        </button>
        
        <!-- 删除模式按钮 -->
        <button 
          class="mode-button" 
          @click="toggleDeleteMode"
          :class="{ danger: isDeleting, active: isDeleting }"
          :disabled="filteredModes.length <= 0"
        >
          {{ isDeleting ? '确认删除' : '删除模式' }}
        </button>
      </div>
      
      <!-- 创建模式表单 -->
      <div v-if="isCreating" class="create-mode-form">
        <input 
          type="text" 
          v-model="newModeName" 
          placeholder="请输入模式名称（将作为模式ID使用）"
          class="mode-name-input"
          @keyup.enter="createMode"
        >
        <button 
          class="confirm-create-button"
          @click="createMode"
          :disabled="!newModeName.trim()"
        >
          确认创建
        </button>
      </div>
      
      <!-- 模式列表 -->
      <div class="mode-list">
        <div 
          v-for="mode in filteredModes"
          :key="mode.id"
          class="mode-item"
        >
          <!-- 复选框（仅删除模式显示） -->
          <div v-if="isDeleting" class="mode-checkbox">
            <input 
              type="checkbox" 
              v-model="selectedModeIds" 
              :value="mode.id"
            >
          </div>
          <!-- 模式名称 -->
          <div class="mode-name">
            {{ mode.name }} ({{ mode.id }})
            <span class="sync-status" v-if="mode.id !== 'root_admin'">
              [{{ mode.syncStatus }}]
            </span>
          </div>
        </div>
        
        <div v-if="filteredModes.length === 0 && !isCreating" class="empty-state">
          暂无创建的模式，请点击"新建模式"
        </div>
      </div>
    </div>
    
    <!-- 匹配引擎控制 -->
    <div class="match-engine-control">
      <h3>匹配引擎控制</h3>
      <div class="engine-control-section">
        <div class="control-row">
          <label>匹配策略:</label>
          <select v-model="selectedStrategy" class="strategy-select">
            <option 
              v-for="strategy in availableStrategies" 
              :key="strategy" 
              :value="strategy"
            >
              {{ strategy === 'standard' ? '标准匹配' : strategy === 'fuzzy' ? '模糊匹配' : strategy }}
            </option>
          </select>
          <button @click="applyStrategy" class="apply-button">应用策略</button>
        </div>
        
        <div class="control-row" v-if="selectedStrategy === 'fuzzy'">
          <label>模糊匹配配置:</label>
          <div class="fuzzy-config">
            <label>
              <input type="checkbox" v-model="fuzzyConfig.allowPartialMatches">
              允许部分匹配
            </label>
            <label>
              <input type="checkbox" v-model="fuzzyConfig.qualityGrading">
              启用质量分级
            </label>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 引用独立的权限推送阀门组件 -->
    <PermissionPushValve 
      :availableModes="pushableModes"
      :availableVersions="availableVersions"
      @push-success="handlePushSuccess"
      @push-error="handlePushError"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import modeManager from '../components/Data/modeManager.js'
import { useCardStore } from '../components/Data/store'
import { rootMatchController } from '../components/Data/matchEngine.js'
import * as IdSvc from '../components/Data/services/id.js'
import PermissionPushValve from '../components/PermissionPushValve.vue'

// 获取卡片存储实例
const cardStore = useCardStore()

// 状态管理
const isCreating = ref(false)
const isDeleting = ref(false)
const newModeName = ref('')
const selectedModeIds = ref([])

// 匹配引擎控制
const selectedStrategy = ref('standard')
const availableStrategies = ref(['standard', 'fuzzy'])
const fuzzyConfig = ref({
  allowPartialMatches: true,
  qualityGrading: true
})

// 模式列表
const modes = ref(modeManager.getModes())

// 更新模式列表
const updateModes = () => {
  modes.value = modeManager.getModes()
}

// 过滤：只显示用户创建的模式（排除主模式root_admin）
const filteredModes = computed(() => {
  return modes.value.filter(mode => mode.id !== 'root_admin')
})

// 可推送的模式（未同步或需要更新的模式）
const pushableModes = computed(() => {
  return modes.value.filter(mode => mode.id !== 'root_admin')
})

// 可用版本列表
const availableVersions = ref([])

// 初始化
onMounted(() => {
  // 获取可用的匹配策略
  availableStrategies.value = rootMatchController.getAvailableStrategies()
  // 加载可用版本
  loadAvailableVersions()
  // 监听模式变化事件
  modeManager.onModesChanged(updateModes)
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  // 注意：在当前实现中，modeManager没有提供移除监听器的方法
  // 在实际应用中，应该提供取消监听的方法
})

// 监听卡片存储变化，重新加载版本
watch(() => cardStore.sessionCards, () => {
  loadAvailableVersions()
})

// 加载可用版本
const loadAvailableVersions = async () => {
  try {
    // 使用ID服务直接从LocalStorage提取root_admin模式的envFull版本
    const versions = IdSvc.extractKeysFields('version', {
      modeId: IdSvc.ROOT_ADMIN_MODE_ID,
      type: 'envFull'
    })
    
    availableVersions.value = versions || []
    console.log(`[版本加载] 找到 ${versions.length} 个可用版本:`, versions)
  } catch (error) {
    console.error('加载版本列表失败:', error)
    availableVersions.value = []
  }
}

// 切换创建模式
const toggleCreateMode = () => {
  if (isCreating.value) {
    newModeName.value = '' // 重置输入
  }
  isCreating.value = !isCreating.value
  isDeleting.value = false
  selectedModeIds.value = []
}

// 切换删除模式
const toggleDeleteMode = () => {
  if (isDeleting.value) {
    handleDeleteSelectedModes()
  } else {
    selectedModeIds.value = [] // 重置选择
  }
  isDeleting.value = !isDeleting.value
  isCreating.value = false
}

// 处理删除选中的模式
const handleDeleteSelectedModes = () => {
  if (selectedModeIds.value.length === 0) return
  
  if (confirm(`确定要删除这${selectedModeIds.value.length}个模式吗？`)) {
    try {
      const count = selectedModeIds.value.length; // 保存删除数量
      selectedModeIds.value.forEach(modeId => {
        modeManager.deleteMode(modeId)
      })
      // 显示删除成功提示
      alert(`成功删除${count}个模式`) // 使用保存的数量
      // 重置状态
      selectedModeIds.value = []
    } catch (error) {
      console.error('删除模式失败:', error)
      alert('删除模式失败: ' + error.message)
    }
  }
}

// 创建新模式
const createMode = () => {
  if (!newModeName.value.trim()) {
    alert('请输入模式名称')
    return
  }
  
  try {
    const newMode = modeManager.createMode(newModeName.value.trim())
    alert(`模式 "${newMode.name}" 创建成功！访问路径: /mode/${newMode.id}`)
    // 重置表单
    newModeName.value = ''
    isCreating.value = false
  } catch (error) {
    console.error('创建模式失败:', error)
    alert('创建模式失败: ' + error.message)
  }
}

// 应用匹配策略
const applyStrategy = () => {
  try {
    rootMatchController.setMatchStrategy(selectedStrategy.value)
    
    // 如果是模糊匹配，应用配置
    if (selectedStrategy.value === 'fuzzy') {
      rootMatchController.configureFuzzyMatch(fuzzyConfig.value)
    }
    
    alert(`匹配策略已设置为: ${selectedStrategy.value}`)
  } catch (error) {
    console.error('设置匹配策略失败:', error)
    alert('设置匹配策略失败: ' + error.message)
  }
}

// 处理推送成功事件
const handlePushSuccess = (report) => {
  console.log('[推送成功]', report)
  
  // 更新目标模式的同步状态
  modeManager.updateSyncStatus(report.targetMode, '已同步')
  
  console.log(`推送成功报告: 目标=${report.targetMode}, 版本=${report.version}, 条目=${report.copiedCount}`)
}

// 处理推送失败事件
const handlePushError = (error) => {
  console.error('[推送失败]', error)
  alert('推送失败: ' + error.message)
}
</script>

<style scoped>
.mode-management {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
}

/* 原模式管理功能的容器样式 */
.mode-management-container {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 20px;
  background-color: #fcfcfc;
}

.mode-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
}

.mode-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.mode-button:hover {
  opacity: 0.9;
}

.mode-button.danger {
  background-color: #e74c3c;
}

.mode-button.active {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.mode-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.create-mode-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px;
  background: none;
  border: 1px dashed #ccc;
  border-radius: 4px;
}

.mode-name-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex-grow: 1;
  min-width: 200px;
  font-size: 14px;
}

.mode-name-input:focus {
  outline: none;
  border-color: #2196f3;
}

.confirm-create-button {
  padding: 8px 16px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
}

.confirm-create-button:hover:not(:disabled) {
  background-color: #1976d2;
}

.confirm-create-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.mode-list {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 4px;
  background-color: #f0f0f0;
}

.mode-checkbox {
  margin: 0;
}

.mode-name {
  padding: 4px 10px;
  color: #333;
  font-size: 14px;
}

.sync-status {
  font-size: 12px;
  color: #666;
}

.empty-state {
  color: #888;
  padding: 15px;
  font-style: italic;
  font-size: 14px;
}

/* 匹配引擎控制样式 */
.match-engine-control {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 20px;
  background-color: #f0f8ff;
}

.match-engine-control h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.engine-control-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.control-row label {
  min-width: 100px;
  font-weight: bold;
}

.strategy-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 150px;
}

.apply-button {
  padding: 6px 12px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.fuzzy-config {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.fuzzy-config label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

/* 数据推送阀门样式 */
.push-valve-container {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  background-color: #f9f9f9;
}

.push-valve-container h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.valve-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.valve-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.valve-row label {
  min-width: 100px;
  font-weight: bold;
}

.mode-select, .version-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 200px;
}

.mode-select:disabled, .version-select:disabled {
  background-color: #f5f5f5;
  color: #999;
}

/* 推送阀门按钮样式 */
.action-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.push-button {
  background-color: #4CAF50;
  color: white;
}

.push-button:hover:not(:disabled) {
  background-color: #45a049;
}

.push-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 同步和授权选项区域（横向排列） */
.sync-options-inline, .auth-options-inline {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 8px 12px;
  background-color: #ffffff;
  border-radius: 4px;
  border: 1px solid #ddd;
  flex-wrap: wrap;
}

.sync-options-inline .group-label, .auth-options-inline .group-label {
  font-weight: bold;
  color: #333;
  white-space: nowrap;
}

.fixed-sync-hint {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  background-color: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.option-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.option-item input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-item label {
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.option-item label:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .mode-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .mode-button {
    width: 100%;
  }
  
  .create-mode-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .mode-name-input {
    min-width: auto;
    width: 100%;
  }
  
  .valve-row {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .valve-row label {
    min-width: auto;
  }
  
  .sync-options-inline, .auth-options-inline {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>