// src/components/Data/store-parts/cards.js
// 会话卡片/临时卡片/选项/下拉/编辑态/导入导出等
// 合并版本：保留原A.js拆分版本和B.js拆分版本的所有功能

import { normalizeDataStructure } from './normalize';
// 导入新的ID生成服务
import { generateNextCardId } from '../services/id.js';

// 从store中获取下一个可用的卡片ID（仅使用新方法）
function nextCardIdFromStore(store) {
  // 提取当前所有已使用的卡片ID（包括会话卡片、临时卡片和中期存储卡片）
  const used = new Set(
    [
      ...(store.sessionCards || []),
      ...(store.tempCards || []),
      ...(store.mediumCards || [])
    ]
      .map(c => (c.id || '').toString().toUpperCase())
      .filter(Boolean)
  );
  return generateNextCardId(used);
}

// ================ 新增内容（来自新拆分版本） ================
export const CARD_DATA_TEMPLATE = {
  title: null,
  options: [{ name: null, value: null, unit: null }],
  selectOptions: [],
  syncStatus: {
    title: { hasSync: false, isAuthorized: false },
    options: {
      name: { hasSync: false, isAuthorized: false },
      value: { hasSync: false, isAuthorized: false },
      unit: { hasSync: false, isAuthorized: false }
    },
    selectOptions: { hasSync: true, isAuthorized: false }
  }
};

export function normalizeCardForStorage(card) {
  return normalizeDataStructure(card, {
    id: '',
    modeId: '',
    storageLevel: '',
    isTitleEditing: false,
    isOptionsEditing: false,
    isSelectEditing: false,
    isPresetEditing: false,
    showDropdown: false,
    syncStatus: CARD_DATA_TEMPLATE.syncStatus,
    data: CARD_DATA_TEMPLATE,
    editableFields: {}
  });
}

// ================ 原有内容（来自上个版本） ================

// 工具：把某卡片的选项 id 强制重排为 1..N（字符串）
function renumberOptions1toN(card) {
  const opts = Array.isArray(card?.data?.options) ? card.data.options : []
  opts.forEach((o, i) => { o.id = String(i + 1) })
}

// 工具：按 1..N 重建某卡在 environmentConfigs.options 下的 A1/A2… 映射
function rebuildEnvOptionsForCard(store, cardId, card) {
  const cid = String(cardId)
  // 先清空该卡原有的 A* 项
  Object.keys(store.environmentConfigs.options || {}).forEach(fullId => {
    if (fullId.startsWith(cid)) delete store.environmentConfigs.options[fullId]
  })
  // 再按 1..N 写入
  const opts = Array.isArray(card?.data?.options) ? card.data.options : []
  opts.forEach((o, i) => {
    const fullId = `${cid}${i + 1}`
    store.environmentConfigs.options[fullId] = {
      name: o?.name ?? null,
      value: o?.value ?? null,
      unit: o?.unit ?? null
    }
  })
}

export function loadSessionCards(store, modeId) {
  const rawCards = store.sessionStorageEnhancer.load(modeId, 'cards') || []
  store.sessionCards = rawCards.map(card => normalizeCardStructure(store, card))
}

