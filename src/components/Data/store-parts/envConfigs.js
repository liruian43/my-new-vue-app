// 环境配置相关（仅标准字段）
export async function loadEnvironmentConfigs(store) {
  const configs = await store.dataManager.loadEnvironmentConfigs()
  store.environmentConfigs = {
    ...store.environmentConfigs,
    cards: normalizeCards(store, configs.cards || {}),
    options: normalizeOptions(store, configs.options || {}),
    uiPresets: configs.uiPresets || [],
    scoringRules: configs.scoringRules || [],
    contextTemplates: configs.contextTemplates || []
  }
}

export function normalizeCards(store, cards) {
  const out = {}
  Object.entries(cards).forEach(([id, card]) => {
    if (!store.rootMode.dataStandards.cardIdPattern.test(id)) { console.warn(`卡片ID ${id} 不符合标准，跳过`); return }
    out[id] = { id, name: card?.name ?? null, dropdown: Array.isArray(card?.dropdown) ? card.dropdown.map(x => (x ?? null)) : [] }
  })
  return out
}

export function normalizeOptions(store, options) {
  const out = {}
  Object.entries(options).forEach(([fullId, option]) => {
    if (!store.rootMode.dataStandards.fullOptionIdPattern.test(fullId)) { console.warn(`选项ID ${fullId} 不符合标准，跳过`); return }
    out[fullId] = { name: option?.name ?? null, value: option?.value ?? null, unit: option?.unit ?? null }
  })
  return out
}

export function saveEnvironmentConfigs(store, configs) {
  const normalizedConfigs = {
    ...configs,
    cards: normalizeCards(store, configs.cards || store.environmentConfigs.cards),
    options: normalizeOptions(store, configs.options || store.environmentConfigs.options)
  }
  store.environmentConfigs = {
    ...store.environmentConfigs,
    ...normalizedConfigs
  }
  notifyEnvConfigChanged(store)
  return store.dataManager.saveEnvironmentConfigs(normalizedConfigs)
}

export function getAllOptionsByCardId(store, cardId) {
  return Object.entries(store.environmentConfigs.options)
    .filter(([fullId]) => fullId.startsWith(cardId))
    .map(([fullId, opt]) => ({ fullId, name: opt.name, value: opt.value, unit: opt.unit }))
}

export function saveQuestionContext(store, questionId, contextData) {
  const context = {
    questionId,
    uiConfig: contextData.uiConfig || {},
    scoringRules: contextData.scoringRules || [],
    options: contextData.options || [],
    createdAt: new Date().toISOString()
  }
  const idx = store.environmentConfigs.contextTemplates.findIndex(t => t.questionId === questionId)
  if (idx >= 0) store.environmentConfigs.contextTemplates[idx] = context
  else store.environmentConfigs.contextTemplates.push(context)
  store.dataManager.saveEnvironmentConfigs(store.environmentConfigs)
  return context
}

export function getQuestionContext(store, questionId) {
  return store.environmentConfigs.contextTemplates.find(t => t.questionId === questionId) || null
}

// 兼容方法：通知环境配置变化 -> 重新解析子模式
export function notifyEnvConfigChanged(store) {
  (store.subModes.instances || []).forEach(inst => store.parseSubModeData(inst.id))
}

// 导出 normalize 方法以供 store 直接映射
export const normalizeCardsExport = normalizeCards
export const normalizeOptionsExport = normalizeOptions
export const notifyEnvConfigChangedExport = notifyEnvConfigChanged