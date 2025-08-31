<!--
  SubMode.vue - 子模式组件（非root_admin模式）
  
  其他模式或者非root_admin模式，子模式，也就是使用SubMode.vue为模板的模式，谨记：
  1.没有删除卡片功能，没有添加卡片功能，没有编辑预设功能，没有编辑下拉菜单功能，所以这四个功能代码统统删除，
  2.硬编码的方式隐藏下拉菜单加减按钮，选项加减按钮，也就是没有添加选项和删除选项功能
  3.同步原值显示卡片标题，但是无编辑卡片标题功能
  4.固定显示选项复选框并拥有其功能，无法隐藏复选框
  5.虽然无法编辑（编辑是指添加和删除下拉选项）下拉菜单和预设，但是可以使用应用配置好的相关下拉菜单选项，只是无法编辑添加和删除下拉选项，但是可以选择展示已有的下拉选项。
  6.只拥有选项名称，选项值，选项单位三个字段的编辑功能，但是使用这个功能的权限也需要外部或者主模式root_admin下的src\components\PermissionPushValve.vue授权，才能使用。
  
  关于相关授权同步两个功能，专门有"权限控制系统完整实现总结.md"和"权限控制系统修复日志.md"两个文档，说得很清楚，就不在此赘述。
-->

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
          'hide-option-actions': true
        }"
        @click.stop="selectCard(card.id)"
        @keydown.enter.stop.prevent="handleEnterOnCard(card, $event)"
        @dblclick.stop="handleDblclickOnCard(card, $event)"
      >
        <UniversalCard
          v-model:modelValue="card.data.title"
          v-model:options="card.data.options"
          v-model:selectedValue="card.data.selectedValue"
          :selectOptions="card.data.selectOptions"
          :showDropdown="card.showDropdown"
          :isTitleEditing="false"
          :isOptionsEditing="false"
          :isSelectEditing="false"
          :editableFields="{
            ...card.editableFields,
            optionActions: true
          }"
          :editDefaults="computeEditDefaults()"
          :editState="computeEditState(card)"
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
import { Serialization } from '../Data/store-parts/serialization.js'

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

// 卡片数据（从 store 获取，基于五段Key系统的LocalStorage）
const cards = computed(() => cardStore.sessionCards)
const selectedCardId = ref(null)

// 自动加载相关
const loadingData = ref(false)
const availableVersionsCount = ref(0)

// 添加缺失的响应式变量
const submittingAnswers = ref(false)
const generatingMatch = ref(false)
const matchResult = ref(null)
// 权限配置与运行期编辑门
const currentPermissionConfig = ref({})
const runtimeEditGate = ref({})

// 清理函数
let cleanupListener = null
let removeStorageListener = null

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
  
  // 从本地存储加载卡片数据（基于五段Key系统）
  loadCardData()

  // 监听其它标签/主模式的写入，自动刷新本模式数据/权限
  const onStorage = (e) => {
    try {
      if (!e.key) return
      const parsed = idService.parseKey(e.key)
      if (!parsed.valid) return
      if (parsed.modeId !== modeId.value) return

      // 本模式 envFull 有更新 → 重新加载（取最新版本）
      if (parsed.type === idService.TYPES.ENV_FULL) {
        console.log('[子模式] 侦测到 envFull 更新，自动刷新')
        refreshAndLoadLatest()
        return
      }
      // 本模式权限文档有更新 → 按当前版本重载权限呈现
      if (parsed.type === idService.TYPES.META && parsed.excelId === 'permissions') {
        console.log('[子模式] 侦测到权限(@meta:permissions)更新，自动刷新当前版本权限')
        if (currentVersion.value) loadVersionData(currentVersion.value)
      }
    } catch {}
  }
  window.addEventListener('storage', onStorage)
  // 记录清理函数
  removeStorageListener = () => window.removeEventListener('storage', onStorage)
})

