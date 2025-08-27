<template>
  <div class="sub-mode">
    <!-- 第一部分：模式信息栏 -->
    <div class="bar mode-info-bar">
      <div class="mode-info-content">
        <h3 class="mode-title">{{ modeInfo.name }}</h3>
        <span class="mode-status">同步状态: {{ syncStatus }}</span>
        <span v-if="lastSyncTime" class="sync-time">上次同步: {{ lastSyncTime }}</span>
        <span v-if="currentVersion" class="current-version">当前版本: {{ currentVersion }}</span>
      </div>
      
      <!-- 自动加载提示区域 -->
      <div class="auto-load-info">
        <span v-if="loadingData" class="loading-text">正在加载数据...</span>
        <span v-else-if="availableVersionsCount > 0" class="versions-text">
          已加载最新推送数据
        </span>
        <span v-else class="no-data-text">暂无数据，请等待主模式推送</span>
        
        <button 
          class="test-button refresh-button" 
          @click="refreshAndLoadLatest"
          :disabled="loadingData"
        >
          {{ loadingData ? '加载中...' : '刷新数据' }}
        </button>
      </div>
    </div>

    <!-- 第二部分：应用区域标题（居中） -->
    <div class="answer-title-section">
      <h2 class="answer-title">应用区</h2>
      <p class="answer-subtitle">以下是从权限推送加载的数据（按权限控制）</p>
    </div>

    <!-- 卡片列表（子模式：按权限控制的数据展示） -->
    <div class="cards-container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card-wrapper"
        :class="{
          selected: selectedCardId === card.id,
          'hide-option-actions': !card.editableFields.optionActions
        }"
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
          :on-add-option="(afterId) => handleAddOption(card.id, afterId)"
          :on-delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
          :on-add-select-option="(label) => handleAddSelectOption(card.id, label)"
          :on-delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
          :on-dropdown-toggle="(value) => setShowDropdown(card.id, value)"
        />
      </div>
    </div>

    <!-- 第四部分：回答提交区域 -->
    <div class="answer-submit-section">
      <button 
        class="answer-submit-button"
        @click="submitAnswers"
        :disabled="submittingAnswers"
      >
        {{ submittingAnswers ? '提交中...' : '回答完毕' }}
      </button>
    </div>

    <!-- 第五部分：匹配反馈区 -->
    <div class="match-feedback-section">
      <div class="bar match-bar">
        <button 
          class="test-button generate-button" 
          @click="handleGenerateMatch"
          :disabled="generatingMatch"
        >
          <i class="fas fa-magic"></i>
          {{ generatingMatch ? '生成中...' : '生成' }}
        </button>
      </div>
      
      <div class="match-result-area">
        <div v-if="matchResult" class="result-content">
          <h3>匹配结果</h3>
          <div v-if="matchResult.success">
            <p><strong>表达式:</strong> {{ matchResult.expression }}</p>
            <p><strong>结果:</strong> {{ matchResult.result }}</p>
            <p><strong>验证:</strong> {{ matchResult.validation?.message }}</p>
          </div>
          <div v-else>
            <p class="error"><strong>匹配失败:</strong> {{ matchResult.error }}</p>
          </div>
        </div>
        <div v-else class="placeholder">
          匹配结果将显示在这里
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import UniversalCard from '../UniversalCard/UniversalCard.vue'
import communicationService from '../Data/communicationService.js'
import { matchEngine } from '../Data/matchEngine.js'
import modeManager from '../Data/modeManager.js'
import { useCardStore } from '../Data/store.js'
import * as idService from '../Data/services/id.js'

// 使用全局store
const cardStore = useCardStore()
defineOptions({
  name: 'SubMode'
})

// 获取路由参数
const route = useRoute()
const modeId = computed(() => route.params.modeId)

// 模式信息
const modeInfo = ref({
  name: '未命名模式'
})

const syncStatus = ref('未同步')
const lastSyncTime = ref(null)
const currentVersion = ref(null)

// 卡片数据（从 store 获取）
const cards = computed(() => cardStore.sessionCards)
const selectedCardId = ref(null)

