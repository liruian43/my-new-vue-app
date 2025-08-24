<template>
  <div class="sub-mode">
    <!-- 第一部分：模式信息区 -->
    <div class="mode-info-bar">
      <h2>{{ modeInfo.name }} ({{ modeId }})</h2>
      <p>基于 root_admin 模式创建</p>
      <div class="sync-status">
        <span>同步状态: {{ syncStatus }}</span>
        <span v-if="lastSyncTime">上次同步: {{ lastSyncTime }}</span>
        <span v-if="currentVersion">当前版本: {{ currentVersion }}</span>
      </div>
    </div>

    <!-- 第二部分：卡片操作区（复刻CardSection.vue） -->
    <div class="card-section">
      <!-- 卡片操作按钮区域 -->
      <div class="bar ops-bar">
        <button 
          class="test-button" 
          @click="toggleTitleEditing"
          :disabled="!selectedCardId"
          :class="{ active: selectedCard?.isTitleEditing }"
        >
          {{ selectedCard?.isTitleEditing ? "完成编辑" : "编辑标题" }}
        </button>

        <button
          class="test-button"
          @click="toggleSelectEditing"
          :disabled="!selectedCardId || selectedCard?.isPresetEditing"
          :class="{ active: selectedCard?.isSelectEditing && !selectedCard?.isPresetEditing }"
        >
          {{ selectedCard?.isSelectEditing ? "完成下拉编辑" : "编辑下拉菜单" }}
        </button>

        <button
          class="test-button"
          @click="() => toggleEditableField('optionName')"
          :disabled="!selectedCardId || selectedCard?.isPresetEditing"
          :class="{ active: selectedCard?.editableFields.optionName && !selectedCard?.isPresetEditing }"
        >
          {{ selectedCard?.editableFields.optionName ? "完成名称编辑" : "编辑选项名称" }}
        </button>

        <button
          class="test-button"
          @click="() => toggleEditableField('optionValue')"
          :disabled="!selectedCardId || selectedCard?.isPresetEditing"
          :class="{ active: selectedCard?.editableFields.optionValue && !selectedCard?.isPresetEditing }"
        >
          {{ selectedCard?.editableFields.optionValue ? "完成值编辑" : "编辑选项值" }}
        </button>

        <button
          class="test-button"
          @click="() => toggleEditableField('optionUnit')"
          :disabled="!selectedCardId || selectedCard?.isPresetEditing"
          :class="{ active: selectedCard?.editableFields.optionUnit && !selectedCard?.isPresetEditing }"
        >
          {{ selectedCard?.editableFields.optionUnit ? "完成单位编辑" : "编辑选项单位" }}
        </button>

        <button
          class="test-button"
          @click="() => toggleEditableField('optionCheckbox')"
          :disabled="!selectedCardId || selectedCard?.isPresetEditing"
          :class="{ active: selectedCard?.editableFields.optionCheckbox && !selectedCard?.isPresetEditing }"
        >
          {{ selectedCard?.editableFields.optionCheckbox ? "隐藏选项复选框" : "显示选项复选框" }}
        </button>
      </div>

      <!-- 卡片列表 -->
      <div class="cards-container">
        <div
          v-for="card in cards"
          :key="card.id"
          class="card-wrapper"
          :class="{
            selected: selectedCardId === card.id,
            'hide-option-actions': !card.editableFields.optionActions || card.isPresetEditing
          }"
          @click.stop="selectCard(card.id)"
        >
          <UniversalCard
            v-model:modelValue="card.data.title"
            v-model:options="card.data.options"
            v-model:selectedValue="card.data.selectedValue"
            :selectOptions="card.data.selectOptions"
            :showDropdown="card.showDropdown || card.isPresetEditing"
            :isTitleEditing="card.isTitleEditing"
            :isOptionsEditing="card.isPresetEditing || card.isOptionsEditing"
            :isSelectEditing="card.isPresetEditing || card.isSelectEditing"
            :on-add-option="(afterId) => handleAddOption(card.id, afterId)"
            :on-delete-option="(optionId) => handleDeleteOption(card.id, optionId)"
            :on-add-select-option="(label) => handleAddSelectOption(card.id, label)"
            :on-delete-select-option="(optionId) => handleDeleteSelectOption(card.id, optionId)"
            :on-dropdown-toggle="(value) => setShowDropdown(card.id, value)"
            :editableFields="{
              ...card.editableFields,
              optionActions: card.editableFields.optionActions && !card.isPresetEditing,
              optionCheckbox: card.editableFields.optionCheckbox || card.isPresetEditing
            }"
            :class="{ selected: selectedCardId === card.id }"
            :style="{}"
          />
        </div>
      </div>
    </div>

    <!-- 第三部分：匹配反馈区 -->
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

// 选中的卡片
const selectedCardId = ref(null)
const selectedCard = computed(() => {
  return cards.value.find(card => card.id === selectedCardId.value) || null
})

// 匹配相关
const generatingMatch = ref(false)
const matchResult = ref(null)

// 清理函数
let cleanupListener = null

// 初始化
onMounted(() => {
  // 初始化模式信息
  modeInfo.value.name = `模式-${modeId.value}`
  
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

// 加载卡片数据
const loadCardData = () => {
  // 模拟加载数据
  // 实际实现中应该从本地存储根据modeId加载数据
  console.log(`加载模式 ${modeId.value} 的卡片数据`)
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
  padding: 20px;
}

/* 第一部分：模式信息区 */
.mode-info-bar {
  border: 1px solid #ddd;
  background-color: #f5f5f5;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.mode-info-bar h2 {
  margin: 0 0 10px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-status {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: #666;
}

/* 第二部分：卡片操作区（复刻CardSection.vue样式） */
.card-section {
  margin-bottom: 20px;
}

.bar {
  margin-bottom: 12px;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.test-button {
  margin: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
}

.test-button.active {
  background-color: #2196f3;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

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

:deep(.hide-option-actions .option-actions) {
  display: none !important;
}

/* 第三部分：匹配反馈区 */
.match-bar {
  justify-content: center;
}

.generate-button {
  background-color: #ff9800;
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
</style>