// 组件卸载时清理监听器
onUnmounted(() => {
  if (cleanupListener) {
    cleanupListener()
  }
  // 清理 window.storage 监听
  try { removeStorageListener && removeStorageListener() } catch {}
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
  // 新数据直接覆盖旧数据
  cardStore.sessionCards = data.cards || []
  console.log('卡片数据已更新:', cardStore.sessionCards)
}

// 加载卡片数据（自动检测自己模式ID下的全量区类型数据）
const loadCardData = async () => {
  loadingData.value = true

  try {
    console.log(`[子模式] 开始自动检测模式 ${modeId.value} 下的全量区类型推送数据`)

    // 使用 serialization.js 列出当前模式的所有 envFull 快照（已按时间戳倒序）
    const snapshots = await Serialization.listEnvFullSnapshots({
      ...cardStore,
      currentModeId: modeId.value
    })
    availableVersionsCount.value = snapshots.length
    console.log(`[子模式] 模式 ${modeId.value} 下找到 ${snapshots.length} 个全量区版本:`, snapshots.map(s => s.version))

    if (snapshots.length === 0) {
      console.log(`[子模式] 模式 ${modeId.value} 没有 envFull 数据，请等待主模式推送`)
      cardStore.sessionCards = []
      currentVersion.value = null
      syncStatus.value = '暂无数据'
      return
    }

    // 取最新（时间戳最大，listEnvFullSnapshots 已经倒序，取第一个）
    const targetVersion = snapshots[0].version
    console.log(`[子模式] 自动加载最新全量区版本: ${targetVersion}`)

    // 3) 加载指定版本的数据（本模式）
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

// 加载指定版本的数据（本模式 + 版本）
const loadVersionData = async (version) => {
  try {
    console.log(`\n=== [子模式权限] 开始加载权限配置 ===`)
    // 1) 新规范读取：@meta:permissions（你已在 store.js 改好）
    const permissionConfig = cardStore.loadPermissionConfig(modeId.value, version)
    console.log(`[子模式权限] 权限配置:`, permissionConfig)
    // 保存当前版本的权限配置
    currentPermissionConfig.value = permissionConfig || {}
    
    // 初始化运行期编辑门：有授权的字段初始就打开编辑
    runtimeEditGate.value = {}
    Object.entries(currentPermissionConfig.value).forEach(([excelId, p]) => {
      runtimeEditGate.value[excelId] = {
        name: !!p?.name?.auth,
        value: !!p?.value?.auth,
        unit: !!p?.unit?.auth
      }
    })

    // 2) 读取本模式的 envFull 快照（A0 唯一条目），用 serialization.js 反序列化
    const storage = Serialization._internal.resolveStorage(cardStore) || (typeof window !== 'undefined' ? window.localStorage : null)
    const key = Serialization._internal.storageKeyForEnv({
      currentModeId: modeId.value,
      currentVersion: version
    })
    const envData = Serialization._internal.getJSON(storage, key)

    if (!envData || !envData.environment) {
      console.warn(`[子模式] 版本 ${version} 环境数据缺失或不完整`)
      return false
    }
    console.log(`[子模式] 成功加载环境数据(本模式 via serialization.js):`, envData)

    // 3) 从环境数据中构建卡片结构
    const cardMap = new Map()
    const environment = envData.environment || {}
    const envCards = environment.cards || {}
    const envOptions = environment.options || {}

    // 卡片
    Object.entries(envCards).forEach(([cardId, cardData]) => {
      if (!idService.isValidCardId(cardId)) {
        console.warn(`[子模式] 跳过无效卡片ID: ${cardId}`)
        return
      }
      if (!cardMap.has(cardId)) {
        cardMap.set(cardId, {
          id: cardId,
          data: {
            title: cardData.title || `卡片${cardId}`,
            options: [],
            selectedValue: null,
            selectOptions: (cardData.dropdown || []).map((item, index) => ({
              id: index + 1, label: item || ''
            }))
          },
          editableFields: {
            optionName: false,
            optionValue: false,
            optionUnit: false,
            optionCheckbox: true,  // 子模式总是显示复选框
            optionActions: false   // 子模式隐藏加减按钮
          },
          showDropdown: false,
          isTitleEditing: false,
          isOptionsEditing: false,
          isSelectEditing: false,
          isPresetEditing: false
        })
      }
    })

    // 选项
    Object.entries(envOptions).forEach(([fullId, optionData]) => {
      const excelInfo = idService.splitExcelId(fullId)
      if (excelInfo.kind !== 'option') return
      const cardId = excelInfo.cardId

      if (!cardMap.has(cardId)) {
        cardMap.set(cardId, {
          id: cardId,
          data: { title: `卡片${cardId}`, options: [], selectedValue: null, selectOptions: [] },
          editableFields: {
            optionName: false, optionValue: false, optionUnit: false,
            optionCheckbox: true, optionActions: false
          },
          showDropdown: false,
          isTitleEditing: false,
          isOptionsEditing: false,
          isSelectEditing: false,
          isPresetEditing: false
        })
      }

      const card = cardMap.get(cardId)
      // 应用“授权 > 同步”：
      // - auth=true → 空白可编辑
      // - sync=true, auth=false → 显示原值但只读
      // - 都为 false → 空值只读
      const processedOptionData = applyPermissionLogic(fullId, optionData || {}, permissionConfig)

      card.data.options.push({
        id: excelInfo.optionId,
        name: processedOptionData.name,
        value: processedOptionData.value,
        unit: processedOptionData.unit,
        checked: false // 默认未勾选
      })
    })

    // 排序与权限应用
    const cardsArray = Array.from(cardMap.values()).sort((a, b) => idService.compareCardIds(a.id, b.id))
    cardsArray.forEach(card => {
      card.data.options.sort((a, b) => parseInt(a.id) - parseInt(b.id))
      applyCardPermissions(card, permissionConfig)
    })

    // 保存到 store
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

// 为卡片应用权限控制（选项级别精细化独立控制 + 子模式功能限制）
const applyCardPermissions = (card, permissionConfig) => {
  console.log(`[子模式权限] 为卡片 ${card.id} 应用选项级别精细化权限控制`)
  
  // 选项级别的精细化权限控制
  card.data.options.forEach(option => {
    const excelId = `${card.id}${option.id}`
    const permissions = permissionConfig[excelId]
    
    if (permissions) {
      // 为每个选项单独设置字段级别的编辑权限
      option.editableFields = {
        optionName: permissions.name?.auth || false,   // 选项名称：独立控制
        optionValue: permissions.value?.auth || false, // 选项值：独立控制  
        optionUnit: permissions.unit?.auth || false,   // 选项单位：独立控制
      }
      
      console.log(`[子模式权限] ${excelId} 精细化权限:`, {
        名称可编辑: permissions.name?.auth ? '✅' : '❌',
        值可编辑: permissions.value?.auth ? '✅' : '❌',
        单位可编辑: permissions.unit?.auth ? '✅' : '❌'
      })
      
      // 将完整权限信息附加到选项上
      option.permissions = permissions
    } else {
      // 没有权限配置的选项，默认只读
      option.editableFields = {
        optionName: false,
        optionValue: false,
        optionUnit: false
      }
      console.log(`[子模式权限] ${excelId} 无权限配置，设为只读`)
    }
  })
  
  // 卡片级别的全局控制
  card.editableFields = {
    optionCheckbox: true,      // 复选框：子模式总是显示
    optionActions: false,      // 加减按钮：子模式硬编码隐藏
    select: true               // 下拉选择器：保持原生功能
  }
  
  // 确保编辑状态都被禁用
  card.isTitleEditing = false  // 无编辑标题功能
  card.isOptionsEditing = false // 无编辑选项功能  
  card.isSelectEditing = false // 无编辑下拉功能
  card.isPresetEditing = false // 无编辑预设功能
  
  // 统计并输出权限汇总
  const optionSummary = card.data.options.map(option => {
    const excelId = `${card.id}${option.id}`
    const fields = option.editableFields || {}
    const authFields = []
    if (fields.optionName) authFields.push('名称')
    if (fields.optionValue) authFields.push('值')
    if (fields.optionUnit) authFields.push('单位')
    return `${excelId}(${authFields.length > 0 ? authFields.join(',') : '只读'})`
  })
  
  console.log(`[子模式权限] 卡片 ${card.id} 选项级别权限汇总: ${optionSummary.join(', ')}`)
}

// 编辑状态默认值
function computeEditDefaults() {
  return { name: false, value: false, unit: false }
}

// 计算编辑状态（权限上限 AND 运行期开关）
function computeEditState(card) {
  const perms = currentPermissionConfig.value || {}
  const gate = runtimeEditGate.value || {}
  const state = {}
  const opts = Array.isArray(card?.data?.options) ? card.data.options : []
  opts.forEach(opt => {
    const excelId = `${card.id}${opt.id}`
    const a = perms[excelId] || {}
    const r = gate[excelId] || {}
    state[opt.id] = {
      name: (!!a?.name?.auth) && (!!r?.name),
      value: (!!a?.value?.auth) && (!!r?.value),
      unit: (!!a?.unit?.auth) && (!!r?.unit)
    }
  })
  return state
}

// 从事件中获取选项上下文信息
function getOptionCtxFromEvent(card, evt) {
  const t = evt?.target
  if (!t || !t.classList) return null

  // 判定字段
  let field = null
  const cls = t.classList
  if (cls.contains('option-name-input') || cls.contains('option-name')) field = 'name'
  else if (cls.contains('option-value-input') || cls.contains('option-value')) field = 'value'
  else if (cls.contains('option-unit-input') || cls.contains('option-unit')) field = 'unit'
  if (!field) return null

  // 找到所在 option 容器与其在 options-list 中的索引
  const optionEl = t.closest('.option')
  if (!optionEl) return null
  const optionsList = optionEl.parentElement // .options-list
  if (!optionsList) return null
  const items = Array.from(optionsList.children).filter(el => el.classList && el.classList.contains('option'))
  const index = items.indexOf(optionEl)
  if (index < 0) return null

  const option = Array.isArray(card?.data?.options) ? card.data.options[index] : null
  if (!option) return null
  const optionId = option.id
  const excelId = `${card.id}${optionId}`
  return { field, optionId, excelId }
}

// 处理卡片上的回车事件
function handleEnterOnCard(card, evt) {
  const ctx = getOptionCtxFromEvent(card, evt)
  if (!ctx) return
  // 必须有授权才响应
  const auth = currentPermissionConfig.value?.[ctx.excelId]?.[ctx.field]?.auth
  if (!auth) return
  if (!runtimeEditGate.value[ctx.excelId]) {
    runtimeEditGate.value[ctx.excelId] = { name: false, value: false, unit: false }
  }
  // 收起输入框 -> 展示态；值已通过 v-model 保存到会话
  runtimeEditGate.value[ctx.excelId][ctx.field] = false
}

// 处理卡片上的双击事件
function handleDblclickOnCard(card, evt) {
  const ctx = getOptionCtxFromEvent(card, evt)
  if (!ctx) return
  // 仅在有授权时允许进入编辑态
  const auth = currentPermissionConfig.value?.[ctx.excelId]?.[ctx.field]?.auth
  if (!auth) return
  if (!runtimeEditGate.value[ctx.excelId]) {
    runtimeEditGate.value[ctx.excelId] = { name: false, value: false, unit: false }
  }
  runtimeEditGate.value[ctx.excelId][ctx.field] = true
}

// === 子模式允许的操作（仅选择卡片和下拉框切换）===

// 选择卡片
const selectCard = (id) => {
  selectedCardId.value = id
}

// 设置下拉框显示状态（允许切换已有下拉选项）
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
    
    // 使用id.js系统构建存储Key
    const storageKey = idService.buildKey({
      prefix: idService.getSystemPrefix(),
      modeId: modeId.value,
      version: currentVersion.value || 'default',
      type: idService.TYPES.ANSWERS, // 使用id.js系统的答案类型
      excelId: 'user_submission'
    })
    
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

/* 仅隐藏"加/减按钮"，不影响名称/值/单位输入框 */
:deep(.hide-option-actions .option-actions) {
  display: none !important;
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