// computed 属性
const selectedCard = computed(() => {
  return cards.value.find(card => card.id === selectedCardId.value)
})

// 自动加载相关
const loadingData = ref(false)
const availableVersionsCount = ref(0)

// 清理函数
let cleanupListener = null

// 初始化
onMounted(() => {
  // 检查模式是否仍然存在
  const modeExists = modeManager.getMode(modeId.value);
  if (!modeExists && modeId.value !== 'root_admin') {
    // 如果模式不存在，重定向到首页
    window.location.href = '/';
    return;
  }
  
  // 初始化模式信息
  const mode = modeManager.getMode(modeId.value)
  if (mode) {
    modeInfo.value.name = mode.name
  } else {
    modeInfo.value.name = `模式-${modeId.value}`
  }
  
  // 监听数据推送
  cleanupListener = communicationService.onDataPush(handleIncomingData)
  
  // 这里应该从本地存储加载卡片数据
  loadCardData()
})

// 组件卸载时清理监听器
onUnmounted(() => {
  if (cleanupListener) {
    cleanupListener()
  }
})

// 处理接收到的数据
const handleIncomingData = (packet) => {
  if (packet.targetModeId !== modeId.value) {
    return // 不是发给当前模式的数据
  }
  
  syncStatus.value = '同步中...'
  
  try {
    // 应用权限配置
    // 这里应该根据permissions设置卡片的可编辑性
    
    // 处理数据克扣
    const processedData = processWithholdingData(packet.data, packet.withholding)
    
    // 更新卡片数据
    updateCardData(processedData)
    
    // 设置当前版本
    currentVersion.value = packet.data.version || null
    
    // 更新同步状态
    syncStatus.value = '已同步'
    lastSyncTime.value = new Date().toLocaleString()
    
    console.log(`模式 ${modeId.value} 接收并处理了推送的数据，版本: ${currentVersion.value}`)
  } catch (error) {
    console.error('处理推送数据失败:', error)
    syncStatus.value = '同步失败'
  }
}

// 处理数据克扣
const processWithholdingData = (data, withholding) => {
  // 根据withholding配置克扣数据
  const processed = JSON.parse(JSON.stringify(data))
  
  if (withholding.value) {
    // 克扣选项值
    processed.cards?.forEach(card => {
      card.data?.options?.forEach(option => {
        option.value = null // 克扣值
      })
    })
  }
  
  if (withholding.unit) {
    // 克扣选项单位
    processed.cards?.forEach(card => {
      card.data?.options?.forEach(option => {
        option.unit = null // 克扣单位
      })
    })
  }
  
  return processed
}

// 更新卡片数据
const updateCardData = (data) => {
  // 这里应该根据接收到的数据更新卡片
  // 新的数据会直接覆盖旧的数据，确保子模式只运行一个版本
  cards.value = data.cards || []
  console.log('卡片数据已更新:', cards.value)
}

// 加载卡片数据（自动检测自己模式ID下的全量区类型数据）
const loadCardData = async () => {
  loadingData.value = true
  
  try {
    console.log(`[子模式] 开始自动检测模式 ${modeId.value} 下的全量区类型推送数据`)
    
    // 1. 获取当前模式ID下的全量区类型版本（只检测envFull类型）
    const availableVersions = idService.extractKeysFields('version', {
      modeId: modeId.value, // 只检测自己的模式ID
      type: 'envFull' // 只检测全量区类型数据
    })
    
    availableVersionsCount.value = availableVersions.length
    console.log(`[子模式] 模式 ${modeId.value} 下找到 ${availableVersions.length} 个全量区版本:`, availableVersions)
    
    if (availableVersions.length === 0) {
      console.log(`[子模式] 模式 ${modeId.value} 没有全量区类型数据，请等待主模式推送`)
      cardStore.sessionCards = []
      currentVersion.value = null
      syncStatus.value = '暂无数据'
      return
    }
    
    // 2. 自动加载最新的全量区数据（取最新版本）
    const targetVersion = availableVersions[availableVersions.length - 1] // 取最后一个（最新）
    console.log(`[子模式] 自动加载最新全量区版本: ${targetVersion}`)
    
    // 3. 加载指定版本的数据
    const success = await loadVersionData(targetVersion)
    
    if (success) {
      currentVersion.value = targetVersion
      syncStatus.value = '已加载'
      lastSyncTime.value = new Date().toLocaleString()
      console.log(`[子模式] 成功自动加载版本 ${targetVersion} 的全量区数据`)
    } else {
      syncStatus.value = '加载失败'
    }
    
  } catch (error) {
    console.error('[子模式] 自动检测和加载数据失败:', error)
    syncStatus.value = '加载失败'
    availableVersionsCount.value = 0
  } finally {
    loadingData.value = false
  }
}

