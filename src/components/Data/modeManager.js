// src/components/Data/modeManager.js
import { ID } from './services/id.js'

class ModeManager {
  constructor() {
    this.modes = this.loadModesFromStorage()
  }

  // 创建新子模式
  createMode(modeName) {
    // 检查模式名称是否为空
    if (!modeName || !modeName.trim()) {
      throw new Error('模式名称不能为空')
    }

    const modeId = modeName.trim()
    
    // 检查是否与root_admin冲突
    if (modeId === ID.ROOT_ADMIN_MODE_ID) {
      throw new Error('不能使用root_admin作为模式名称')
    }
    
    // 检查是否已存在
    if (this.modes.some(mode => mode.id === modeId)) {
      throw new Error(`模式 "${modeId}" 已存在`)
    }

    const newMode = {
      id: modeId,
      name: modeName,
      createdAt: new Date().toISOString(),
      lastSync: null,
      syncStatus: '未同步'
    }
    
    this.modes.push(newMode)
    this.saveModesToStorage()
    return newMode
  }

  // 删除子模式
  deleteMode(modeId) {
    // 不能删除root_admin模式
    if (modeId === ID.ROOT_ADMIN_MODE_ID) {
      throw new Error('不能删除root_admin模式')
    }
    
    this.modes = this.modes.filter(mode => mode.id !== modeId)
    this.saveModesToStorage()
  }

  // 获取所有子模式
  getModes() {
    return [...this.modes]
  }

  // 获取特定模式
  getMode(modeId) {
    return this.modes.find(mode => mode.id === modeId)
  }

  // 更新模式同步状态
  updateSyncStatus(modeId, status) {
    const mode = this.getMode(modeId)
    if (mode) {
      mode.syncStatus = status
      mode.lastSync = new Date().toISOString()
      this.saveModesToStorage()
    }
  }

  // 保存模式列表到本地存储
  saveModesToStorage() {
    try {
      localStorage.setItem('app_modes', JSON.stringify(this.modes))
    } catch (error) {
      console.error('保存模式列表失败:', error)
    }
  }

  // 从本地存储加载模式列表
  loadModesFromStorage() {
    try {
      const modes = localStorage.getItem('app_modes')
      return modes ? JSON.parse(modes) : [
        // 默认包含root_admin模式
        {
          id: ID.ROOT_ADMIN_MODE_ID,
          name: '主控模式',
          createdAt: new Date().toISOString(),
          lastSync: null,
          syncStatus: 'N/A'
        }
      ]
    } catch (error) {
      console.error('加载模式列表失败:', error)
      return []
    }
  }
}

export default new ModeManager()