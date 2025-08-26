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
    
    <!-- 数据推送阀门 -->
    <div class="push-valve-container">
      <h3>数据推送阀门</h3>
      
      <div class="valve-section">
        <div class="valve-row">
          <label>选择目标模式:</label>
          <select 
            v-model="selectedTargetMode" 
            class="mode-select"
            :disabled="pushableModes.length === 0"
          >
            <option value="">请选择模式</option>
            <option 
              v-for="mode in pushableModes" 
              :key="mode.id" 
              :value="mode.id"
            >
              {{ mode.name }} ({{ mode.id }})
            </option>
          </select>
          
          <!-- 同步选项区域 -->
          <div class="sync-options-inline">
            <span class="group-label">同步:</span>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="sync-card-title"
                v-model="syncOptions.cardTitle"
                :disabled="!selectedTargetMode"
              >
              <label for="sync-card-title">卡片标题</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="sync-option-name"
                v-model="syncOptions.optionName"
                :disabled="!selectedTargetMode"
              >
              <label for="sync-option-name">选项名称</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="sync-option-value"
                v-model="syncOptions.optionValue"
                :disabled="!selectedTargetMode"
              >
              <label for="sync-option-value">选项值</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="sync-option-unit"
                v-model="syncOptions.optionUnit"
                :disabled="!selectedTargetMode"
              >
              <label for="sync-option-unit">选项单位</label>
            </div>
            <div class="fixed-sync-hint">
              (固定同步: 卡片数量、选项数据、卡片顺序、下拉菜单、预设)
            </div>
          </div>
        </div>
        
        <div class="valve-row">
          <label>选择推送版本:</label>
          <select 
            v-model="selectedVersion" 
            class="version-select"
            :disabled="availableVersions.length === 0 || !selectedTargetMode"
          >
            <option value="">请选择版本</option>
            <option 
              v-for="version in availableVersions" 
              :key="version" 
              :value="version"
            >
              {{ version }}
            </option>
          </select>
          
          <!-- 授权选项区域 -->
          <div class="auth-options-inline">
            <span class="group-label">授权:</span>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="auth-card-title"
                v-model="authOptions.cardTitle"
                :disabled="!selectedTargetMode"
              >
              <label for="auth-card-title">卡片标题</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="auth-option-name"
                v-model="authOptions.optionName"
                :disabled="!selectedTargetMode"
              >
              <label for="auth-option-name">选项名称</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="auth-option-value"
                v-model="authOptions.optionValue"
                :disabled="!selectedTargetMode"
              >
              <label for="auth-option-value">选项值</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="auth-option-unit"
                v-model="authOptions.optionUnit"
                :disabled="!selectedTargetMode"
              >
              <label for="auth-option-unit">选项单位</label>
            </div>
            <div class="option-item">
              <input 
                type="checkbox" 
                id="auth-checkbox"
                v-model="authOptions.checkbox"
                :disabled="!selectedTargetMode"
              >
              <label for="auth-checkbox">复选框</label>
            </div>
          </div>
        </div>
        
        <!-- 直接推送按钮 -->
        <div class="valve-row">
          <button 
            class="action-button push-button"
            :disabled="!selectedTargetMode || pushableModes.length === 0 || !selectedVersion || pushingData"
            @click="pushData"
          >
            {{ pushingData ? '推送中...' : '推送配置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import modeManager from '../components/Data/modeManager.js'
import communicationService from '../components/Data/communicationService.js'
import { useCardStore } from '../components/Data/store'
import { rootMatchController } from '../components/Data/matchEngine.js'

// 获取卡片存储实例
const cardStore = useCardStore()

// 状态管理
const isCreating = ref(false)
const isDeleting = ref(false)
const newModeName = ref('')
const selectedModeIds = ref([])
const selectedTargetMode = ref('')
const selectedVersion = ref('')

// 匹配引擎控制
const selectedStrategy = ref('standard')
const availableStrategies = ref(['standard', 'fuzzy'])
const fuzzyConfig = ref({
  allowPartialMatches: true,
  qualityGrading: true
})

// 同步选项
const syncOptions = ref({
  cardTitle: false,
  optionName: false,
  optionValue: false,
  optionUnit: false
})

// 授权选项
const authOptions = ref({
  cardTitle: false,
  optionName: false,
  optionValue: false,
  optionUnit: false,
  checkbox: false // 控制其他模式是否显示复选框
})

const pushingData = ref(false)

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
    const versions = await cardStore.listEnvFullSnapshots()
    availableVersions.value = versions.map(v => v.version)
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

// 收集要推送的数据
const collectPushData = async () => {
  const data = {}
  
  // 始终推送卡片结构数据（不可克扣）
  data.cards = cardStore.sessionCards || []
  
  // 添加版本信息
  data.version = selectedVersion.value
  
  // 添加匹配策略信息
  data.matchStrategy = {
    strategy: selectedStrategy.value,
    config: selectedStrategy.value === 'fuzzy' ? fuzzyConfig.value : null
  }
  
  // 添加同步选项
  data.syncOptions = { ...syncOptions.value }
  
  // 添加授权选项
  data.authOptions = { ...authOptions.value }
  
  // 加载指定版本的题库
  await cardStore.loadQuestionBank()
  data.questionBank = cardStore.questionBank || {}
  
  return data
}

// 推送数据到指定模式
const pushData = async () => {
  if (!selectedTargetMode.value) {
    alert('请选择目标模式')
    return
  }
  
  if (!selectedVersion.value) {
    alert('请选择推送版本')
    return
  }
  
  pushingData.value = true
  
  try {
    // 收集要推送的数据
    const data = await collectPushData()
    
    // 构建权限配置
    const permissions = {
      editable: authOptions.value, // 使用授权选项作为可编辑配置
      readOnly: !Object.values(authOptions.value).some(val => val) // 如果没有任何授权项被选中，则为只读
    }
    
    // 使用通信服务推送数据（不再传递withholding参数）
    communicationService.pushDataToMode(
      selectedTargetMode.value,
      data,
      permissions
    )
    
    // 更新目标模式的同步状态
    modeManager.updateSyncStatus(selectedTargetMode.value, '已同步')
    
    // 显示成功推送提示
    alert(`数据已成功推送到模式: ${selectedTargetMode.value}`)
    pushingData.value = false
    
    // 推送成功后保持当前选择，方便用户继续操作
  } catch (error) {
    console.error('推送数据失败:', error)
    // 显示错误推送提示
    alert('推送数据失败: ' + error.message)
    pushingData.value = false
  }
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