// 加载指定版本的数据
const loadVersionData = async (version, preloadedKeys = null) => {
  try {
    // 1. 使用store统一接口加载权限配置
    console.log(`\n=== [子模式权限] 开始加载权限配置 ===`)
    const permissionConfig = cardStore.loadPermissionConfig(modeId.value, version)
    console.log(`[子模式权限] 权限配置:`, permissionConfig)
    
    // 2. 使用store统一接口加载环境数据
    console.log(`[子模式] 使用store统一接口加载环境数据`)
    const envData = await cardStore.getEnvFullSnapshot(version)
    
    if (!envData || !envData.environment) {
      console.warn(`[子模式] 版本 ${version} 没有环境数据`)
      return false
    }
    
    console.log(`[子模式] 成功加载环境数据:`, envData)
    
    // 3. 从环境数据中构建卡片结构
    const cardMap = new Map()
    const environment = envData.environment || {}
    const envCards = environment.cards || {}
    const envOptions = environment.options || {}
    
    console.log(`[子模式] 环境卡片:`, envCards)
    console.log(`[子模式] 环境选项:`, envOptions)
    
    // 4. 遍历卡片和选项，构建卡片结构
    Object.entries(envCards).forEach(([cardId, cardData]) => {
      if (!cardMap.has(cardId)) {
        cardMap.set(cardId, {
          id: cardId,
          data: {
            title: cardData.title || `卡片${cardId}`,
            options: [],
            selectedValue: null,
            selectOptions: cardData.dropdown || []
          },
          editableFields: {
            optionName: true,
            optionValue: true,
            optionUnit: true,
            optionCheckbox: true,
            optionActions: false
          },
          showDropdown: false,
          isTitleEditing: false,
          isOptionsEditing: false,
          isSelectEditing: false,
          isPresetEditing: false
        })
      }
    })
    
    // 5. 处理选项数据
    Object.entries(envOptions).forEach(([fullId, optionData]) => {
      const excelInfo = idService.splitExcelId(fullId)
      if (excelInfo.kind === 'option') {
        const cardId = excelInfo.cardId
        
        // 确保卡片存在
        if (!cardMap.has(cardId)) {
          cardMap.set(cardId, {
            id: cardId,
            data: {
              title: `卡片${cardId}`,
              options: [],
              selectedValue: null,
              selectOptions: []
            },
            editableFields: {
              optionName: false,
              optionValue: false,
              optionUnit: false,
              optionCheckbox: true, // 复选框总是显示
              optionActions: false // 加减按钮总是隐藏
            },
            showDropdown: false,
            isTitleEditing: false,
            isOptionsEditing: false,
            isSelectEditing: false,
            isPresetEditing: false
          })
        }
        
        const card = cardMap.get(cardId)
        
        // 6. 根据权限配置应用"授权 > 同步"原则
        const processedOptionData = applyPermissionLogic(fullId, optionData, permissionConfig)
        
        card.data.options.push({
          id: excelInfo.optionId,
          name: processedOptionData.name,
          value: processedOptionData.value,
          unit: processedOptionData.unit,
          checked: false // 子模式默认未勾选
        })
      }
    })
    
    // 7. 转换为数组并按卡片ID排序
    const cardsArray = Array.from(cardMap.values()).sort((a, b) => {
      return idService.compareCardIds(a.id, b.id)
    })
    
    // 8. 对每张卡片的选项按ID排序
    cardsArray.forEach(card => {
      card.data.options.sort((a, b) => parseInt(a.id) - parseInt(b.id))
      
      // 9. 为每张卡片应用权限控制
      applyCardPermissions(card, permissionConfig)
    })
    
    // 10. 将构建的卡片数据保存到store的sessionCards中
    cardStore.sessionCards = cardsArray
    console.log(`[子模式] 成功构建 ${cardsArray.length} 张卡片，已保存到store`)
    console.log(`[子模式权限] 权限配置应用完成`)
    console.log(`=== [子模式权限] 权限加载结束 ===\n`)
    
    return true
  } catch (error) {
    console.error(`[子模式] 加载版本 ${version} 数据失败:`, error)
    return false
  }
}