export function normalizeCardStructure(store, card) {
  const normalizeOptions = (options) => {
    const list = Array.isArray(options) ? options : []
    // 强制：忽略外部传入的 id，按位置编号为 1..N（字符串）
    return list.map((opt, idx) => ({ ...opt, id: String(idx + 1) }))
  }
  const normalizeSelectOptions = (options) => {
    const list = Array.isArray(options) ? options : []
    return list.map((opt, idx) => {
      const idStr = (opt && typeof opt.id !== 'undefined') ? String(opt.id) : String(idx + 1)
      const numeric = /^\d+$/.test(idStr) ? idStr : String(idx + 1)
      return { ...opt, id: numeric, label: opt?.label ?? null }
    })
  }

  // 完全使用新的ID生成方式，不依赖旧方法
  let cardId = card.id
  if (!cardId || !store.rootMode.dataStandards.cardIdPattern.test(cardId)) {
    cardId = nextCardIdFromStore(store);
  }

  return {
    id: cardId,
    modeId: card.modeId || store.currentModeId,
    storageLevel: card.storageLevel || 'session',
    isTitleEditing: card.isTitleEditing ?? false,
    isOptionsEditing: card.isOptionsEditing ?? false,
    isSelectEditing: card.isSelectEditing ?? false,
    isPresetEditing: card.isPresetEditing ?? false,
    showDropdown: card.showDropdown ?? false,
    syncStatus: {
      title: {
        hasSync: card.syncStatus?.title?.hasSync ?? false,
        isAuthorized: card.syncStatus?.title?.isAuthorized ?? false
      },
      options: {
        name: {
          hasSync: card.syncStatus?.options?.name?.hasSync ?? false,
          isAuthorized: card.syncStatus?.options?.name?.isAuthorized ?? false
        },
        value: {
          hasSync: card.syncStatus?.options?.value?.hasSync ?? false,
          isAuthorized: card.syncStatus?.options?.value?.isAuthorized ?? false
        },
        unit: {
          hasSync: card.syncStatus?.options?.unit?.hasSync ?? false,
          isAuthorized: card.syncStatus?.options?.unit?.isAuthorized ?? false
        }
      },
      selectOptions: {
        hasSync: card.syncStatus?.selectOptions?.hasSync ?? true,
        isAuthorized: card.syncStatus?.selectOptions?.isAuthorized ?? false
      }
    },
    data: {
      title: card.data?.title ?? null,
      options: normalizeOptions(card.data?.options),
      selectOptions: normalizeSelectOptions(card.data?.selectOptions),
      selectedValue: card.data?.selectedValue ?? null,
      uiConfig: card.data?.uiConfig || {},
      scoreRules: card.data?.scoreRules || []
    },
    editableFields: {
      ...{
        optionName: true,
        optionValue: true,
        optionUnit: true,
        optionCheckbox: true,
        optionActions: true,
        select: true
      },
      ...card.editableFields
    }
  }
}

export function addCard(store, cardData) {
  // 完全移除旧的ID生成方法，只使用新服务
  let newCardId = null
  const requestedId = cardData?.id

  // 检查请求的ID是否有效且未被使用
  if (requestedId && store.isValidCardId(requestedId)) {
    const usedIds = new Set(
      [
        ...(store.sessionCards || []),
        ...(store.tempCards || []),
        ...(store.mediumCards || [])
      ]
        .map(c => c.id)
        .filter(Boolean)
    );
    
    if (!usedIds.has(requestedId)) {
      newCardId = requestedId
    } else {
      // 请求的ID已被使用，生成新的ID
      newCardId = nextCardIdFromStore(store);
    }
  } else {
    // 生成新的卡片ID
    newCardId = nextCardIdFromStore(store);
  }

  const normalized = normalizeCardStructure(store, {
    ...cardData,
    storageLevel: 'session',
    id: newCardId
  })

  store.sessionCards.push(normalized)

  store.environmentConfigs.cards[newCardId] = {
    id: newCardId,
    name: normalized.data.title ?? null,
    dropdown: (normalized.data.selectOptions || []).map(opt => opt?.label ?? null)
  }

  // 关键：用 1..N 重建 A1/A2… 映射
  rebuildEnvOptionsForCard(store, newCardId, normalized)

  store.selectedCardId = newCardId

  if (store.isRootMode) {
    store.recordRootTempOperation('add_card', { cardId: newCardId })
  }

  store.notifyEnvConfigChanged()
  return normalized
}

export function deleteCard(store, cardId) {
  store.tempCards = store.tempCards.filter(c => c.id !== cardId)
  store.sessionCards = store.sessionCards.filter(c => c.id !== cardId)
  store.saveSessionCards(store.currentModeId)
  store.removeFromMedium([cardId])

  if (store.environmentConfigs.cards[cardId]) {
    delete store.environmentConfigs.cards[cardId]
    Object.keys(store.environmentConfigs.options).forEach(fullId => {
      if (fullId.startsWith(cardId)) delete store.environmentConfigs.options[fullId]
    })
  }
  if (store.presetMappings[cardId]) {
    delete store.presetMappings[cardId]
    store.savePresetMappings()
  }
  if (store.selectedCardId === cardId) store.selectedCardId = null

  if (store.isRootMode) {
    store.recordRootTempOperation('delete_card', { cardId })
  }
  store.notifyEnvConfigChanged()
}

