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
        // 尝试解析 Key：既可能是 buildKey 产生的，也可能是 buildMetaKey 产生的
        const parsedKey = IdSvc.parseKey(key);
        const parsedMetaKey = IdSvc.parseMetaKey(key);
        
        let targetModeId = null;
        if (parsedKey.valid) { // 是 buildKey 产生的 Key
            targetModeId = parsedKey.modeId;
        } else if (parsedMetaKey.valid) { // 是 buildMetaKey 产生的 Key
            targetModeId = parsedMetaKey.modeId;
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

    // 运行期缓存：版本标签。它将作为 IdSvc.buildKey/buildMetaKey 中的 'version' 参数
    this.versionLabel = 'default_version' // 提供一个默认值
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

    // 2. 初始化版本标签 (从全局存储加载)
    const savedVer = this.longTermStorage.getItem(this.storageKeys.globalCurrentVersion)
    if (savedVer && IdSvc.isValidVersionLabel(savedVer)) {
      this.versionLabel = IdSvc.normalizeVersionLabel(savedVer)
      console.log(`[DataManager] 初始化 - 版本标签设置为: ${this.versionLabel}`)
    } else {
       this.versionLabel = `${this.currentModeId}_v1`; // 默认使用模式ID_v1
       this.longTermStorage.setItem(this.storageKeys.globalCurrentVersion, this.versionLabel);
       console.log(`[DataManager] 初始化 - 默认版本标签设置为: ${this.versionLabel}`)
    }

    // 3. 加载当前模式下的核心数据
    await this.loadQuestionBank()
    await this.loadEnvFullSnapshots()
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
    if (!IdSvc.isValidVersionLabel(v)) throw new Error('版本号无效或为空！')
    this.versionLabel = v
    this.longTermStorage.setItem(this.storageKeys.globalCurrentVersion, v)
    console.log(`[DataManager] 全局版本标签设置为: ${v}`)
    return v
  }

  getVersionLabel() {
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
    // 强制使用 DataManager 的当前模式ID和版本标签，除非显式覆盖
    const actualModeId = modeId != null ? IdSvc.normalizeModeId(modeId) : this.currentModeId; 
    const actualVersionLabel = version != null ? IdSvc.normalizeVersionLabel(version) : this.versionLabel;

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
    // 同上，强制使用 DataManager 的当前模式ID和版本标签，除非显式覆盖
    const actualModeId = modeId != null ? IdSvc.normalizeModeId(modeId) : this.currentModeId; 
    const actualVersionLabel = version != null ? IdSvc.normalizeVersionLabel(version) : this.versionLabel;
    
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

  parseMetaKey(key) {
    return IdSvc.parseMetaKey(key)
  }

  // ========== 按 ExcelID 的便捷存取（卡片级数据，模式隔离） ==========
  getByExcelKey({ type, excelId }) {
    const key = this.buildKey({ type, excelId }); // 隐式使用 currentModeId 和 versionLabel
    return this.longTermStorage.getItem(key);
  }

  setByExcelKey({ type, excelId }, data) {
    const key = this.buildKey({ type, excelId }); // 隐式使用 currentModeId 和 versionLabel
    return this.longTermStorage.setItem(key, data);
  }

  deleteByExcelKey({ type, excelId }) {
    const key = this.buildKey({ type, excelId }); // 隐式使用 currentModeId 和 versionLabel
    if (typeof this.longTermStorage.removeItem === 'function') {
      return this.longTermStorage.removeItem(key)
    }
    console.warn(`[DataManager] 存储策略不支持 removeItem，尝试将 Key '${key}' 的值设置为 null。`);
    return this.longTermStorage.setItem(key, null) // 兜底
  }

  // ========== 题库（核心功能，现在使用 Meta Key 实现模式隔离） ==========
  async loadQuestionBank() {
    const key = this.buildMetaKey({ 
      name: 'question_bank_main' // 标准化名称，与 Excel ID 区分开
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
    const key = this.buildMetaKey({ 
      name: 'question_bank_main' // 标准化名称
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
    const key = this.buildMetaKey({ 
      name: 'env_full_snapshots_main' // 标准化名称
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
    const key = this.buildMetaKey({ 
      name: 'env_full_snapshots_main' // 标准化名称
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