// 刷新并加载最新数据
const refreshAndLoadLatest = () => {
  loadCardData()
}

// === 权限控制核心函数 ===
// 注意：不再需要loadPermissionConfig函数，直接使用store接口

// 应用权限逻辑："授权 > 同步"原则
const applyPermissionLogic = (excelId, originalData, permissionConfig) => {
  const permissions = permissionConfig[excelId]
  
  if (!permissions) {
    console.log(`[子模式权限] ExcelID ${excelId} 无权限配置，显示原始同步数据`)
    return {
      name: originalData.name || `选项${excelId}`,
      value: originalData.value || '',
      unit: originalData.unit || ''
    }
  }
  
  const result = {
    name: applyFieldPermission('name', originalData.name, permissions.name),
    value: applyFieldPermission('value', originalData.value, permissions.value),
    unit: applyFieldPermission('unit', originalData.unit, permissions.unit)
  }
  
  console.log(`[子模式权限] ExcelID ${excelId} 权限应用结果:`, {
    原始: originalData,
    权限: permissions,
    结果: result
  })
  
  return result
}

// 应用单个字段权限："授权 > 同步"原则
const applyFieldPermission = (fieldName, originalValue, fieldPermission) => {
  if (!fieldPermission) {
    // 无权限配置：显示同步的原值
    return originalValue || ''
  }
  
  const { sync, auth } = fieldPermission
  
  // 核心逻辑：授权 > 同步
  if (auth) {
    // 有授权：显示空白编辑框，无任何同步信息
    console.log(`[子模式权限] 字段 ${fieldName}: 有授权权限，显示空白编辑框`)
    return ''
  } else if (sync) {
    // 只有同步，无授权：显示同步的原值（只读）
    console.log(`[子模式权限] 字段 ${fieldName}: 只有同步权限，显示同步原值（只读）`)
    return originalValue || ''
  } else {
    // 既无同步也无授权：显示空值
    console.log(`[子模式权限] 字段 ${fieldName}: 无任何权限，显示空值`)
    return ''
  }
}

// 为卡片应用权限控制（只控制加减按钮，保持其他功能原生）
const applyCardPermissions = (card, permissionConfig) => {
  console.log(`[子模式权限] 为卡片 ${card.id} 应用权限控制`)
  
  // 子模式只需要隐藏加减按钮，其他功能保持原生
  card.editableFields = {
    optionName: false,
    optionValue: false,
    optionUnit: false,
    optionCheckbox: true, // 复选框总是显示
    optionActions: false, // 加减按钮总是隐藏
    select: true // 下拉选择器保持原生功能
  }
  
  // 根据权限配置设置字段可编辑性
  card.data.options.forEach(option => {
    const excelId = `${card.id}${option.id}`
    const permissions = permissionConfig[excelId]
    
    if (permissions) {
      // 检查各字段的授权状态
      if (permissions.name?.auth) {
        card.editableFields.optionName = true
      }
      if (permissions.value?.auth) {
        card.editableFields.optionValue = true
      }
      if (permissions.unit?.auth) {
        card.editableFields.optionUnit = true
      }
      
      // 将权限信息附加到选项上（供调试使用）
      option.permissions = permissions
    }
  })
  
  console.log(`[子模式权限] 卡片 ${card.id} 保持原生功能，只隐藏加减按钮`)
}

