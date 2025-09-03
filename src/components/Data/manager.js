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
        this.versionLabel = defaultVersion
        this.longTermStorage.setItem(this.storageKeys.globalCurrentVersion, this.versionLabel)
        console.log(`[DataManager] 未找到版本标签，使用默认版本: ${this.versionLabel}`)
    }
  }

  getCurrentModeId() {
    return this.currentModeId
  }

  async setCurrentMode(modeId) {
    const normalized = IdSvc.normalizeModeId(modeId)
    if (!IdSvc.isValidModeId(normalized)) {
      throw new Error(`无效的模式ID: ${modeId}`)
    }
    this.currentModeId = normalized
    this.longTermStorage.setItem(this.storageKeys.globalCurrentMode, this.currentModeId)
    console.log(`[DataManager] 当前模式切换为: ${this.currentModeId}`)
  }

  setVersionLabel(label) {
    const v = IdSvc.normalizeVersionLabel(label)
    if (!IdSvc.isValidVersionLabel(v)) {
      throw new Error('版本号不能为空')
    }
    this.versionLabel = v
    this.longTermStorage.setItem(this.storageKeys.globalCurrentVersion, this.versionLabel)
    console.log(`[DataManager] 版本标签设置为: ${this.versionLabel}`)
  }

  getVersionLabel() {
    return this.versionLabel
  }

  setSystemPrefix(prefix) {
    IdSvc.setSystemPrefix(prefix)
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

  // ========== 题库（核心功能，现在使用 固定五段Key 单条存储） ==========
  async loadQuestionBank() {
    // 如果没有设置versionLabel，返回空题库
    if (!this.versionLabel) {
      console.warn('[DataManager] 版本号未设置，返回空题库')
      return { questions: [], categories: [], lastUpdated: null }
    }

    // 读取题库元信息（分类/更新时间）
    const metaKey = this.buildMetaKey({ name: 'questionBank', version: this.versionLabel })
    const meta = this.longTermStorage.getItem(metaKey) || { categories: [], lastUpdated: null }

    // 枚举 localStorage，收集本版本下的题库项
    const questions = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        const parsed = IdSvc.parseKey(k)
        if (!parsed.valid) continue
        // 仅收集：当前系统前缀 + root_admin + 当前版本 + questionBank
        if (
          parsed.prefix === IdSvc.getSystemPrefix() &&
          parsed.type === IdSvc.TYPES.QUESTION_BANK &&
          parsed.version === this.versionLabel &&
          parsed.modeId === IdSvc.ROOT_ADMIN_MODE_ID
        ) {
          const value = this.longTermStorage.getItem(k)
          if (typeof value !== 'string') continue // 题库值为字符串表达式

          const raw = String(value || '').trim()
          const up = raw.replace(/\s+/g, '')
          const [leftPart, rightPart] = up.split('→')
          const leftTokens = (leftPart || '')
            .toUpperCase()
            .split('+')
            .filter(Boolean)
            .filter(t => IdSvc.isOptionExcelId(t))
            .map(t => IdSvc.normalizeExcelId(t))
          // 去重 + 排序
          const unique = Array.from(new Set(leftTokens))
          unique.sort(IdSvc.compareFullOptionIds)
          const left = unique.join('+')
          const content = rightPart || ''

          questions.push({
            id: `q_${Date.now()}_${i}`,
            modeId: parsed.modeId,
            version: parsed.version,
            expression: `${left}→${content}`,
            content,
            left,
            key: `${parsed.modeId}|${parsed.version}|${left}`,
            hash: undefined,
            createdAt: undefined,
            updatedAt: undefined
          })
        }
      }
    } catch (e) {
      console.error('[DataManager] 枚举题库项失败:', e)
    }

    console.log(`[DataManager] 加载题库（按条存储） - version: ${this.versionLabel}`, { count: questions.length })
    return {
      questions,
      categories: meta.categories || [],
      lastUpdated: meta.lastUpdated || null
    }
  }

  async saveQuestionBank(bankData) {
    if (!this.versionLabel) {
      throw new Error('保存题库前必须调用setVersionLabel设置版本号')
    }

    // 1) 清理当前版本下旧的题库条目
    const toRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const parsed = IdSvc.parseKey(k)
      if (parsed.valid &&
          parsed.prefix === IdSvc.getSystemPrefix() &&
          parsed.type === IdSvc.TYPES.QUESTION_BANK &&
          parsed.version === this.versionLabel &&
          parsed.modeId === IdSvc.ROOT_ADMIN_MODE_ID) {
        toRemove.push(k)
      }
    }
    toRemove.forEach(k => this.longTermStorage.removeItem(k))

    // 2) 逐条写入：Key 使用“排序后首个 ExcelID”，若重复则追加 .1/.2...
    const usedExcelIds = new Set()
    const questions = Array.isArray(bankData?.questions) ? bankData.questions : []

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx] || {}
      // 确定原始表达式（优先 q.expression，否则用 q.left + q.content 拼）
      let rawExpr = ''
      if (typeof q.expression === 'string' && q.expression.includes('→')) {
        rawExpr = q.expression
      } else {
        const left0 = String(q.left || '').trim()
        const content0 = String(q.content || '').trim()
        rawExpr = left0 ? `${left0}→${content0}` : content0
      }

      const raw = String(rawExpr || '').trim()
      if (!raw) continue

      const [rawLeft, right] = raw.replace(/\s+/g, '').split('→')
      // 规范化左侧（去空格/转大写/过滤非法/去重/排序）
      const leftTokens = (rawLeft || '')
        .toUpperCase()
        .split('+')
        .filter(Boolean)
        .filter(t => IdSvc.isOptionExcelId(t))
        .map(t => IdSvc.normalizeExcelId(t))
      const unique = Array.from(new Set(leftTokens))
      unique.sort(IdSvc.compareFullOptionIds)
      const left = unique.join('+')
      if (!left) continue // 没有有效选项则跳过

      // 计算“首个 ExcelID”，若重复则生成 A1.1/A1.2...
      let excelId = unique[0]
      while (usedExcelIds.has(excelId)) {
        excelId = IdSvc.generateQuestionBankExcelId(excelId, 'next')
      }
      usedExcelIds.add(excelId)

      // 构建五段 Key（题库强制 root_admin 模式）
      const key = this.buildKey({
        type: IdSvc.TYPES.QUESTION_BANK,
        excelId,
        modeId: IdSvc.ROOT_ADMIN_MODE_ID,
        version: this.versionLabel
      })

      // 存储值 = 标准化表达式：左侧标准顺序 + → + 右侧原文
      const expression = `${left}→${right || ''}`
      this.longTermStorage.setItem(key, expression)
    }

    // 3) 保存题库元信息（分类、最后更新时间）
    const metaKey = this.buildMetaKey({ name: 'questionBank', version: this.versionLabel })
    const dataToSave = {
      categories: Array.isArray(bankData?.categories) ? bankData.categories : [],
      lastUpdated: new Date().toISOString()
    }
    console.log(`[DataManager] 保存题库（按条存储） - 写入 ${usedExcelIds.size} 条`, { meta: dataToSave })
    return this.longTermStorage.setItem(metaKey, dataToSave)
  }

  // 生成“规范化题库条目”用于立即更新前端状态（保存时仍以五段Key逐条写入）
  normalizeQuestion(questionData) {
    const modeId = this.currentModeId || IdSvc.ROOT_ADMIN_MODE_ID
    const version = String(questionData?.version || '').trim()
    const rawExpression = String(questionData?.expression || '').trim()
    const contentIn = String(questionData?.content || '').trim()

    // 组装表达式
    let expression = rawExpression
    if (!expression.includes('→') || expression.endsWith('→')) {
      expression = expression.replace(/→?$/, '→') + contentIn
    }
    const up = expression.replace(/\s+/g, '')
    const [leftPart, rightPart] = up.split('→')

    // 规范化左侧
    const tokens = (leftPart || '')
      .toUpperCase()
      .split('+')
      .filter(Boolean)
      .filter(t => IdSvc.isOptionExcelId(t))
      .map(t => IdSvc.normalizeExcelId(t))
    const unique = Array.from(new Set(tokens))
    unique.sort(IdSvc.compareFullOptionIds)
    const left = unique.join('+')

    const content = rightPart || contentIn || ''
    const normExpr = `${left}→${content}`

    return {
      id: `q_${Date.now()}`,
      modeId,
      version,
      expression: normExpr,
      content,
      left,
      key: `${modeId}|${version}|${left}`,
      hash: undefined,
      difficulty: questionData?.difficulty,
      createdAt: new Date().toISOString(),
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
      throw new Error('保存环境快照前必须调用setVersionLabel设置版本号')
    }
    const key = this.buildKey({
      type: IdSvc.TYPES.ENV_FULL,
      excelId: IdSvc.PLACEHOLDER_MAIN,
      version: this.versionLabel
    })

    // 规范化结构
    const dataToSave = (Array.isArray(snaps) ? snaps : []).map(snap => ({
      version: snap.version || '',
      timestamp: snap.timestamp || Date.now(),
      hash: snap.hash || '',
      environment: snap.environment || {},
      fullConfigs: snap.fullConfigs || {}
    }))

    console.log(`[DataManager] 保存环境快照 - Key: '${key}'`, { data: dataToSave })
    return this.longTermStorage.setItem(key, dataToSave)
  }

  // ========== 答案提交（按模式+版本聚合到 answers:main） ==========
  getAnswersKey({ modeId, version } = {}) {
    const m = modeId != null ? IdSvc.normalizeModeId(modeId) : this.currentModeId
    const v = version != null ? IdSvc.normalizeVersionLabel(version) : this.versionLabel
    if (!v) throw new Error('生成答案存储Key前必须提供版本号')
    return this.buildKey({
      type: IdSvc.TYPES.ANSWERS,
      excelId: IdSvc.PLACEHOLDER_MAIN,
      modeId: m,
      version: v
    })
  }

  async listAnswerSubmissions({ modeId, version } = {}) {
    const key = this.getAnswersKey({ modeId, version })
    const arr = this.longTermStorage.getItem(key)
    const list = Array.isArray(arr) ? arr : []
    console.log(`[DataManager] 加载答案列表 - Key: '${key}', Count: ${list.length}`)
    return list
  }

  async appendAnswerSubmission(submission, { modeId, version } = {}) {
    const key = this.getAnswersKey({ modeId, version })
    // 读取现有
    const current = await this.listAnswerSubmissions({ modeId, version })

    // 规范化提交条目
    const entry = {
      id: `ans_${Date.now()}`,
      modeId: (modeId != null ? IdSvc.normalizeModeId(modeId) : this.currentModeId),
      version: (version != null ? IdSvc.normalizeVersionLabel(version) : this.versionLabel),
      submittedAt: new Date().toISOString(),
      // 原样存放业务数据（cards等），避免丢失字段
      ...submission
    }

    const next = [...current, entry]
    console.log(`[DataManager] 追加答案提交 - Key: '${key}', NewCount: ${next.length}`, { entry })
    return this.longTermStorage.setItem(key, next)
  }

  // —— 覆盖式保存答案（每个五段Key仅保留一份最新提交） ——
  async getAnswerSubmission({ modeId, version } = {}) {
    const key = this.getAnswersKey({ modeId, version })
    const value = this.longTermStorage.getItem(key)
    console.log(`[DataManager] 读取答案（覆盖式）- Key: '${key}', Has: ${value != null}`)
    return value ?? null
  }

  async setAnswerSubmission(value, { modeId, version } = {}) {
    const key = this.getAnswersKey({ modeId, version })
    console.log(`[DataManager] 保存答案（覆盖式）- Key: '${key}'`)
    return this.longTermStorage.setItem(key, value)
  }

  // ========== 清理某模式下所有数据（危险操作） ==========
  async clearModeSpecificData(modeIdToClear) {
    const normalized = IdSvc.normalizeModeId(modeIdToClear)
    return this.longTermStorage.clearAllModeSpecificData(normalized)
  }
}