export function updateSessionCard(store, updatedCard) {
  const idx = store.sessionCards.findIndex(c => c.id === updatedCard.id)
  if (idx !== -1) {
    store.sessionCards[idx] = normalizeCardStructure(store, {
      ...store.sessionCards[idx],
      ...updatedCard
    })
    const cid = updatedCard.id
    if (store.environmentConfigs.cards[cid]) {
      store.environmentConfigs.cards[cid] = {
        ...store.environmentConfigs.cards[cid],
        name: store.sessionCards[idx].data?.title ?? null,
        dropdown: (store.sessionCards[idx].data?.selectOptions || []).map(opt => opt?.label ?? null)
      }
      store.notifyEnvConfigChanged()
    }
    if (store.isRootMode) {
      store.recordRootTempOperation('update_card', { cardId: cid })
    }
    return store.sessionCards[idx]
  }
  return null
}

export function updateCardTitle(store, cardId, newTitle) {
  const tIdx = store.tempCards.findIndex(c => c.id === cardId)
  if (tIdx !== -1) {
    store.tempCards[tIdx].data.title = newTitle
    return store.tempCards[tIdx]
  }
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) {
    store.sessionCards[sIdx].data.title = newTitle
    if (store.environmentConfigs.cards[cardId]) {
      store.environmentConfigs.cards[cardId].name = newTitle ?? null
      store.notifyEnvConfigChanged()
    }
    return store.sessionCards[sIdx]
  }
  return null
}

export function updateCardOptions(store, cardId, updatedOptions) {
  const assignTo = (card) => {
    // 强制重排为 1..N
    const safe = (Array.isArray(updatedOptions) ? updatedOptions : []).map((o, i) => ({ ...o, id: String(i + 1) }))
    card.data.options = safe

    // 统一重建环境映射（清 A* -> 写入 1..N）
    rebuildEnvOptionsForCard(store, cardId, card)
    store.notifyEnvConfigChanged()
    return card
  }
  const tIdx = store.tempCards.findIndex(c => c.id === cardId)
  if (tIdx !== -1) return assignTo(store.tempCards[tIdx])
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) return assignTo(store.sessionCards[sIdx])
  return null
}

export function addOption(store, cardId, afterId) {
  if (!store.isValidCardId(cardId)) {
    console.error(`卡片ID ${cardId} 不符合标准格式，无法添加选项`)
    return
  }

  const newOption = {
    id: '0', // 占位，稍后重排为 1..N
    name: null, value: null, unit: null,
    checked: false,
    localName: null, localValue: null, localUnit: null
  }

  const insertTo = (card) => {
    const options = Array.isArray(card.data.options) ? [...card.data.options] : []
    if (afterId) {
      const index = options.findIndex(o => o.id === afterId)
      if (index !== -1) options.splice(index + 1, 0, newOption)
      else options.push(newOption)
    } else {
      options.push(newOption)
    }
    card.data.options = options

    // 插入后重排 1..N，并重建 A1/A2…
    renumberOptions1toN(card)
    rebuildEnvOptionsForCard(store, cardId, card)
    store.notifyEnvConfigChanged()
  }

  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) {
    insertTo(tempCard)
  } else {
    const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
    if (sIdx !== -1) {
      insertTo(store.sessionCards[sIdx])
    }
  }
}

export function deleteOption(store, cardId, optionId) {
  if (!store.isValidCardId(cardId)) { console.error(`卡片ID ${cardId} 不符合标准格式`); return }
  if (!store.isValidOptionId(optionId)) { console.error(`选项ID ${optionId} 不符合标准格式`); return }

  const apply = (card) => {
    card.data.options = (Array.isArray(card.data.options) ? card.data.options : []).filter(o => o.id !== optionId)
    renumberOptions1toN(card)
    rebuildEnvOptionsForCard(store, cardId, card)
    store.notifyEnvConfigChanged()
  }

  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) return apply(tempCard)
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) apply(store.sessionCards[sIdx])
}

