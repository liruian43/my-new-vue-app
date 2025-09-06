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
      name: modeName,
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

  // 注释：移除模式列表存储，改为基于五段key扫描的虚拟模式管理
  // 模式信息可以通过扫描localStorage中的五段key动态获取
  saveModesToStorage() {
    // 不再需要单独存储模式列表
    console.log('[ModeManager] 模式列表现在基于五段key动态管理，无需单独存储')
  }

  // 从五段key扫描动态获取模式列表
  loadModesFromStorage() {
    try {
      // 使用ID服务扫描localStorage获取所有模式
      const modeIds = ID.extractKeysFields('modeId', {}, localStorage, true)
      const modes = modeIds.map(modeId => ({
        id: modeId,
        name: modeId === ID.ROOT_ADMIN_MODE_ID ? '主控模式' : modeId,
        createdAt: new Date().toISOString(), // 虚拟时间戳
        lastSync: null,
        syncStatus: modeId === ID.ROOT_ADMIN_MODE_ID ? 'N/A' : '未同步'
      }))
      
      // 确保至少包含root_admin模式
      if (!modes.some(m => m.id === ID.ROOT_ADMIN_MODE_ID)) {
        modes.unshift({
          id: ID.ROOT_ADMIN_MODE_ID,
          name: '主控模式',
          createdAt: new Date().toISOString(),
          lastSync: null,
          syncStatus: 'N/A'
        })
      }
      
      return modes
    } catch (error) {
      console.error('扫描模式列表失败:', error)
      return [{
        id: ID.ROOT_ADMIN_MODE_ID,
        name: '主控模式',
        createdAt: new Date().toISOString(),
        lastSync: null,
        syncStatus: 'N/A'
      }]
    }
  }
}

export default new ModeManager()