// 卡片操作方法（通过store管理）
const selectCard = (id) => {
  selectedCardId.value = id
}

const toggleTitleEditing = () => {
  if (selectedCardId.value) {
    // 使用store的toggleTitleEditing方法
    cardStore.toggleTitleEditing(selectedCardId.value)
  }
}

const toggleSelectEditing = () => {
  if (selectedCardId.value) {
    // 使用store的toggleSelectEditing方法
    cardStore.toggleSelectEditing(selectedCardId.value)
  }
}

const toggleEditableField = (field) => {
  if (selectedCardId.value) {
    // 使用store的toggleEditableField方法，就像CardSection.vue一样
    cardStore.toggleEditableField(selectedCardId.value, field)
  }
}

const handleAddOption = (cardId, afterId) => {
  console.log(`添加选项到卡片 ${cardId}，在 ${afterId} 之后`)
  // 使用store的addOption方法
  cardStore.addOption(cardId, afterId)
}

const handleDeleteOption = (cardId, optionId) => {
  console.log(`从卡片 ${cardId} 删除选项 ${optionId}`)
  // 使用store的deleteOption方法
  cardStore.deleteOption(cardId, optionId)
}

const handleAddSelectOption = (cardId, label) => {
  console.log(`添加下拉选项到卡片 ${cardId}: ${label}`)
  // 使用store的addSelectOption方法
  cardStore.addSelectOption(cardId, label)
}

const handleDeleteSelectOption = (cardId, optionId) => {
  console.log(`从卡片 ${cardId} 删除下拉选项 ${optionId}`)
  // 使用store的deleteSelectOption方法
  cardStore.deleteSelectOption(cardId, optionId)
}

const setShowDropdown = (cardId, value) => {
  const card = cards.value.find(c => c.id === cardId)
  if (card) {
    card.showDropdown = value
  }
}

// 提交答案到LocalStorage
const submitAnswers = async () => {
  submittingAnswers.value = true
  
  try {
    // 收集当前模式的答案数据
    const answerData = {
      modeId: modeId.value,
      modeName: modeInfo.value.name,
      version: currentVersion.value,
      timestamp: new Date().toISOString(),
      cards: cards.value.map(card => ({
        id: card.id,
        title: card.data.title,
        selectedValue: card.data.selectedValue,
        options: card.data.options?.map(option => ({
          id: option.id,
          name: option.name,
          value: option.value,
          unit: option.unit,
          checked: option.checked
        })) || []
      }))
    }
    
    // 使用五段Key系统生成存储Key
    const storageKey = idService.buildKey(
      idService.getSystemPrefix(),
      modeId.value,
      currentVersion.value || 'default',
      'answers', // 答案类型
      'user_submission'
    )
    
    // 存储到LocalStorage
    localStorage.setItem(storageKey, JSON.stringify(answerData))
    
    console.log(`模式 ${modeId.value} 的答案已提交，存储Key: ${storageKey}`)
    alert('答案提交成功！')
    
  } catch (error) {
    console.error('提交答案失败:', error)
    alert('提交答案失败: ' + error.message)
  } finally {
    submittingAnswers.value = false
  }
}

// 匹配处理
const handleGenerateMatch = async () => {
  generatingMatch.value = true
  
  try {
    // 执行匹配
    const result = await matchEngine.performMatch(modeId.value)
    matchResult.value = result
  } catch (error) {
    console.error('匹配过程出错:', error)
    matchResult.value = {
      success: false,
      error: '匹配过程出错: ' + error.message
    }
  } finally {
    generatingMatch.value = false
  }
}
</script>

<style scoped>
.sub-mode {
  width: 100%;
  max-width: none;
  min-width: 1760px; /* 确保能容纳7张卡片: 240*7 + 6*6 + 余量 = 1760px */
  padding: 20px 40px;
  box-sizing: border-box;
  overflow-x: auto; /* 小屏幕时允许水平滚动 */
}

/* 通用bar样式（参考root_admin） */
.bar {
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
  box-sizing: border-box;
  min-height: 40px;
}

