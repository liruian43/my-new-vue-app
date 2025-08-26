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

    <!-- 第二部分：答题区域标题（居中） -->
    <div class="answer-title-section">
      <h2 class="answer-title">数据展示区域</h2>
      <p class="answer-subtitle">以下是从LocalStorage加载的快照数据（只读模式）</p>
    </div>

    <!-- 卡片列表（子模式：完全只读展示LocalStorage快照数据） -->
    <div class="cards-container">
      <div
        v-for="card in cards"
        :key="card.id"
        class="card-wrapper"
      >
        <UniversalCard
          :modelValue="card.data.title"
          :options="card.data.options"
          :selectedValue="card.data.selectedValue"
          :selectOptions="card.data.selectOptions"
          :showDropdown="false"
          :isTitleEditing="false"
          :isOptionsEditing="false"
          :isSelectEditing="false"
          :editableFields="{
            optionName: false,
            optionValue: false,
            optionUnit: false,
            optionCheckbox: false,
            optionActions: false
          }"
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
import matchEngine from '../Data/matchEngine.js'
import modeManager from '../Data/modeManager.js'
import * as idService from '../Data/services/id.js'

// 定义组件名称，用于KeepAlive缓存
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

// 卡片数据
const cards = ref([])

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

// 加载卡片数据（加载目标模式的唯一版本）
const loadCardData = async () => {
  loadingData.value = true
  
  try {
    console.log(`[子模式] 开始加载模式 ${modeId.value} 的唯一版本数据`)
    
    // 1. 获取当前模式的所有版本（一模式一版本，应该只有一个）
    const availableVersions = idService.extractKeysFields('version', {
      modeId: modeId.value,
      type: 'envFull'
    })
    
    availableVersionsCount.value = availableVersions.length
    console.log(`[子模式] 找到 ${availableVersions.length} 个版本:`, availableVersions)
    
    if (availableVersions.length === 0) {
      console.log(`[子模式] 模式 ${modeId.value} 没有可用数据`)
      cards.value = []
      currentVersion.value = null
      syncStatus.value = '暂无数据'
      return
    }
    
    // 2. 加载唯一版本的数据（正常情况下只有一个版本）
    const targetVersion = availableVersions[0] // 取第一个（也是唯一一个）
    console.log(`[子模式] 加载版本: ${targetVersion}`)
    
    if (availableVersions.length > 1) {
      console.warn(`[子模式] 警告：模式 ${modeId.value} 有 ${availableVersions.length} 个版本，不符合一模式一版本的设计`)
    }
    
    // 3. 加载指定版本的数据
    const success = await loadVersionData(targetVersion)
    
    if (success) {
      currentVersion.value = targetVersion
      syncStatus.value = '已加载'
      lastSyncTime.value = new Date().toLocaleString()
      console.log(`[子模式] 成功加载版本 ${targetVersion} 的数据`)
    } else {
      syncStatus.value = '加载失败'
    }
    
  } catch (error) {
    console.error('[子模式] 加载数据失败:', error)
    syncStatus.value = '加载失败'
    availableVersionsCount.value = 0
  } finally {
    loadingData.value = false
  }
}