export function addSelectOption(store, cardId, label) {
  const pushTo = (card) => {
    const nextId = generateNextSelectOptionId(store, cardId)
    card.data.selectOptions.push({ id: nextId, label: label ?? null })
    if (store.environmentConfigs.cards[cardId]) {
      store.environmentConfigs.cards[cardId].dropdown =
        card.data.selectOptions.map(opt => opt.label ?? null)
      store.notifyEnvConfigChanged()
    }
  }
  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) return pushTo(tempCard)
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) pushTo(store.sessionCards[sIdx])
}

export function deleteSelectOption(store, cardId, optionId) {
  const removeFrom = (card) => {
    card.data.selectOptions = card.data.selectOptions.filter(o => o.id !== optionId)
    if (store.presetMappings[cardId] && store.presetMappings[cardId][optionId]) {
      delete store.presetMappings[cardId][optionId]
      store.savePresetMappings()
    }
    const stillExists = card.data.selectOptions.some(o => o.label === card.data.selectedValue)
    if (!stillExists) card.data.selectedValue = null
    if (store.environmentConfigs.cards[cardId]) {
      store.environmentConfigs.cards[cardId].dropdown =
        card.data.selectOptions.map(opt => opt.label ?? null)
      store.notifyEnvConfigChanged()
    }
  }
  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) return removeFrom(tempCard)
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) removeFrom(store.sessionCards[sIdx])
}

export function setShowDropdown(store, cardId, value) {
  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) { tempCard.showDropdown = value; return }
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) store.sessionCards[sIdx].showDropdown = value
}

export function generateNextSelectOptionId(store, cardId) {
  if (!store.isValidCardId(cardId)) {
    console.error(`卡片ID ${cardId} 不符合标准格式`)
    return '1'
  }
  const card = store.sessionCards.find(c => c.id === cardId) || store.tempCards.find(c => c.id === cardId)
  if (!card || !card.data.selectOptions.length) return '1'
  const maxSelectId = Math.max(...card.data.selectOptions.map(opt => parseInt(opt.id, 10)).filter(n => !Number.isNaN(n)))
  return String((maxSelectId || 0) + 1)
}

export function toggleSelectEditing(store, cardId) {
  const temp = store.tempCards.find(c => c.id === cardId)
  if (temp) { if (temp.isPresetEditing) return; temp.isSelectEditing = !temp.isSelectEditing; return }
  const card = store.sessionCards.find(c => c.id === cardId)
  if (card) { if (card.isPresetEditing) return; card.isSelectEditing = !card.isSelectEditing }
}

export function toggleTitleEditing(store, cardId) { return toggleTitleEditingForRoot(store, cardId) }

export function toggleTitleEditingForRoot(store, cardId) {
  const tIdx = store.tempCards.findIndex(c => c.id === cardId)
  if (tIdx !== -1) { store.tempCards[tIdx].isTitleEditing = !store.tempCards[tIdx].isTitleEditing; return }
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) {
    const card = store.sessionCards[sIdx]
    if (store.currentModeId === 'root_admin' || card.syncStatus.title.isAuthorized) {
      card.isTitleEditing = !card.isTitleEditing
    }
  }
}

export function toggleOptionsEditing(store, cardId) {
  const temp = store.tempCards.find(c => c.id === cardId)
  if (temp) { if (temp.isPresetEditing) return; temp.isOptionsEditing = !temp.isOptionsEditing; return }
  const card = store.sessionCards.find(c => c.id === cardId)
  if (card) {
    if (card.isPresetEditing) return
    let canEdit = false
    if (store.currentModeId === 'root_admin') canEdit = true
    else {
      canEdit =
        card.syncStatus.options.name.isAuthorized ||
        card.syncStatus.options.value.isAuthorized ||
        card.syncStatus.options.unit.isAuthorized
    }
    if (canEdit) card.isOptionsEditing = !card.isOptionsEditing
  }
}

