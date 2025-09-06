// src/components/Data/modeManager.js
import { ID } from './services/id.js'

class ModeManager {
  constructor() {
    this.modes = this.loadModesFromStorage()
    // 添加事件监听器列表
    this.listeners = {
      modesChanged: []
    }
  }

  // 添加事件监听
  onModesChanged(callback) {
    this.listeners.modesChanged.push(callback)
    // 返回一个取消监听的函数
    return () => {
      const index = this.listeners.modesChanged.indexOf(callback)
      if (index > -1) {
        this.listeners.modesChanged.splice(index, 1)
      }
    }
  }

  // 触发模式变化事件
  emitModesChanged() {
    this.listeners.modesChanged.forEach(callback => callback())
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
      name: modeId, // 模式名称等于模式ID
      createdAt: new Date().toISOString(),
      lastSync: null,
      syncStatus: '未同步'
    }
    
    this.modes.push(newMode)
    this.saveModesToStorage()
    this.emitModesChanged() // 触发模式变化事件
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
    
    // 删除与该模式相关的所有数据
    this.clearModeData(modeId)
    this.emitModesChanged() // 触发模式变化事件
  }

  // 清理模式相关数据
  clearModeData(modeId) {
    // 清理localStorage中与该模式相关的数据
    const modeDataKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`${modeId}:`)) {
        modeDataKeys.push(key)
      }
    }
    modeDataKeys.forEach(key => localStorage.removeItem(key))
    
    // 清理sessionStorage中与该模式相关的数据
    const sessionDataKeys = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.includes(`:${modeId}:`)) {
        sessionDataKeys.push(key)
      }
    }
    sessionDataKeys.forEach(key => sessionStorage.removeItem(key))
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
      this.emitModesChanged() // 触发模式变化事件
    }
  }

  // 保存模式列表到本地存储
  saveModesToStorage() {
    try {
      localStorage.setItem('app_modes', JSON.stringify(this.modes))
      console.log('[ModeManager] 模式列表已保存到LocalStorage')
    } catch (error) {
      console.error('保存模式列表失败:', error)
    }
  }

  // 从本地存储加载模式列表（不包含root_admin）
  loadModesFromStorage() {
    try {
      const modes = localStorage.getItem('app_modes')
      return modes ? JSON.parse(modes) : []
    } catch (error) {
      console.error('加载模式列表失败:', error)
      return []
    }
  }
}

export default new ModeManager()