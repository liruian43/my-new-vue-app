// src/components/Data/store-parts/linkage.js

export function checkSyncPermission(store, sourceModeId, targetModeId) {
  if (sourceModeId !== 'root_admin') {
    console.warn('权限校验失败：只有root_admin可以作为同步源')
    return false
  }
  if (sourceModeId === targetModeId) {
    console.warn('权限校验失败：不能同步到自身模式')
    return false
  }
  const targetMode = store.getMode(targetModeId)
  if (!targetMode) {
    console.warn(`权限校验失败：目标模式${targetModeId}不存在`)
    return false
  }
  return true
}

export function processValue(store, value) {
  if (value === '' || value === undefined) return null
  if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
    throw new Error('不允许输入"null"字符串，请留空表示空值')
  }
  return value
}

export function isFieldSynced(store, field, syncFields) {
  const { FIELD_IDS } = store
  if ([
    FIELD_IDS.OPTIONS,
    FIELD_IDS.SELECT_OPTIONS,
    FIELD_IDS.CARD_COUNT,
    FIELD_IDS.CARD_ORDER,
    FIELD_IDS.DATA_SECTION_ID,
    FIELD_IDS.SECTION_ITEMS
  ].includes(field)) {
    return true
  }
  return syncFields.includes(field)
}

export function coordinateMode(store, linkageConfig) {
  const { sourceModeId, sourceData, targetModeIds, syncFields, authFields } = linkageConfig

  const resolvedSourceData = sourceData || {
    cards: store.sessionCards.map((card, index) => ({
      id: card.id,
      showDropdown: card.showDropdown,
      data: {
        title: card.data.title,
        options: card.data.options,
        selectOptions: card.data.selectOptions,
        selectedValue: card.data.selectedValue,
        showSelect: card.data.showSelect || true
      },
      cardIndex: index,
      optionCount: card.data.options.length
    })),
    timestamp: new Date().toISOString()
  }

  if (sourceModeId !== 'root_admin') throw new Error('只有root_admin可以作为同步源')
  if (!Array.isArray(targetModeIds) || targetModeIds.length === 0) throw new Error('目标模式列表不能为空')
  if (!resolvedSourceData?.cards || !Array.isArray(resolvedSourceData.cards)) {
    throw new Error('源数据格式错误，cards必须是数组')
  }

  const validSyncFields = [...Object.values(store.FIELD_IDS)]
  syncFields.forEach(field => {
    if (!validSyncFields.includes(field)) {
      throw new Error(`无效的同步字段: ${field}，允许的字段：${validSyncFields.join(',')}`)
    }
  })

  let successCount = 0
  targetModeIds.forEach(targetId => {
    if (checkSyncPermission(store, sourceModeId, targetId)) {
      try {
        syncToTargetMode(store, sourceModeId, targetId, resolvedSourceData, syncFields, authFields)
        store.dataManager.saveMode(targetId)
        successCount++
        console.log(`已完成root_admin到${targetId}的完整同步`)
      } catch (error) {
        console.error(`同步到${targetId}失败：`, error)
      }
    }
  })

  store.dataManager.syncComplete()

  return {
    success: successCount > 0,
    total: targetModeIds.length,
    successCount
  }
}