export function togglePresetEditing(store, cardId) {
  const apply = (card) => {
    const entering = !card.isPresetEditing
    if (entering) {
      card.isPresetEditing = true
      card.isSelectEditing = true
      card.editableFields.optionCheckbox = true
      card.isOptionsEditing = false
      card.editableFields.optionName = false
      card.editableFields.optionValue = false
      card.editableFields.optionUnit = false
      card.editableFields.optionActions = false
    } else {
      const selectedOpt = card.data.selectOptions.find(opt => opt.label === card.data.selectedValue)
      if (selectedOpt) {
        const checkedOptions = card.data.options.filter(o => o.checked)
        store.savePresetForSelectOption(card.id, selectedOpt.id, checkedOptions)
      }
      card.data.options = card.data.options.map(o => ({ ...o, checked: false }))
      card.isPresetEditing = false
      card.isSelectEditing = false
      card.editableFields.optionActions = true
    }
  }
  const temp = store.tempCards.find(c => c.id === cardId)
  if (temp) return apply(temp)
  const sess = store.sessionCards.find(c => c.id === cardId)
  if (sess) return apply(sess)
}

export function toggleEditableField(store, cardId, field) {
  const temp = store.tempCards.find(c => c.id === cardId)
  if (temp) {
    if (temp.isPresetEditing) return
    temp.editableFields[field] = !temp.editableFields[field]
    return
  }
  const card = store.sessionCards.find(c => c.id === cardId)
  if (card) {
    if (card.isPresetEditing) return
    card.editableFields[field] = !card.editableFields[field]
  }
}

export function saveSessionCards(store, modeId) {
  if (!store.dataManager || !store.dataManager.validator) {
    console.error('数据管理器未正确初始化')
    store.error = '数据存储失败：内部错误'
    return false
  }
  const validation = store.dataManager.validator.validateConfig(store.sessionCards)
  if (validation.pass) {
    store.sessionStorageEnhancer.save(modeId, 'cards', validation.validCards)
    return true
  }
  return false
}

export function validateConfiguration(store) {
  return store.dataManager.validator.validateConfig(store.sessionCards)
}

export function loadAllMediumCards(store) {
  const storedData = localStorage.getItem('app_medium_cards')
  store.mediumCards = storedData ? JSON.parse(storedData) : []
}

export function saveToMedium(store) {
  const currentMode = store.currentMode
  if (!currentMode) return []

  const validation = store.dataManager.validator.validateConfig(store.sessionCards)
  if (!validation.pass) {
    store.error = '数据校验失败，无法保存到中期存储'
    console.error('中期存储校验失败:', validation.errors)
    return []
  }

  const mediumData = validation.validCards.map(card => ({
    ...card,
    modeId: currentMode.id,
    storedAt: new Date().toISOString()
  }))

  store.mediumCards = [
    ...store.mediumCards.filter(c => !(c.modeId === currentMode.id && mediumData.some(m => m.id === c.id))),
    ...mediumData
  ]

  localStorage.setItem('app_medium_cards', JSON.stringify(store.mediumCards))
  return mediumData
}

export function removeFromMedium(store, cardIds) {
  if (!cardIds || cardIds.length === 0) return
  store.mediumCards = store.mediumCards.filter(card => !cardIds.includes(card.id))
  localStorage.setItem('app_medium_cards', JSON.stringify(store.mediumCards))
}

export function loadFromMedium(store, mediumCardIds) {
  const mediumCards = store.mediumCards.filter(card => mediumCardIds.includes(card.id))
  if (mediumCards.length === 0) return []
  store.sessionCards = [...store.sessionCards, ...mediumCards]
  store.saveSessionCards(store.currentModeId)
  return mediumCards
}

