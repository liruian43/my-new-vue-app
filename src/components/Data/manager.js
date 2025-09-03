// src/components/Data/manager.js
import * as Normalize from './store-parts/normalize'
import * as IdSvc from './services/id' // 统一 ID/Key 规则来源

// 本地存储实现类
class BrowserLocalStorage {
  // 获取存储的项
  getItem(key) {
    try {
      const value = localStorage.getItem(key)
      const result = value ? JSON.parse(value) : null
      if (value !== null) { // 仅在数据实际存在时记录“恢复”日志
        console.log(`[LocalStorage] 恢复数据 - Key: '${key}'`, { value: result })
      }
      return result
    } catch (error) {
      console.error(`[LocalStorage] 获取本地存储项 '${key}' 失败:`, error)
      return null
    }
  }

  // 设置存储的项
  setItem(key, value) {
    try {
      console.log(`[LocalStorage] 保存数据 - Key: '${key}'`, { value })
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.error(`[LocalStorage] 设置本地存储项 '${key}' 失败:`, error)
      return false
    }
  }

  // 移除存储的项
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      console.log(`[LocalStorage] 移除数据 - Key: '${key}'`)
      return true
    } catch (error) {
      console.error(`[LocalStorage] 移除本地存储项 '${key}' 失败:`, error)
      return false
    }
  }

  // 清除所有模式隔离的 Key
  clearAllModeSpecificData(modeId) {
    console.warn(`[LocalStorage] 开始清除模式 '${modeId}' 下的所有数据...`)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // 统一使用parseKey解析
        const parsedKey = IdSvc.parseKey(key);
        
        let targetModeId = null;
        if (parsedKey.valid) { // 有效的Key
            targetModeId = parsedKey.modeId;
        }

        if (targetModeId === modeId) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => {
        this.removeItem(key); // 调用内部的 removeItem
    });
    console.warn(`[LocalStorage] 模式 '${modeId}' 下共清除了 ${keysToRemove.length} 条数据。`)
    return keysToRemove.length;
}

  // 清除所有存储的项（可选实现，谨慎使用）
  clear() {
    try {
      localStorage.clear()
      console.warn('[LocalStorage] 已清除所有本地存储数据！')
      return true
    } catch (error) {
      console.error('[LocalStorage] 清除所有本地存储失败:', error)
      return false
    }
  }
}

export default class DataManager {
  constructor(storageStrategy) {
    this.longTermStorage = storageStrategy || new BrowserLocalStorage()
    this.rootAdminId = IdSvc.ROOT_ADMIN_MODE_ID // 从 IdSvc 获取常量
    this.currentModeId = this.rootAdminId // 默认当前模式ID

    // 全局存储键名（非模式隔离，直接使用常量）
    this.storageKeys = {
      globalCurrentMode: 'global_current_mode', 
      globalCurrentVersion: 'global_current_version_label' 
    }

    // 版本标签必须显式传递，不再提供默认值
    this.versionLabel = null
  }

  // ========== 初始化 ==========
  async initialize() {
    // 1. 初始化当前模式 ID (从全局存储加载)
    const savedMode = this.longTermStorage.getItem(this.storageKeys.globalCurrentMode)
    if (savedMode && IdSvc.isValidModeId(savedMode)) {
        this.currentModeId = savedMode
    } else {
        this.currentModeId = this.rootAdminId; // 默认 root_admin
        this.longTermStorage.setItem(this.storageKeys.globalCurrentMode, this.currentModeId);
    }
    console.log(`[DataManager] 初始化 - 当前模式设置为: ${this.currentModeId}`)
    
    // 2. 初始化版本标签（使用id.js规范化，确保五段Key系统正常工作）
    const savedVersion = this.longTermStorage.getItem(this.storageKeys.globalCurrentVersion)
    if (savedVersion && IdSvc.isValidVersionLabel(savedVersion)) {
        this.versionLabel = IdSvc.normalizeVersionLabel(savedVersion)
        console.log(`[DataManager] 从存储加载版本标签: ${this.versionLabel}`)
    } else {
        // 使用id.js方法设置默认版本，确保符合规范
        const defaultVersion = IdSvc.normalizeVersionLabel('v1.0.0')
        this.setVersionLabel(defaultVersion) // 这会调用id.js的验证和存储
        console.log(`[DataManager] 设置默认版本标签: ${this.versionLabel}`)
    }
    
    // 3. 不强制加载数据，只有实际使用时才校验
    return true
  }

  // ========== 当前模式管理 ==========
  getCurrentModeId() {
    return this.currentModeId
  }