export function syncToTargetMode(store, sourceId, targetId, sourceData, syncFields, authFields) {
  const targetMode = store.getMode(targetId)
  if (!targetMode) return

  if (!Array.isArray(targetMode.cardData)) {
    targetMode.cardData = []
  }

  targetMode.cardData = targetMode.cardData.filter(targetCard =>
    sourceData.cards.some(sourceCard => sourceCard.id === targetCard.id)
  )

  sourceData.cards.forEach((sourceCard, cardIndex) => {
    const { FIELD_IDS } = store
    const cardToSync = {
      id: sourceCard.id,
      showDropdown: sourceCard.showDropdown ?? false,
      isTitleEditing: false,
      isOptionsEditing: false,
      isSelectEditing: false,
      orderIndex: cardIndex,
      editableFields: {
        [FIELD_IDS.CARD_TITLE]: authFields.includes(FIELD_IDS.CARD_TITLE),
        [FIELD_IDS.OPTION_NAME]: authFields.includes(FIELD_IDS.OPTION_NAME),
        [FIELD_IDS.OPTION_VALUE]: authFields.includes(FIELD_IDS.OPTION_VALUE),
        [FIELD_IDS.OPTION_UNIT]: authFields.includes(FIELD_IDS.OPTION_UNIT),
        [FIELD_IDS.SECTION_TITLE]: authFields.includes(FIELD_IDS.SECTION_TITLE),
        [FIELD_IDS.SECTION_ITEMS]: authFields.includes(FIELD_IDS.SECTION_ITEMS),
        optionActions: false,
        select: false
      },
      syncStatus: {
        [FIELD_IDS.CARD_TITLE]: isFieldSynced(store, FIELD_IDS.CARD_TITLE, syncFields),
        [FIELD_IDS.OPTION_NAME]: isFieldSynced(store, FIELD_IDS.OPTION_NAME, syncFields),
        [FIELD_IDS.OPTION_VALUE]: isFieldSynced(store, FIELD_IDS.OPTION_VALUE, syncFields),
        [FIELD_IDS.OPTION_UNIT]: isFieldSynced(store, FIELD_IDS.OPTION_UNIT, syncFields),
        [FIELD_IDS.SECTION_TITLE]: isFieldSynced(store, FIELD_IDS.SECTION_TITLE, syncFields),
        [FIELD_IDS.SECTION_ITEMS]: isFieldSynced(store, FIELD_IDS.SECTION_ITEMS, syncFields),
        [FIELD_IDS.OPTIONS]: true,
        [FIELD_IDS.SELECT_OPTIONS]: true,
        [FIELD_IDS.CARD_COUNT]: true,
        [FIELD_IDS.CARD_ORDER]: true
      },
      data: {
        title: null,
        options: [],
        selectOptions: [],
        selectedValue: sourceCard.data?.selectedValue ?? '',
        showSelect: sourceCard.data?.showSelect ?? true
      }
    }

    const existingTargetCard = targetMode.cardData.find(c => c.id === sourceCard.id)
    const targetOptions = existingTargetCard ? [...existingTargetCard.data.options] : []

    sourceCard.data.options.forEach(sourceOption => {
      const existingOption = targetOptions.find(o => o.id === sourceOption.id)
      const processedOption = {
        id: sourceOption.id || Date.now() + Math.random(),
        name: isFieldSynced(store, FIELD_IDS.OPTION_NAME, syncFields)
          ? processValue(store, sourceOption.name)
          : (existingOption?.name ?? null),
        value: isFieldSynced(store, FIELD_IDS.OPTION_VALUE, syncFields)
          ? processValue(store, sourceOption.value)
          : (existingOption?.value ?? null),
        unit: isFieldSynced(store, FIELD_IDS.OPTION_UNIT, syncFields)
          ? processValue(store, sourceOption.unit)
          : (existingOption?.unit ?? null),
        checked: sourceOption.checked !== undefined
          ? sourceOption.checked
          : (existingOption?.checked ?? false),
        localName: existingOption?.localName ?? null,
        localValue: existingOption?.localValue ?? null,
        localUnit: existingOption?.localUnit ?? null
      }
      if (existingOption) {
        Object.assign(existingOption, processedOption)
      } else {
        targetOptions.push(processedOption)
      }
    })

    cardToSync.data.options = targetOptions.sort((a, b) => {
      const indexA = sourceCard.data.options.findIndex(option => option.id === a.id)
      const indexB = sourceCard.data.options.findIndex(option => option.id === b.id)
      return indexA - indexB
    })

    cardToSync.data.selectOptions = (sourceCard.data?.selectOptions || []).map(option => ({
      id: option.id || Date.now() + Math.random(),
      label: processValue(store, option.label),
      localLabel: existingTargetCard?.data?.selectOptions?.find(o => o.id === option.id)?.localLabel ?? null
    }))

    cardToSync.data.title = isFieldSynced(store, FIELD_IDS.CARD_TITLE, syncFields)
      ? processValue(store, sourceCard.data?.title)
      : (existingTargetCard?.data?.title ?? null)
    cardToSync.data.localTitle = existingTargetCard?.data?.localTitle ?? null

    const targetCardIndex = targetMode.cardData.findIndex(c => c.id === sourceCard.id)
    if (targetCardIndex > -1) {
      targetMode.cardData[targetCardIndex] = {
        ...targetMode.cardData[targetCardIndex],
        ...cardToSync,
        data: { ...targetMode.cardData[targetCardIndex].data, ...cardToSync.data }
      }
    } else {
      targetMode.cardData.push(cardToSync)
    }
  })

  targetMode.cardData.sort((a, b) => a.orderIndex - b.orderIndex)

  targetMode.lastSynced = new Date().toISOString()
  targetMode.source = 'root_admin'
  targetMode.syncFields = [...syncFields]
  targetMode.authFields = [...authFields]
  targetMode.syncCompleted = true

  store.saveModesToStorage()
}