export function addTempCard(store, initialData = {}) {
  // 只使用新的ID生成方式
  const cardId = initialData?.id && store.rootMode.dataStandards.cardIdPattern.test(initialData.id)
    ? initialData.id
    : nextCardIdFromStore(store);
    
  const newCard = normalizeCardStructure(store, {
    ...initialData,
    storageLevel: 'temp',
    id: cardId
  })
  store.tempCards.push(newCard)
  store.selectedCardId = newCard.id
  return newCard
}

export function updateTempCard(store, updatedCard) {
  const index = store.tempCards.findIndex(card => card.id === updatedCard.id)
  if (index !== -1) {
    store.tempCards[index] = normalizeCardStructure(store, {
      ...store.tempCards[index],
      ...updatedCard,
      storageLevel: 'temp'
    })
    return store.tempCards[index]
  }
  return null
}

export function promoteToSession(store, cardIds) {
  if (!cardIds || cardIds.length === 0) return []
  const promotedCards = store.tempCards
    .filter(card => cardIds.includes(card.id))
    .map(card => normalizeCardStructure(store, {
      ...card,
      storageLevel: 'session',
      addedToSessionAt: new Date().toISOString()
    }))

  store.sessionCards = [
    ...store.sessionCards.filter(card => !cardIds.includes(card.id)),
    ...promotedCards
  ]

  promotedCards.forEach(card => {
    store.environmentConfigs.cards[card.id] = {
      id: card.id,
      name: card.data.title ?? null,
      dropdown: (card.data.selectOptions || []).map(opt => opt?.label ?? null)
    }
    // 统一重建 A1/A2…
    rebuildEnvOptionsForCard(store, card.id, card)
  })

  store.saveSessionCards(store.currentModeId)
  store.tempCards = store.tempCards.filter(card => !cardIds.includes(card.id))

  if (store.isRootMode) {
    store.recordRootTempOperation('promote_to_session', { cardIds })
  }

  store.notifyEnvConfigChanged()
  return promotedCards
}

export function updateCardSelectedValue(store, cardId, newValue) {
  const tempIndex = store.tempCards.findIndex(c => c.id === cardId)
  if (tempIndex !== -1) {
    store.tempCards[tempIndex].data.selectedValue = newValue
    return store.tempCards[tempIndex]
  }
  const sessionIndex = store.sessionCards.findIndex(c => c.id === cardId)
  if (sessionIndex !== -1) {
    store.sessionCards[sessionIndex].data.selectedValue = newValue
    const selectedOption = store.sessionCards[sessionIndex].data.selectOptions
      .find(opt => opt.label === newValue)
    if (selectedOption) {
      store.applyPresetToCard(cardId, selectedOption.id)
    }
    if (store.environmentConfigs.cards[cardId]) {
      store.environmentConfigs.cards[cardId].dropdown =
        store.sessionCards[sessionIndex].data.selectOptions.map(opt => opt.label ?? null)
      store.notifyEnvConfigChanged()
    }
    return store.sessionCards[sessionIndex]
  }
  return null
}

export function exportData(store, fileName = 'card_data.json') {
  return store.dataManager.exportData(store.currentModeId, fileName)
}

export async function importData(store, file) {
  try {
    const importedData = await store.dataManager.importFromFile(file)
    const safeData = importedData.map(card => normalizeCardStructure(store, {
      ...card,
      modeId: store.currentModeId,
      storageLevel: 'session'
    }))

    store.sessionCards = [...store.sessionCards, ...safeData]
    store.saveSessionCards(store.currentModeId)

    safeData.forEach(card => {
      store.environmentConfigs.cards[card.id] = {
        id: card.id,
        name: card.data.title ?? null,
        dropdown: (card.data.selectOptions || []).map(opt => opt?.label ?? null)
      }
      // 统一重建 A1/A2…
      rebuildEnvOptionsForCard(store, card.id, card)
    })

    store.notifyEnvConfigChanged()
    return { success: true, count: safeData.length }
  } catch (err) {
    store.error = `导入失败：${err.message}`
    return { success: false, error: store.error }
  }
}

// ============ 全量库 版本盘（本地） ============