  async setCurrentMode(modeId) {
    if (!IdSvc.isValidModeId(modeId)) {
        console.error(`[DataManager] 尝试切换到无效模式ID: ${modeId}`);
        return;
    }
    if (modeId === this.currentModeId) {
        console.log(`[DataManager] 模式已经是 ${modeId}，不进行切换。`);
        return;
    }

    this.currentModeId = modeId;
    console.log(`[DataManager] 切换模式至: ${this.currentModeId}`);
    this.longTermStorage.setItem(this.storageKeys.globalCurrentMode, this.currentModeId);

    // 模式切换后，重新加载该模式下的数据
    await this.loadQuestionBank()
    await this.loadEnvFullSnapshots()
  }

  // ========== 版本标签管理（会影响 Key 的 'version' 段） ==========
  setVersionLabel(label) {
    const v = IdSvc.normalizeVersionLabel(label)
    if (!IdSvc.isValidVersionLabel(v)) {
      throw new Error('版本号必须是非空字符串')
    }
    this.versionLabel = v
    this.longTermStorage.setItem(this.storageKeys.globalCurrentVersion, v)
    console.log(`[DataManager] 版本号设置为: ${v}`)
    return v
  }

  getVersionLabel() {
    if (!this.versionLabel) {
      throw new Error('版本号未设置，请先调用setVersionLabel')
    }
    return this.versionLabel
  }

  // ========== 系统前缀管理（直接转发到 IdSvc） ==========
  setSystemPrefix(prefix) {
    IdSvc.setSystemPrefix(prefix)
    console.log(`[DataManager] 系统前缀设置为: ${IdSvc.getSystemPrefix()}`)
    return IdSvc.getSystemPrefix()
  }

  getSystemPrefix() {
    return IdSvc.getSystemPrefix()
  }

  // ========== ID 工具（直接转发到 IdSvc） ==========
  generateNextCardId(usedIds = []) {
    return IdSvc.generateNextCardId(usedIds)
  }

  compareCardIds(a, b) {
    return IdSvc.compareCardIds(a, b)
  }

  isValidCardId(id) {
    return IdSvc.isValidCardId(id)
  }

  // ========== Key 构建（核心） ==========
  // 负责构建五段式 Key，正确传递 modeId 和 version
  buildKey({ type, excelId, modeId, version, prefix } = {}) {
    if (version === undefined || version === null) {
      throw new Error('version参数必须显式传递，不允许为null或undefined。请确保：\n1. 已调用setVersionLabel设置版本号\n2. 调用buildKey时显式传递version参数')
    }
    const actualModeId = modeId != null ? IdSvc.normalizeModeId(modeId) : this.currentModeId;
    const actualVersionLabel = IdSvc.normalizeVersionLabel(version);
    if (!IdSvc.isValidVersionLabel(actualVersionLabel)) {
      throw new Error(`无效的版本号: ${version}。版本号必须是非空字符串`)
    }

    return IdSvc.buildKey({ 
      prefix: prefix || IdSvc.getSystemPrefix(),
      modeId: actualModeId,
      version: actualVersionLabel, 
      type: type, 
      excelId: excelId 
    });
  }

  // 负责构建 Meta Key （处理整个题库/环境快照等大块数据）
  buildMetaKey({ name, modeId, version, prefix } = {}) {
    if (!version) throw new Error('version参数必须显式传递')
    const actualModeId = modeId != null ? IdSvc.normalizeModeId(modeId) : this.currentModeId;
    const actualVersionLabel = IdSvc.normalizeVersionLabel(version);
    
    return IdSvc.buildMetaKey({ 
      prefix: prefix || IdSvc.getSystemPrefix(),
      modeId: actualModeId,
      version: actualVersionLabel, 
      name: name 
    });
  }

  parseKey(key) {
    return IdSvc.parseKey(key)
  }

  // 不再需要单独的parseMetaKey方法
  // 所有Key都通过parseKey解析

  // ========== 按 ExcelID 的便捷存取（卡片级数据，模式隔离） ==========
  getByExcelKey({ type, excelId }) {
    const key = this.buildKey({ type, excelId, version: this.versionLabel }); // 显式使用 current version
    return this.longTermStorage.getItem(key);
  }

  setByExcelKey({ type, excelId }, data) {
    const key = this.buildKey({ type, excelId, version: this.versionLabel }); // 显式使用 current version
    return this.longTermStorage.setItem(key, data);
  }