// —— 联动 UI 与主流程（保持与原 store 行为一致） —— //

export function toggleModeDropdown(store) {
  store.environmentConfigs.linkageControl.isModeDropdownOpen =
    !store.environmentConfigs.linkageControl.isModeDropdownOpen
}

export function selectMode(store, modeName) {
  store.environmentConfigs.linkageControl.selectedMode = modeName
  store.environmentConfigs.linkageControl.isModeDropdownOpen = false
}

export function togglePrepareStatus(store) {
  const lc = store.environmentConfigs.linkageControl
  if (lc.isInPrepareState) {
    lc.syncOptions.forEach(item => { item.checked = false })
    lc.authOptions.forEach(item => { item.checked = false })
  }
  lc.isInPrepareState = !lc.isInPrepareState
}

export function resetLinkageState(store) {
  const lc = store.environmentConfigs.linkageControl
  lc.selectedMode = ''
  lc.isInPrepareState = false
  lc.syncOptions.forEach(item => { item.checked = false })
  lc.authOptions.forEach(item => { item.checked = false })
  store.linkageSync.currentLinkageConfig = null
}

export function confirmLinkage(store) {
  let targetModeIds = []
  const lc = store.environmentConfigs.linkageControl

  if (lc.selectedMode === '所有模式') {
    targetModeIds = store.filteredModes.map(mode => mode.id)
  } else {
    const targetMode = store.modes.find(mode => mode.name === lc.selectedMode)
    if (targetMode) {
      targetModeIds = [targetMode.id]
    } else {
      store.error = '未找到目标模式'
      return null
    }
  }

  const linkageConfig = {
    sourceModeId: store.currentModeId || 'root_admin',
    targetMode: lc.selectedMode,
    targetModeIds,
    fixedSync: store.FIXED_SYNC_FIELDS,
    sync: lc.syncOptions.filter(i => i.checked).map(i => i.fieldId),
    auth: lc.authOptions.filter(i => i.checked).map(i => i.fieldId),
    timestamp: new Date().toISOString()
  }

  store.linkageSync.currentLinkageConfig = linkageConfig
  const result = coordinateMode(store, linkageConfig)
  resetLinkageState(store)
  return result
}

export function syncDataToTargets(store, linkageConfig) {
  if (!linkageConfig || !linkageConfig.targetModeIds || linkageConfig.targetModeIds.length === 0) {
    store.error = '无效的联动配置或目标模式'
    return null
  }
  const cardIds = store.sessionCards.map(card => card.id)
  const results = []
  for (const targetModeId of linkageConfig.targetModeIds) {
    const result = syncToMode(store, targetModeId, cardIds, {
      sync: linkageConfig.sync,
      auth: linkageConfig.auth
    })
    if (result) results.push(result)
  }
  recordSyncHistory(store, {
    sourceModeId: linkageConfig.sourceModeId,
    targetMode: linkageConfig.targetMode,
    targetModeIds: linkageConfig.targetModeIds,
    cardIds,
    syncFields: linkageConfig.sync,
    authFields: linkageConfig.auth
  })
  return {
    success: results.length > 0,
    syncedModes: results.length,
    details: results
  }
}

export function setFieldAuthorization(store, sourceModeId, targetModeId, field, authorized) {
  if (!store.AUTHORIZABLE_FIELDS.includes(field)) {
    console.warn(`字段 ${field} 不在标准可授权列表中，但已记录以兼容UI`)
  }
  const key = `${sourceModeId}_${targetModeId}_${field}`
  store.linkageSync.fieldAuthorizations[key] = !!authorized
  store.dataManager.saveFieldAuthorizations(store.linkageSync.fieldAuthorizations)
  return true
}

