// 数据段管理（来自 DataSectionStore 的方法）

export function isModeData(store, item) {
  return item.isModeData || item.dataType === 'root' || item.dataType === 'other-mode'
}

export function generateTooltip(store, item) {
  let tooltip = `ID: ${item.id}\n类型: ${item.typeText}\n模式: ${item.modeId}`
  if (store.isRootMode && item.syncStatus) {
    tooltip += `\n同步状态: ${getSyncText(store, item.syncStatus)}`
  }
  if (item.summary) {
    tooltip += `\n内容: ${item.summary}`
  }
  return tooltip
}

export function getModeClass(store, item) {
  if (item.dataType === 'root') return 'mode-root'
  if (item.dataType === 'other-mode') return 'mode-other'
  if (item.modeId === store.currentModeId) return 'mode-current'
  return ''
}

export function getSyncText(store, status) {
  if (!status) return '未同步'
  if (status.hasConflict) return '冲突'
  return status.hasSync ? '已同步' : '未同步'
}

export function getSyncClass(store, status) {
  if (!status) return 'sync-unsynced'
  if (status.hasConflict) return 'sync-conflict'
  return status.hasSync ? 'sync-synced' : 'sync-unsynced'
}

export function canEditItem(store, item) {
  const currentMode = store.currentMode
  if (!currentMode || !currentMode.permissions) return false
  if (item.dataType === 'question') {
    return currentMode.permissions.card?.editOptions || false
  }
  if (item.dataType === 'config') {
    return currentMode.permissions.data?.save || false
  }
  return false
}

export function checkSyncStatus(store, syncStatus, filter) {
  if (!syncStatus) return filter === 'unsynced'
  switch (filter) {
    case 'synced': return syncStatus.hasSync
    case 'unsynced': return !syncStatus.hasSync
    case 'conflict': return syncStatus.hasConflict
    default: return true
  }
}

export function updateSelected(store) {
  const count = store.filteredData.filter(item => item.selected && !store.isModeData(item)).length
  store.dataSection.selectedCount = count
  store.dataSection.selectAll = count > 0 && count === store.filteredData.filter(item => !store.isModeData(item)).length
}

export function handleSelectAll(store) {
  store.filteredData.forEach(item => {
    if (!store.isModeData(item)) item.selected = store.dataSection.selectAll
  })
  updateSelected(store)
}

export async function deleteItem(store, item) {
  if (store.isModeData(item)) return
  if (confirm(`确定要删除 ${item.id || '该数据'} 吗？`)) {
    if (item.dataType === 'config') {
      const configs = await store.dataManager.loadEnvironmentConfigs()
      configs.contextTemplates = configs.contextTemplates
        .filter(template => template.questionId !== item.id)
      await store.dataManager.saveEnvironmentConfigs(configs)
      await store.loadEnvironmentConfigs()
    } else if (item.dataType === 'question') {
      const bank = await store.dataManager.loadQuestionBank()
      bank.questions = bank.questions.filter(q => q.id !== item.id)
      await store.dataManager.saveQuestionBank(bank)
      await store.loadQuestionBank()
    }
  }
}

export async function deleteSelected(store) {
  if (store.dataSection.selectedCount === 0 || store.hasModeDataSelected) return
  if (confirm(`确定要删除选中的 ${store.dataSection.selectedCount} 条数据吗？`)) {
    const configs = await store.dataManager.loadEnvironmentConfigs()
    const bank = await store.dataManager.loadQuestionBank()

    store.filteredData.forEach(item => {
      if (item.selected && !store.isModeData(item)) {
        if (item.dataType === 'config') {
          configs.contextTemplates = configs.contextTemplates
            .filter(template => template.questionId !== item.id)
        } else if (item.dataType === 'question') {
          bank.questions = bank.questions.filter(q => q.id !== item.id)
        }
      }
    })
    await store.dataManager.saveEnvironmentConfigs(configs)
    await store.dataManager.saveQuestionBank(bank)

    await store.loadEnvironmentConfigs()
    await store.loadQuestionBank()

    store.dataSection.selectAll = false
    store.dataSection.selectedCount = 0
  }
}

export async function importDataFromFile(store, file) {
  try {
    const importedData = await store.dataManager.importFromFile(file)
    let configs = []
    let questions = []

    if (importedData.questions) {
      questions = importedData.questions.map(q => store.normalizeQuestion(q))
    }
    if (importedData.contextTemplates) {
      configs = importedData.contextTemplates
    }

    store.dataSection.previewData = {
      configs,
      questions,
      totalCount: configs.length + questions.length
    }
    store.dataSection.isPreview = true

    return store.dataSection.previewData
  } catch (err) {
    console.error('导入数据失败:', err)
    throw new Error(`导入失败: ${err.message}`)
  }
}

export async function exportDataSection(store) {
  return store.exportData(`data-section-export-${new Date().getTime()}.json`)
}

export async function applyPreview(store) {
  if (store.dataSection.previewData.totalCount === 0) return

  const bank = await store.dataManager.loadQuestionBank()
  const configs = await store.dataManager.loadEnvironmentConfigs()

  if (store.dataSection.previewData.questions.length > 0) {
    const normalizedQuestions = store.dataSection.previewData.questions.map(q =>
      store.dataManager.normalizeQuestion(q)
    )
    bank.questions = [...bank.questions, ...normalizedQuestions]
    await store.dataManager.saveQuestionBank(bank)
    await store.dataManager.saveQuestionBank(bank)
    await store.loadQuestionBank()
  }

  if (store.dataSection.previewData.configs.length > 0) {
    store.dataSection.previewData.configs.forEach(config => {
      const index = configs.contextTemplates.findIndex(t => t.questionId === config.questionId)
      if (index >= 0) {
        configs.contextTemplates[index] = config
      } else {
        configs.contextTemplates.push(config)
      }
    })
    await store.dataManager.saveEnvironmentConfigs(configs)
    await store.loadEnvironmentConfigs()
  }

  store.dataSection.previewData = { configs: [], questions: [], totalCount: 0 }
  store.dataSection.isPreview = false
  // 保持原逻辑（清空后再提示，因此数字可能为 0）
  alert(`已导入 ${store.dataSection.previewData.questions.length} 条题目和 ${store.dataSection.previewData.configs.length} 条环境配置`)
}

export function cancelPreview(store) {
  store.dataSection.previewData = { configs: [], questions: [], totalCount: 0 }
  store.dataSection.isPreview = false
}

export function toggleManager(store) {
  store.dataSection.isManager = !store.dataSection.isManager
  if (!store.dataSection.isManager) {
    store.filteredData.forEach(item => item.selected = false)
    store.dataSection.selectAll = false
    store.dataSection.selectedCount = 0
  }
}

export function clearFilters(store) {
  store.dataSection.filterType = 'all'
  store.dataSection.syncFilter = 'all'
}

export function normalizeQuestion(store, question) {
  return store.dataManager.normalizeQuestion(question)
}

export function setCurrentMode(store, modeId) {
  store.currentModeId = modeId
  store.loadSessionCards(modeId)
}