function _loadEnvBank() {
  try {
    const raw = localStorage.getItem('env_bank')
    const obj = raw ? JSON.parse(raw) : null
    if (obj && typeof obj === 'object' && obj.versions && typeof obj.versions === 'object') {
      return obj
    }
  } catch (e) {}
  return { versions: {}, lastUpdated: null }
}

function _saveEnvBank(bank) {
  bank.lastUpdated = new Date().toISOString()
  localStorage.setItem('env_bank', JSON.stringify(bank))
  return bank
}

function _buildOptionsIndexFromCards(cards) {
  // cards 已经是 A/B/C… + 每卡 1..N
  const index = {}
  ;(Array.isArray(cards) ? cards : []).forEach(card => {
    const cid = String(card.id || '')
    const opts = Array.isArray(card?.data?.options) ? card.data.options : []
    opts.forEach(o => {
      const key = `${cid}${o.id}` // 形如 A1、B2
      index[key] = {
        name: o?.name ?? null,
        value: o?.value ?? null,
        unit: o?.unit ?? null
      }
    })
  })
  return index
}

// 保存当前操作台为“全量库的一个版本”
// 若该版本已存在，则被覆盖（这正是“唯一指向性”：版本内 A1/A2… 唯一）
export function saveFullVersionFromSession(store, version) {
  const v = String(version || '').trim()
  if (!v) { store.error = '版本号不能为空'; return false }

  // 1) 取当前操作台的卡片，确保编号规范（我们前面的逻辑已保证）
  // 若你不放心，可再排序一次
  store.sessionCards.sort((a, b) => store.compareCardIds(a.id, b.id))

  // 2) 构造一个“干净快照”：卡片 A/B/C…，选项 1..N
  const snapshotCards = (store.sessionCards || []).map(c => ({
    id: c.id,
    data: {
      title: c.data?.title ?? null,
      options: (Array.isArray(c.data?.options) ? c.data.options : []).map((o, i) => ({
        id: String(i + 1),
        name: o?.name ?? null,
        value: o?.value ?? null,
        unit: o?.unit ?? null
      })),
      selectOptions: (Array.isArray(c.data?.selectOptions) ? c.data.selectOptions : []).map((s, i) => ({
        id: /^\d+$/.test(String(s?.id)) ? String(s.id) : String(i + 1),
        label: s?.label ?? null
      }))
    }
  }))

  // 3) 构建“版本内 ExcelID -> 值”的索引（A1/A2…）
  const optionsIndex = _buildOptionsIndexFromCards(snapshotCards)

  // 4) 写入版本盘（覆盖式）
  const bank = _loadEnvBank()
  bank.versions[v] = {
    version: v,
    cards: snapshotCards,
    optionsIndex, // 唯一指向性键：A1/A2… -> 值
    savedAt: new Date().toISOString()
  }
  _saveEnvBank(bank)
  return true
}

// 从“全量库的一个版本”加载到操作台（覆盖操作台）
// editMode: 'none'（默认全部编辑关闭） | 'checkbox'（只开复选框）
export function loadFullVersion(store, version, { editMode = 'none' } = {}) {
  const v = String(version || '').trim()
  if (!v) { store.error = '版本号不能为空'; return false }

  const bank = _loadEnvBank()
  const snap = bank.versions[v]
  if (!snap) {
    store.error = `未找到版本：${v}`
    return false
  }

  // 用 replaceSessionWithCards 覆盖操作台，并根据 editMode 设置默认编辑态
  store.replaceSessionWithCards(
    // 转回 replaceSessionWithCards 期待的结构
    snap.cards.map(c => ({
      id: c.id,
      data: {
        title: c.data?.title ?? null,
        options: c.data?.options || [],
        selectOptions: c.data?.selectOptions || []
      }
    })),
    { editMode }
  )
  return true
}

export function listFullVersions() {
  const bank = _loadEnvBank()
  return Object.keys(bank.versions)
}

export function deleteFullVersion(version) {
  const v = String(version || '').trim()
  const bank = _loadEnvBank()
  if (bank.versions[v]) {
    delete bank.versions[v]
    _saveEnvBank(bank)
    return true
  }
  return false
}
