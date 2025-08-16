// 会话卡片/临时卡片/选项/下拉/编辑态/导入导出等

export function loadSessionCards(store, modeId) {
  const rawCards = store.sessionStorageEnhancer.load(modeId, 'cards') || []
  store.sessionCards = rawCards.map(card => normalizeCardStructure(store, card))
}

export function normalizeCardStructure(store, card) {
  const normalizeOptions = (options) => {
    const list = Array.isArray(options) ? options : []
    return list.map((opt, idx) => {
      const idStr = (opt && typeof opt.id !== 'undefined') ? String(opt.id) : String(idx + 1)
      const numeric = /^\d+$/.test(idStr) ? idStr : String(idx + 1)
      return { ...opt, id: numeric }
    })
  }
  const normalizeSelectOptions = (options) => {
    const list = Array.isArray(options) ? options : []
    return list.map((opt, idx) => {
      const idStr = (opt && typeof opt.id !== 'undefined') ? String(opt.id) : String(idx + 1)
      const numeric = /^\d+$/.test(idStr) ? idStr : String(idx + 1)
      return { ...opt, id: numeric, label: opt?.label ?? null }
    })
  }

  let cardId = card.id
  if (!cardId || !store.rootMode.dataStandards.cardIdPattern.test(cardId)) {
    cardId = store.generateCardId()
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
  const usedIds = new Set([
    ...Object.keys(store.environmentConfigs.cards || {}),
    ...((store.sessionCards || []).map(c => c?.id).filter(Boolean)),
    ...((store.tempCards || []).map(c => c?.id).filter(Boolean))
  ])

  let newCardId = null
  const requestedId = cardData?.id

  if (requestedId && store.isValidCardId(requestedId) && !usedIds.has(requestedId)) {
    newCardId = requestedId
  } else {
    newCardId = store.generateCardId()
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

  ;(normalized.data.options || []).forEach(opt => {
    const fullId = `${newCardId}${opt.id}`
    if (store.isValidFullOptionId(fullId)) {
      store.environmentConfigs.options[fullId] = {
        name: opt.name ?? null,
        value: opt.value ?? null,
        unit: opt.unit ?? null
      }
    }
  })

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
    card.data.options = updatedOptions
    updatedOptions.forEach(option => {
      const fullId = `${cardId}${option.id}`
      if (!store.isValidFullOptionId(fullId)) {
        console.warn(`选项ID ${fullId} 不符合标准格式，未更新到环境配置`)
        return
      }
      store.environmentConfigs.options[fullId] = {
        name: option.name ?? null,
        value: option.value ?? null,
        unit: option.unit ?? null
      }
    })
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
  const newOptionNumericId = store.generateOptionId(cardId)
  const fullId = `${cardId}${newOptionNumericId}`
  const newOption = {
    id: newOptionNumericId,
    name: null, value: null, unit: null,
    checked: false,
    localName: null, localValue: null, localUnit: null
  }

  const insertTo = (card) => {
    const options = [...card.data.options]
    if (afterId) {
      const index = options.findIndex(o => o.id === afterId)
      if (index !== -1) options.splice(index + 1, 0, newOption)
      else options.push(newOption)
    } else {
      options.push(newOption)
    }
    card.data.options = options
  }

  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) {
    insertTo(tempCard)
  } else {
    const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
    if (sIdx !== -1) {
      insertTo(store.sessionCards[sIdx])
      store.environmentConfigs.options[fullId] = { name: null, value: null, unit: null }
      store.notifyEnvConfigChanged()
    }
  }
}

export function deleteOption(store, cardId, optionId) {
  if (!store.isValidCardId(cardId)) { console.error(`卡片ID ${cardId} 不符合标准格式`); return }
  if (!store.isValidOptionId(optionId)) { console.error(`选项ID ${optionId} 不符合标准格式`); return }
  const fullId = `${cardId}${optionId}`
  const tempCard = store.tempCards.find(c => c.id === cardId)
  if (tempCard) {
    tempCard.data.options = tempCard.data.options.filter(o => o.id !== optionId)
    return
  }
  const sIdx = store.sessionCards.findIndex(c => c.id === cardId)
  if (sIdx !== -1) {
    const card = store.sessionCards[sIdx]
    card.data.options = card.data.options.filter(o => o.id !== optionId)
    if (store.environmentConfigs.options[fullId]) {
      delete store.environmentConfigs.options[fullId]
      store.notifyEnvConfigChanged()
    }
  }
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
  const newCard = normalizeCardStructure(store, {
    ...initialData,
    storageLevel: 'temp',
    id: store.rootMode.dataStandards.cardIdPattern.test(initialData?.id || '')
      ? initialData.id
      : store.generateCardId()
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
    ;(card.data.options || []).forEach(opt => {
      const fullId = `${card.id}${opt.id}`
      if (store.isValidFullOptionId(fullId)) {
        store.environmentConfigs.options[fullId] = {
          name: opt.name ?? null,
          value: opt.value ?? null,
          unit: opt.unit ?? null
        }
      }
    })
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
      ;(card.data.options || []).forEach(option => {
        const fullId = `${card.id}${option.id}`
        if (store.isValidFullOptionId(fullId)) {
          store.environmentConfigs.options[fullId] = {
            name: option.name ?? null,
            value: option.value ?? null,
            unit: option.unit ?? null
          }
        }
      })
    })

    store.notifyEnvConfigChanged()
    return { success: true, count: safeData.length }
  } catch (err) {
    store.error = `导入失败：${err.message}`
    return { success: false, error: store.error }
  }
}