/* 第一部分：模式信息栏（细长条样式） */
.mode-info-bar {
  background-color: #f5f5f5;
  padding: 6px 15px;
  min-height: 36px;
  height: auto;
  border: 2px solid #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
}

.mode-info-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  flex: 1;
  min-width: 0;
}

/* 自动加载信息区域 */
.auto-load-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11px;
}

.mode-title {
  margin: 0;
  font-size: 16px;
  color: #1976d2;
  font-weight: bold;
  line-height: 1.2;
  padding: 4px 0;
  height: auto;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
}

.mode-status,
.sync-time,
.current-version {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  line-height: 1.2;
}

.loading-text {
  color: #2196f3;
  font-weight: bold;
  font-size: 12px;
}

.versions-text {
  color: #4caf50;
  font-weight: bold;
  font-size: 12px;
}

.no-data-text {
  color: #ff9800;
  font-style: italic;
  font-size: 12px;
}

.refresh-button {
  padding: 2px 6px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  transition: background-color 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.refresh-button:hover:not(:disabled) {
  background-color: #1976d2;
}

.refresh-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 第二部分：答题区域标题（居中） */
.answer-title-section {
  text-align: center;
  margin: 30px 0 20px 0;
}

.answer-title {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #2e7d32;
  font-weight: bold;
}

.answer-subtitle {
  margin: 0;
  color: #666;
  font-size: 12px;
}

/* 第四部分：回答提交区域（居中） */
.answer-submit-section {
  text-align: center;
  margin: 30px 0;
  padding: 20px;
}

.answer-submit-button {
  padding: 12px 30px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 6px;
  background-color: #2196f3;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.answer-submit-button:hover:not(:disabled) {
  background-color: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(33, 150, 243, 0.3);
}

.answer-submit-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 按钮样式（保持root_admin的按钮风格） */
.test-button {
  margin: 0;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.test-button:hover:not(:disabled) {
  opacity: 0.9;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* 卡片列表（完全复刻CardSection.vue） */
.cards-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.card-wrapper {
  position: relative;
  width: 240px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.card-wrapper.selected {
  box-shadow: 0 0 0 3px #4caf50;
}

.card-wrapper.deleting .universal-card {
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
  opacity: 0.9;
}

/* 仅隐藏"加/减按钮"，不影响名称/值/单位输入框 */
:deep(.hide-option-actions .option-actions) {
  display: none !important;
}

/* 删除覆盖层 */
.delete-overlay {
  position: absolute;
  inset: 0;
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

/* 第五部分：匹配反馈区 */
.match-feedback-section {
  margin-top: 40px;
}

.match-bar {
  justify-content: center;
  background-color: #fff3e0;
  border-color: #ffcc02;
}

.generate-button {
  background-color: #ff9800;
  padding: 10px 20px;
  font-weight: bold;
}

.match-result-area {
  border: 1px dashed #ccc;
  padding: 20px;
  background-color: #fafafa;
  min-height: 150px;
}

.result-content h3 {
  margin-top: 0;
}

.result-content p {
  margin: 10px 0;
}

.result-content .error {
  color: #f44336;
}

.result-content pre {
  background-color: #fff;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}

.placeholder {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 40px 0;
}

/* 响应式卡片布局：确保7张卡片才换行（与CardSection.vue一致） */
/* 卡片固定宽度240px，7张卡片需要约1760px容器宽度 */

/* PC端大屏幕优化 */
@media (min-width: 1200px) {
  .sub-mode {
    padding: 30px 60px;
    min-width: 1800px; /* 稍微增加一些余量 */
  }
  
  .bar:not(.mode-info-bar) {
    padding: 18px 25px;
    gap: 25px;
  }
}

@media (min-width: 1600px) {
  .sub-mode {
    padding: 40px 80px;
    min-width: 1900px; /* 超大屏幕时给更多空间 */
  }
}

/* 小屏幕时的处理 */
@media (max-width: 1760px) {
  .sub-mode {
    min-width: auto;
    overflow-x: auto;
  }
  
  .cards-container {
    min-width: 1720px; /* 保证7张卡片的最小宽度 */
  }
}
</style>