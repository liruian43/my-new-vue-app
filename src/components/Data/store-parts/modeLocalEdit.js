// src/components/Data/store-parts/modeLocalEdit.js

export function updateModeCardLocalValue(store, modeId, cardId, fieldType, optIndex, value) {
  if (modeId !== store.currentModeId) return false

  const cardIndex = store.sessionCards.findIndex(c => c.id === cardId)
  if (cardIndex === -1) return false

  const card = store.sessionCards[cardIndex]

  if (fieldType === 'title') {
    if (!card.syncStatus.title.isAuthorized) return false
    card.data.title = value

    // 如果是root模式，同时更新环境配置
    if (store.isRootMode && store.environmentConfigs.cards[cardId]) {
      store.environmentConfigs.cards[cardId].name = value ?? null
      store.notifyEnvConfigChanged()
    }
  } else if (optIndex !== undefined) {
    const option = card.data.options[optIndex]
    if (!option) return false

    const fullId = `${cardId}${option.id}`

    if (fieldType === 'name') {
      if (!card.syncStatus.options.name.isAuthorized) return false
      option.name = value
      if (store.isRootMode && store.environmentConfigs.options[fullId]) {
        store.environmentConfigs.options[fullId].name = value ?? null
        store.notifyEnvConfigChanged()
      }
    } else if (fieldType === 'value') {
      if (!card.syncStatus.options.value.isAuthorized) return false
      option.value = value
      if (store.isRootMode && store.environmentConfigs.options[fullId]) {
        store.environmentConfigs.options[fullId].value = value ?? null
        store.notifyEnvConfigChanged()
      }
    } else if (fieldType === 'unit') {
      if (!card.syncStatus.options.unit.isAuthorized) return false
      option.unit = value
      if (store.isRootMode && store.environmentConfigs.options[fullId]) {
        store.environmentConfigs.options[fullId].unit = value ?? null
        store.notifyEnvConfigChanged()
      }
    } else {
      return false
    }
  } else {
    return false
  }

  store.saveSessionCards(modeId)
  return true
}