// 加载指定版本的数据
const loadVersionData = async (version, preloadedKeys = null) => {
  try {
    // 优先使用预加载的keys，否则重新查询
    let versionKeys
    if (preloadedKeys && Array.isArray(preloadedKeys)) {
      versionKeys = preloadedKeys
      console.log(`[子模式] 使用预加载的keys，数量: ${versionKeys.length}`)
    } else {
      // 获取指定版本的所有envFull数据
      versionKeys = idService.batchKeyOperation('export', {
        modeId: modeId.value,
        version: version,
        type: 'envFull'
      })
      console.log(`[子模式] 查询版本 ${version} 的数据条目: ${versionKeys.length}`)
    }
    
    if (versionKeys.length === 0) {
      console.warn(`[子模式] 版本 ${version} 没有数据`)
      return false
    }
    
    // 构建卡片数据结构
    const cardMap = new Map()
    
    versionKeys.forEach(({ key, fields, data }) => {
      try {
        const parsedData = JSON.parse(data)
        const excelId = fields.excelId
        
        // 解析ExcelID获取卡片ID和选项ID
        const excelInfo = idService.splitExcelId(excelId)
        
        if (excelInfo.kind === 'card') {
          // 卡片级数据
          if (!cardMap.has(excelInfo.cardId)) {
            cardMap.set(excelInfo.cardId, {
              id: excelInfo.cardId,
              data: {
                title: parsedData.title || `卡片${excelInfo.cardId}`,
                options: [],
                selectedValue: null,
                selectOptions: parsedData.selectOptions || []
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
        } else if (excelInfo.kind === 'option') {
          // 选项级数据
          if (!cardMap.has(excelInfo.cardId)) {
            cardMap.set(excelInfo.cardId, {
              id: excelInfo.cardId,
              data: {
                title: `卡片${excelInfo.cardId}`,
                options: [],
                selectedValue: null,
                selectOptions: []
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
          
          const card = cardMap.get(excelInfo.cardId)
          card.data.options.push({
            id: excelInfo.optionId,
            name: parsedData.name || `选项${excelInfo.optionId}`,
            value: parsedData.value || '',
            unit: parsedData.unit || '',
            checked: false // 子模式默认未勾选
          })
        }
        
      } catch (parseError) {
        console.error(`[子模式] 解析数据失败:`, key, parseError)
      }
    })
    
    // 转换为数组并按卡片ID排序
    const cardsArray = Array.from(cardMap.values()).sort((a, b) => {
      return idService.compareCardIds(a.id, b.id)
    })
    
    // 对每张卡片的选项按ID排序
    cardsArray.forEach(card => {
      card.data.options.sort((a, b) => parseInt(a.id) - parseInt(b.id))
    })
    
    cards.value = cardsArray
    console.log(`[子模式] 成功构建 ${cardsArray.length} 张卡片`)
    
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

// 卡片操作方法
const selectCard = (id) => {
  selectedCardId.value = id
}

const toggleTitleEditing = () => {
  if (selectedCardId.value) {
    const card = cards.value.find(c => c.id === selectedCardId.value)
    if (card) {
      card.isTitleEditing = !card.isTitleEditing
    }
  }
}

const toggleSelectEditing = () => {
  if (selectedCardId.value) {
    const card = cards.value.find(c => c.id === selectedCardId.value)
    if (card) {
      card.isSelectEditing = !card.isSelectEditing
    }
  }
}

const toggleEditableField = (field) => {
  if (selectedCardId.value) {
    const card = cards.value.find(c => c.id === selectedCardId.value)
    if (card && card.editableFields) {
      card.editableFields[field] = !card.editableFields[field]
    }
  }
}

const handleAddOption = (cardId, afterId) => {
  console.log(`添加选项到卡片 ${cardId}，在 ${afterId} 之后`)
  // 实际实现中应该添加选项到指定卡片
}

const handleDeleteOption = (cardId, optionId) => {
  console.log(`从卡片 ${cardId} 删除选项 ${optionId}`)
  // 实际实现中应该从指定卡片删除选项
}

const handleAddSelectOption = (cardId, label) => {
  console.log(`添加下拉选项到卡片 ${cardId}: ${label}`)
  // 实际实现中应该添加下拉选项到指定卡片
}

const handleDeleteSelectOption = (cardId, optionId) => {
  console.log(`从卡片 ${cardId} 删除下拉选项 ${optionId}`)
  // 实际实现中应该从指定卡片删除下拉选项
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
  padding: 20px 40px;
  box-sizing: border-box;
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
  font-size: 16px;
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

/* 响应式卡片布局：根据卡片固定宽度自然换行（与CardSection.vue一致） */
/* 卡片固定宽度240px，浏览器会自动根据容器宽度换行 */
/* 大屏幕：每行约7-8个卡片，中等屏幕：每行约4-5个卡片，小屏幕：每行约2-3个卡片 */

/* PC端大屏幕优化 */
@media (min-width: 1200px) {
  .sub-mode {
    padding: 30px 60px;
  }
  
  .bar:not(.mode-info-bar) {
    padding: 18px 25px;
    gap: 25px;
  }
}

@media (min-width: 1600px) {
  .sub-mode {
    padding: 40px 80px;
  }
}
</style>