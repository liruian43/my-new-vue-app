// src/components/Data/store-parts/rootMode.js

export function initRootMode(store) {
  const storedRootConfig = localStorage.getItem('root_mode_config')
  if (storedRootConfig) {
    try {
      const config = JSON.parse(storedRootConfig)
      store.rootMode.cardData = config.cardData || []
      if (config.dataStandards) {
        store.rootMode.dataStandards = { ...store.rootMode.dataStandards, ...config.dataStandards }
      }
    } catch (e) { console.error('加载主模式配置失败:', e) }
  }
  // 兜底：确保 tempOperations 存在
  if (!store.rootMode) store.rootMode = {}
  if (!store.rootMode.tempOperations || typeof store.rootMode.tempOperations !== 'object') {
    store.rootMode.tempOperations = {
      currentEditingQuestion: null,
      configStep: 0,
      validationStatus: {},
      unsavedHistory: []
    }
  }
  if (!Array.isArray(store.rootMode.tempOperations.unsavedHistory)) {
    store.rootMode.tempOperations.unsavedHistory = []
  }
}

export function saveDataStandards(store, standards) {
  store.rootMode.dataStandards = { ...store.rootMode.dataStandards, ...standards }
  localStorage.setItem('root_mode_config', JSON.stringify({
    cardData: store.rootMode.cardData, dataStandards: store.rootMode.dataStandards
  }))
  return store.rootMode.dataStandards
}

export function recordRootTempOperation(store, actionType, data) {
  // 兜底初始化，避免未定义
  if (!store.rootMode) store.rootMode = {}
  if (!store.rootMode.tempOperations || typeof store.rootMode.tempOperations !== 'object') {
    store.rootMode.tempOperations = {
      currentEditingQuestion: null,
      configStep: 0,
      validationStatus: {},
      unsavedHistory: []
    }
  }
  if (!Array.isArray(store.rootMode.tempOperations.unsavedHistory)) {
    store.rootMode.tempOperations.unsavedHistory = []
  }

  store.rootMode.tempOperations.unsavedHistory.push({
    id: Date.now(), actionType, data, timestamp: new Date().toISOString()
  })
  if (store.rootMode.tempOperations.unsavedHistory.length > 100) {
    store.rootMode.tempOperations.unsavedHistory.shift()
  }
}

export function clearRootTempData(store) {
  store.rootMode.tempOperations = {
    currentEditingQuestion: null, configStep: 0, validationStatus: {}, unsavedHistory: []
  }
}

export function updateRootConfigStep(store, step, validationStatus = {}) {
  store.rootMode.tempOperations.configStep = step
  store.rootMode.tempOperations.validationStatus = validationStatus
}

export function compareCardIds(store, id1, id2) {
  return store.dataManager.compareCardIds(id1, id2)
}

// 关键：只看当前操作台（会话+临时），确保 A/B/C…顺序
export function getAllUsedCardIds(store) {
  const set = new Set()
  ;(store.sessionCards || []).forEach(c => c?.id && set.add(c.id))
  ;(store.tempCards || []).forEach(c => c?.id && set.add(c.id))
  return set
}

export function generateNextCardId(store) {
  const used = getAllUsedCardIds(store)
  return store.dataManager.generateNextCardId(used)
}

export function generateNextOptionId(store, cardId) {
  if (!store.isValidCardId(cardId)) { console.error(`卡片ID ${cardId} 不符合标准格式`); return '1' }
  const options = store.getOptionsByCardId(cardId)
  const existingIds = options.map(opt => opt.id)
  return store.dataManager.generateNextOptionId(existingIds)
}

// 对外标准接口
export function generateCardId(store) { return generateNextCardId(store) }
export function generateOptionId(store, cardId) { return generateNextOptionId(store, cardId) }