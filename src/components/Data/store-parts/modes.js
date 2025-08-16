import { generateModePage as routingGenerate, deleteModePage as routingDelete } from './routing'

export function addMode(store, modeData) {
  if (modeData.id === 'root_admin' || modeData.name === '根模式（源数据区）') {
    store.error = '不能创建与主模式同名或同ID的模式'
    return null
  }
  const newMode = {
    id: modeData.id || `mode-${crypto.randomUUID?.() || Date.now()}`,
    ...modeData,
    level: 2,
    isUserMode: true,
    syncInfo: {
      lastSyncTime: null,
      syncFields: [],
      authFields: [],
      syncedCardIds: []
    }
  }
  store.modes.push(newMode)
  routingGenerate(store, newMode)
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes))
  return newMode
}

export function deleteModes(store, modeIds) {
  const filteredIds = modeIds.filter(id => id !== 'root_admin')
  if (filteredIds.length === 0) return

  filteredIds.forEach(modeId => {
    routingDelete(store, modeId)
  })

  store.modes = store.modes.filter(mode => !filteredIds.includes(mode.id))

  filteredIds.forEach(modeId => {
    if (store.modeRoutes[modeId]) {
      delete store.modeRoutes[modeId]
    }
  })

  localStorage.setItem('app_user_modes', JSON.stringify(store.modes))

  if (filteredIds.includes(store.currentModeId)) {
    store.setCurrentMode('root_admin')
  }
}

export function getMode(store, modeId) {
  if (modeId === 'root_admin') return store.rootMode
  return store.modes.find(mode => mode.id === modeId) || null
}

export function saveModesToStorage(store) {
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes))
  localStorage.setItem('root_mode_config', JSON.stringify({
    cardData: store.rootMode.cardData,
    dataStandards: store.rootMode.dataStandards
  }))
}