  deleteByExcelKey({ type, excelId }) {
    const key = this.buildKey({ type, excelId, version: this.versionLabel }); // 显式使用 current version
    if (typeof this.longTermStorage.removeItem === 'function') {
      return this.longTermStorage.removeItem(key)
    }
    console.warn(`[DataManager] 存储策略不支持 removeItem，尝试将 Key '${key}' 的值设置为 null。`);
    return this.longTermStorage.setItem(key, null) // 兜底
  }

  // ========== 题库（核心功能，现在使用 Meta Key 实现模式隔离） ==========
  async loadQuestionBank() {
    // 如果没有设置versionLabel，返回空题库
    if (!this.versionLabel) {
      console.warn('[DataManager] 版本号未设置，返回空题库')
      return { questions: [], categories: [], lastUpdated: null }
    }
    const key = this.buildMetaKey({
      name: 'questionBank',
      version: this.versionLabel
    });
    
    const bank = this.longTermStorage.getItem(key) || {
      questions: [],
      categories: [],
      lastUpdated: null
    };

    console.log(`[DataManager] 加载题库 - Key: '${key}'`, { data: bank });
    return bank;
  }

  async saveQuestionBank(bankData) {
    if (!this.versionLabel) {
      throw new Error('保存题库前必须调用setVersionLabel设置版本号')
    }
    const key = this.buildMetaKey({
      name: 'questionBank',
      version: this.versionLabel
    });

    const dataToSave = {
      ...bankData,
      lastUpdated: new Date().toISOString()
    };

    console.log(`[DataManager] 保存题库 - Key: '${key}'`, { data: dataToSave });
    return this.longTermStorage.setItem(key, dataToSave);
  }

  normalizeQuestion(questionData) {
    return {
      id: questionData.id || `q_${Date.now()}`, 
      content: Normalize.normalizeNullValue(questionData.content),
      explanation: Normalize.normalizeNullValue(questionData.explanation),
      categories: questionData.categories || [],
      difficulty: questionData.difficulty || 'medium',
      options: questionData.options || [],
      correctAnswer: Normalize.normalizeNullValue(questionData.correctAnswer),
      environmentConfig: questionData.environmentConfig || {
        uiConfig: {},
        scoringRules: [],
        timeLimit: null
      },
      createdAt: questionData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  // ========== 环境全量快照（核心功能，现在使用 Meta Key 实现模式隔离） ==========
  async loadEnvFullSnapshots() {
    // 如果没有设置versionLabel，返回空快照
    if (!this.versionLabel) {
      console.warn('[DataManager] 版本号未设置，返回空快照列表')
      return []
    }
    const key = this.buildKey({
      type: IdSvc.TYPES.ENV_FULL,
      excelId: IdSvc.PLACEHOLDER_MAIN,
      version: this.versionLabel
    });

    const snaps = this.longTermStorage.getItem(key) || [];
    const result = snaps.map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {}, 
      fullConfigs: snap.fullConfigs || {} 
    }));

    console.log(`[DataManager] 加载环境快照 - Key: '${key}'`, { data: result });
    return result;
  }

  async saveEnvFullSnapshots(snaps) {
    if (!this.versionLabel) {
      throw new Error('保存快照前必须调用setVersionLabel设置版本号')
    }
    const key = this.buildKey({
      type: IdSvc.TYPES.ENV_FULL,
      excelId: IdSvc.PLACEHOLDER_MAIN,
      version: this.versionLabel
    });

    const validated = snaps.map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {},
      fullConfigs: snap.fullConfigs || {}
    }));

    console.log(`[DataManager] 保存环境快照 - Key: '${key}'`, { data: validated });
    return this.longTermStorage.setItem(key, validated);
  }

  // ========== 清理某个模式的所有数据 ==========
  async clearModeSpecificData(modeIdToClear) {
      if (modeIdToClear === this.rootAdminId) {
          console.error(`[DataManager] 拒绝清除根管理员模式 (${this.rootAdminId}) 的数据。`);
          return false;
      }
      if (!IdSvc.isValidModeId(modeIdToClear)) {
          console.error(`[DataManager] 未提供或提供了无效的模式ID (${modeIdToClear}) 来清除数据。`);
          return false;
      }

      console.log(`[DataManager] 尝试清除模式 '${modeIdToClear}' 的所有数据...`);
      const removedCount = this.longTermStorage.clearAllModeSpecificData(modeIdToClear);
      console.log(`[DataManager] 成功清除了模式 '${modeIdToClear}' 下的 ${removedCount} 条数据。`);
      return true;
  }
}