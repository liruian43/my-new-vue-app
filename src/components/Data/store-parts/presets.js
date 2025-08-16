export function loadPresetMappings(store) {
  const stored = localStorage.getItem('card_preset_mappings')
  if (stored) {
    try { store.presetMappings = JSON.parse(stored) }
    catch (e) { console.error('加载预设映射失败:', e); store.presetMappings = {} }
  }
}

export function savePresetMappings(store) {
  try {
    localStorage.setItem('card_preset_mappings', JSON.stringify(store.presetMappings))
    return true
  } catch (e) {
    console.error('保存预设映射失败:', e)
    return false
  }
}

export function savePresetForSelectOption(store, cardId, selectOptionId, checkedOptions) {
  if (!store.presetMappings[cardId]) store.presetMappings[cardId] = {}
  const optionsData = checkedOptions.map(option => ({
    id: option.id,
    name: option.name ?? null,
    value: option.value ?? null,
    unit: option.unit ?? null,
    checked: true
  }))
  store.presetMappings[cardId][selectOptionId] = {
    checkedOptionIds: checkedOptions.map(option => option.id),
    optionsData
  }
  savePresetMappings(store)
}

export function applyPresetToCard(store, cardId, selectOptionId) {
  const cardPresets = store.presetMappings[cardId]
  if (!cardPresets || !cardPresets[selectOptionId]) return false
  const preset = cardPresets[selectOptionId]
  const card = store.sessionCards.find(c => c.id === cardId) || store.tempCards.find(c => c.id === cardId)
  if (!card) return false

  card.data.options = card.data.options.map(o => ({ ...o, checked: false }))
  preset.optionsData.forEach(presetOption => {
    const target = card.data.options.find(o => o.id === presetOption.id)
    if (target) {
      target.checked = true
      if (presetOption.name !== undefined) target.name = presetOption.name
      if (presetOption.value !== undefined) target.value = presetOption.value
      if (presetOption.unit !== undefined) target.unit = presetOption.unit
    }
  })
  return true
}