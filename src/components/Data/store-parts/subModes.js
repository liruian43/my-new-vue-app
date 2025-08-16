export async function loadSubModeInstances(store) {
  const instances = await store.dataManager.loadSubModeInstances()
  store.subModes.instances = instances || []
  store.subModes.instances.forEach(inst => store.parseSubModeData(inst.id))
}

export function parseSubModeData(store, instanceId) {
  const instance = store.subModes.instances.find(inst => inst.id === instanceId)
  if (!instance) return null

  const parsedCards = Object.values(store.environmentConfigs.cards).map(card => ({
    ...card,
    displayName: card.name || `卡片 ${card.id}`,
    isEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.CARD_TITLE)
  }))

  const parsedOptions = Object.entries(store.environmentConfigs.options).map(([fullId, option]) => {
    const cardId = fullId.replace(/\d+$/, '')
    const optionId = fullId.replace(cardId, '')
    return {
      fullId,
      cardId,
      optionId,
      ...option,
      displayValue: option.value !== null ? `${option.value}${option.unit || ''}` : '',
      isNameEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.OPTION_NAME),
      isValueEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.OPTION_VALUE),
      isUnitEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.OPTION_UNIT)
    }
  })

  store.subModes.parsedData[instanceId] = {
    cards: parsedCards,
    options: parsedOptions,
    parsedAt: new Date().toISOString()
  }
  return store.subModes.parsedData[instanceId]
}