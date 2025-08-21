// src/components/Data/manager.js
import { LocalStorageStrategy } from './storage/LocalStorageStrategy'
import * as Normalize from './store-parts/normalize'
import * as IdSvc from './services/id' // 统一 ID/Key 规则来源

export default class DataManager {
  constructor(storageStrategy) {
    this.longTermStorage = storageStrategy || new LocalStorageStrategy()
    this.rootAdminId = 'root_admin'
    this.currentModeId = this.rootAdminId

    // 仅保留核心功能所需的存储键名 + 新增“当前版本号”
    this.storageKeys = {
      questionBank: 'question_bank',
      envFullSnapshots: 'env_full_snapshots',
      currentMode: 'current_mode',
      currentVersion: 'current_version_label' // 新增：保存“版号”（任意非空字符串，外部保证唯一）
    }

    // 运行期缓存（便于 buildKey 默认取用）
    this.versionLabel = '' // 例如：'V1' 或 '抓娃娃'
  }

  // ========== 初始化（仅保留核心数据加载） ==========
  async initialize() {
    // 当前模式初始化
    const savedMode = this.longTermStorage.getItem(this.storageKeys.currentMode)
    if (savedMode) this.currentModeId = savedMode

    // 版本号初始化（可选）
    const savedVer = this.longTermStorage.getItem(this.storageKeys.currentVersion)
    if (savedVer && IdSvc.isValidVersionLabel(savedVer)) {
      this.versionLabel = IdSvc.normalizeVersionLabel(savedVer)
    }

    // 仅加载核心数据（返回值按需使用）
    await this.loadQuestionBank()
    await this.loadEnvFullSnapshots()
  }

  // ========== 当前模式管理（核心依赖） ==========
  getCurrentModeId() {
    return this.currentModeId
  }

  setCurrentMode(modeId) {
    this.currentModeId = modeId
    this.longTermStorage.setItem(this.storageKeys.currentMode, modeId)
  }

  // ========== 版号（Version）管理：仅转发/持久化，不做唯一性判定 ==========
  setVersionLabel(label) {
    const v = IdSvc.normalizeVersionLabel(label)
    if (!IdSvc.isValidVersionLabel(v)) throw new Error('版本号不能为空')
    this.versionLabel = v
    this.longTermStorage.setItem(this.storageKeys.currentVersion, v)
    return v
  }

  getVersionLabel() {
    return this.versionLabel
  }

  // ========== 系统前缀（命名空间）管理：转发到 IdSvc ==========
  setSystemPrefix(prefix) {
    IdSvc.setSystemPrefix(prefix)
    return IdSvc.getSystemPrefix()
  }

  getSystemPrefix() {
    return IdSvc.getSystemPrefix()
  }

  // ========== ID 工具（仅转发到 IdSvc，保持“统一来源”） ==========
  // 供旧代码或其他模块通过 dataManager 调用时使用
  generateNextCardId(usedIds = []) {
    const set = usedIds instanceof Set ? usedIds : new Set(usedIds || [])
    return IdSvc.generateNextCardId(set)
  }

  compareCardIds(a, b) {
    return IdSvc.compareCardIds(String(a || ''), String(b || ''))
  }

  isValidCardId(id) {
    return IdSvc.isValidCardId(String(id || ''))
  }

  // ========== Key 构建/解析（固定四段：prefix:version:type:excelId） ==========
  // 默认使用当前 versionLabel；也可手动传入 version 覆盖
  buildKey({ type, excelId, version, prefix } = {}) {
    const v = version != null ? version : this.versionLabel
    if (!IdSvc.isValidVersionLabel(v)) {
      throw new Error('未设置有效的版本号（请先调用 setVersionLabel）')
    }
    return IdSvc.buildKey({ type, excelId, version: v, prefix })
  }

  parseKey(key) {
    return IdSvc.parseKey(key)
  }

  // ========== 按 ExcelID 的便捷存取（题库/全量区） ==========
  // 用法示例：
  //   setByExcelKey({ type: IdSvc.TYPES.ENV_FULL, excelId: 'A6' }, data)
  //   const data = getByExcelKey({ type: IdSvc.TYPES.ENV_FULL, excelId: 'A6' })
  getByExcelKey({ type, excelId, version, prefix } = {}) {
    const key = this.buildKey({ type, excelId, version, prefix })
    return this.longTermStorage.getItem(key)
  }

  setByExcelKey({ type, excelId, version, prefix } = {}, data) {
    const key = this.buildKey({ type, excelId, version, prefix })
    return this.longTermStorage.setItem(key, data)
  }

  deleteByExcelKey({ type, excelId, version, prefix } = {}) {
    const key = this.buildKey({ type, excelId, version, prefix })
    if (typeof this.longTermStorage.removeItem === 'function') {
      return this.longTermStorage.removeItem(key)
    }
    // 兜底：如果 storage 没有 removeItem，就写入 null
    return this.longTermStorage.setItem(key, null)
  }

  // ========== 题库（核心功能，保持现状） ==========
  async loadQuestionBank() {
    const bank =
      this.longTermStorage.getItem(this.storageKeys.questionBank) || {
        questions: [],
        categories: [],
        lastUpdated: null
      }
    return bank
  }

  async saveQuestionBank(bankData) {
    return this.longTermStorage.setItem(this.storageKeys.questionBank, {
      ...bankData,
      lastUpdated: new Date().toISOString()
    })
  }

  normalizeQuestion(questionData) {
    // 注意：题库项的 id 与“卡片/选项 ExcelID”无关
    // 若需要把题库项也纳入你的 ExcelID 体系，请在外层传入你期望的 id
    return {
      id: questionData.id || `q_${Date.now()}`, // 若你不希望时间戳，请在外部传入稳定 id
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

  // ========== 环境全量快照（核心功能，保持现状） ==========
  async loadEnvFullSnapshots() {
    const snaps = this.longTermStorage.getItem(this.storageKeys.envFullSnapshots) || []
    return snaps.map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {},
      fullConfigs: snap.fullConfigs || {}
    }))
  }

  async saveEnvFullSnapshots(snaps) {
    const validated = snaps.map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {},
      fullConfigs: snap.fullConfigs || {}
    }))
    return this.longTermStorage.setItem(this.storageKeys.envFullSnapshots, validated)
  }
}