export function recordSyncHistory(store, syncData) {
  const entry = store.dataManager.createSyncHistoryEntry(syncData)
  store.linkageSync.syncHistory.unshift(entry)
  if (store.linkageSync.syncHistory.length > 50) {
    store.linkageSync.syncHistory.pop()
  }
  store.dataManager.saveSyncHistory(store.linkageSync.syncHistory)
  return entry
}

export async function syncData(store, cardIdList, targetModeId, { sync = [], auth = [] } = {}) {
  return syncToMode(store, targetModeId, cardIdList, {
    syncFields: sync,
    authFields: auth
  })
}

export function updateModeSyncInfo(store, modeId, syncInfo) {
  const modeIndex = store.modes.findIndex(m => m.id === modeId)
  if (modeIndex !== -1) {
    store.modes[modeIndex] = {
      ...store.modes[modeIndex],
      syncInfo: {
        ...store.modes[modeIndex].syncInfo,
        ...syncInfo
      }
    }
    localStorage.setItem('app_user_modes', JSON.stringify(store.modes))
  }
}

export function syncToMode(store, targetModeId, cardIds, syncConfig) {
  if (!targetModeId || targetModeId === 'root_admin') {
    store.error = '不能向主模式推送数据'
    return null
  }
  if (store.currentModeId !== 'root_admin') {
    store.error = '只有主模式可以推送数据'
    return null
  }

  const { syncFields = [], authFields = [] } = syncConfig || {}
  const validation = store.dataManager.validator.validateConfig(store.sessionCards)

  if (!validation.pass) {
    store.error = '源数据校验失败，无法同步'
    return null
  }

  const sourceCards = validation.validCards
    .filter(card => cardIds.includes(card.id))
    .map(card =>
      store.dataManager.prepareSyncCardData(card, {
        targetModeId,
        titleSync: syncFields.includes(store.FIELD_IDS.CARD_TITLE),
        titleAuth: authFields.includes(store.FIELD_IDS.CARD_TITLE),
        nameSync: syncFields.includes(store.FIELD_IDS.OPTION_NAME),
        nameAuth: authFields.includes(store.FIELD_IDS.OPTION_NAME),
        valueSync: syncFields.includes(store.FIELD_IDS.OPTION_VALUE),
        valueAuth: authFields.includes(store.FIELD_IDS.OPTION_VALUE),
        unitSync: syncFields.includes(store.FIELD_IDS.OPTION_UNIT),
        unitAuth: authFields.includes(store.FIELD_IDS.OPTION_UNIT),
        uiSync: syncFields.includes(store.FIELD_IDS.UI_CONFIG)
      })
    )

  const cardPresets = {}
  cardIds.forEach(id => {
    if (store.presetMappings[id]) {
      cardPresets[id] = store.presetMappings[id]
    }
  })

  if (sourceCards.length === 0) return null

  const targetRawCards = store.sessionStorageEnhancer.load(targetModeId, 'cards') || []
  const targetCards = [
    ...targetRawCards.filter(card => !cardIds.includes(card.id)),
    ...sourceCards
  ]

  store.sessionStorageEnhancer.save(targetModeId, 'cards', targetCards)

  if (store.currentModeId === targetModeId) {
    store.sessionCards = targetCards
    Object.keys(cardPresets).forEach(cardId => {
      store.presetMappings[cardId] = cardPresets[cardId]
    })
    store.savePresetMappings()
  }

  const subModeInstance = store.subModes.instances.find(inst => inst.id === targetModeId)
  if (subModeInstance) {
    store.parseSubModeData(targetModeId)
  }

  updateModeSyncInfo(store, targetModeId, {
    lastSyncTime: new Date().toISOString(),
    syncFields,
    authFields,
    syncedCardIds: cardIds
  })

  recordSyncHistory(store, {
    sourceModeId: 'root_admin',
    targetModeId,
    cardIds,
    fields: syncFields
  })

  return { targetModeId, syncedCount: sourceCards.length, syncFields, authFields }
}