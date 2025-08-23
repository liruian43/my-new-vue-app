// 说明：本文件只“引用” ID 规则（src/components/Data/services/id.js），不实现任何 ID 逻辑。

import { defineStore } from 'pinia'

// 管理与实例
import DataManager from './manager'
import { dataInstance } from './dataInstance'

// 只保留必要的模块化分片
import * as RootPart from './store-parts/rootMode'
import * as PresetsPart from './store-parts/presets'
import * as CardsPart from './store-parts/cards'
import * as DataSectionPart from './store-parts/dataSection'
import * as ModesPart from './store-parts/modes'
import * as InitPart from './store-parts/init'
import * as ModeLocalEditPart from './store-parts/modeLocalEdit'
import * as EnvPart from './store-parts/envConfigs'
import * as QuestionsPart from './store-parts/questions'
import * as Normalize from './store-parts/normalize'
import * as LongTerm from './services/longTerm'
import * as IO from './services/io'

// 引入校验函数
import { hasAtLeastOneCardAndOptionInSession } from './utils/emptiness'

// 唯一的 ID/Key 规则来源
import * as IdSvc from './services/id' // 确保这里导入的是整个模块，方便访问 IdSvc.ROOT_ADMIN_MODE_ID

import { DataValidator } from './validators/dataValidator'

// 会话存储增强器
export class SessionStorageEnhancer {
  constructor(sessionId) {
    this.sessionId = sessionId || `session_${Date.now()}`
    this.prefix = `${this.sessionId}:`
  }
  // load 方法需要传入 modeId
  load(modeId, dataType) {
    const key = `${this.prefix}${modeId}:${dataType}`
    const data = sessionStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }
  // save 方法需要传入 modeId
  save(modeId, dataType, data) {
    const key = `${this.prefix}${modeId}:${dataType}`
    sessionStorage.setItem(key, JSON.stringify(data))
    return true
  }
  // clear 方法需要传入 modeId
  clear(modeId) {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(`${this.prefix}${modeId}:`)) {
        sessionStorage.removeItem(key)
      }
    })
  }
  clearAll() {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        sessionStorage.removeItem(key)
      }
    })
  }
}

// 常量
export const FIELD_IDS = {
  CARD_COUNT: 'cardCount',
  CARD_ORDER: 'cardOrder',
  OPTIONS: 'options',
  SELECT_OPTIONS: 'selectOptions',

  CARD_TITLE: 'card_title',
  OPTION_NAME: 'option_name',
  OPTION_VALUE: 'option_value',
  OPTION_UNIT: 'option_unit',
  UI_CONFIG: 'ui_config',
  CHECKBOX: 'checkbox',

  DATA_SECTION_ID: 'data_section_id',
  SECTION_TITLE: 'section_title',
  SECTION_ITEMS: 'section_items',
  SECTION_VALIDITY: 'section_validity',
  SECTION_DEPENDENCIES: 'section_dependencies'
}

// 初始化管理器与实例
const dataManager = new DataManager()
const instance = dataInstance.init()
const validator = new DataValidator()
// `sessionStorageEnhancer` 实例在创建时无法获取 modeId，其 `load/save/clear` 方法签名已调整为接收 modeId
const sessionStorageEnhancer = new SessionStorageEnhancer()

// 兼容旧模块：把 ID 能力在 dataManager 上转发
dataManager.validator = validator
dataManager.generateNextCardId = (usedIds = []) =>
  IdSvc.generateNextCardId(usedIds instanceof Set ? usedIds : new Set(usedIds || []))
dataManager.compareCardIds = (a, b) => IdSvc.compareCardIds(String(a || ''), String(b || ''))
dataManager.isValidCardId = (id) => IdSvc.isValidCardId(String(id || ''))

export const useCardStore = defineStore('data', {
  state: () => ({
    // 主模式配置
    rootMode: {
      dataStandards: {
        cardIdPattern: /^[A-Z]+$/,
        optionIdPattern: /^\d+$/,
        fullOptionIdPattern: /^[A-Z]+\d+$/,
        questionExpressionPattern: /^[A-Z]+\d+(?:[+\-\/][A-Z]+\d+)*→$/
      },
      tempOperations: {
        unsavedHistory: []
      },
      configSteps: {}
    },

    // 环境配置区
    environmentConfigs: {
      cards: {},   // { A: { id:'A', ... }, ... }
      options: {}, // { A1: { name, value, unit }, ... }
      uiPresets: [],
      scoringRules: [],
      contextTemplates: []
    },

    // 题库区
    questionBank: {
      questions: [],
      categories: [],
      lastUpdated: null
    },

    // 数据段管理
    dataSection: {
      isManager: false,
      filterType: 'all',
      syncFilter: 'all',
      isPreview: false,
      previewData: { configs: [], questions: [], totalCount: 0 },
      selectAll: false,
      selectedCount: 0,
      tempSelected: []
    },

    // 会话/临时卡片
    tempCards: [],
    sessionCards: [],

    mediumCards: [],
    presetMappings: {},
    selectedCardId: null,
    deletingCardId: null,
    loading: false,
    error: null,
    viewMode: 'tree',
    storageType: localStorage.getItem('storageType') || 'local',
    modes: [],  // 保留但不使用
    currentModeId: IdSvc.ROOT_ADMIN_MODE_ID  // <---- **使用 IdSvc.ROOT_ADMIN_MODE_ID 常量**
  }),

  getters: {
    // 暴露常量
    FIELD_IDS: () => FIELD_IDS,
    
    // 暴露服务实例
    sessionStorageEnhancer: () => sessionStorageEnhancer,
    dataManager: () => dataManager,
    instance: () => instance,
    validator: () => validator,
    longTermStorage: () => dataManager.longTermStorage,

    // 基础模式判断（固定为root_admin）
    isRootMode() { return true }, // <---- 保持简单，因为目前只考虑单模式
    rootMediumData() { return this.mediumCards.filter(card => card.modeId === IdSvc.ROOT_ADMIN_MODE_ID) }, // <---- 使用常量
    rootUnsavedChanges() { return this.rootMode.tempOperations.unsavedHistory.length > 0 },

    // ID 相关校验
    isValidCardId: () => (id) => IdSvc.isValidCardId(String(id || '')),
    isValidOptionId: () => (id) => IdSvc.isValidOptionId(String(id || '')),
    isValidExcelId: () => (id) => IdSvc.isValidExcelId(String(id || '')),

    // 环境配置读取
    getCardById: (s) => (cardId) => (s.sessionCards || []).find(c => c.id === cardId) || null,
    getOptionByFullId: (s) => (fullId) => s.environmentConfigs.options[fullId] || null,
    getOptionsByCardId: (s) => (cardId) => {
      // 这里的 IdSvc.parseFullOptionId 在 envConfigs.js 中已经被替换过，确保导入是正确的
      return Object.entries(s.environmentConfigs.options)
        .filter(([fid]) => fid.startsWith(cardId))
        .map(([fullId, option]) => {
          const { optionId } = IdSvc.parseFullOptionId(fullId)
          return { id: optionId, fullId, ...option }
        })
    },

    // 题库
    allQuestionCategories() { return [...this.questionBank.categories] },
    getQuestionById: (s) => (id) => s.questionBank.questions.find(q => q.id === id),
    isQuestionExpressionValid: (s) => (expression) =>
      s.rootMode.dataStandards.questionExpressionPattern.test(expression),

    // 通用
    selectedCard() {
      let card = this.tempCards.find(c => c.id === this.selectedCardId)
      if (!card) card = this.sessionCards.find(c => c.id === this.selectedCardId)
      return card
    },
    selectedCardPresets() { return this.presetMappings[this.selectedCardId] || {} },
    currentMode() {
      // <---- 这里返回 `this.rootMode` 是根据现有逻辑判断，未来可能需要根据 `this.currentModeId` 动态返回
      return this.rootMode
    },
    currentModeSessionCards() { return [...this.sessionCards] },
    currentModeMediumCards() { return this.mediumCards.filter(c => c.modeId === this.currentModeId) },
    selectedCardEditableFields() {
      return this.selectedCard?.editableFields || {
        optionName: true, optionValue: true, optionUnit: true,
        optionCheckbox: true, optionActions: true, select: true
      }
    },
    sortedSessionCards() { return [...this.sessionCards].sort((a, b) => IdSvc.compareCardIds(a.id, b.id)) },
    sortedTempCards() { return [...this.tempCards].sort((a, b) => IdSvc.compareCardIds(a.id, b.id)) },
    sortedOptions() {
      return (card) => {
        return [...(card?.data?.options || [])].sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))
      }
    },

    // 数据段管理（DataSection）
    dataSectionIsRootMode() {
      // <--- 原本就是字符串 'root_admin' 但现在有 IdSvc.ROOT_ADMIN_MODE_ID
      return IdSvc.ROOT_ADMIN_MODE_ID === this.currentModeId
    },
    dataSectionCurrentMode() { return this.getMode(this.currentModeId) },
    allData() {
      const environmentConfigs = this.environmentConfigs || {}
      const questionBank = this.questionBank || {}

      const contextTemplates = Array.isArray(environmentConfigs.contextTemplates)
        ? environmentConfigs.contextTemplates
        : []
      const questions = Array.isArray(questionBank.questions)
        ? questionBank.questions
        : []

      const configData = contextTemplates.map(item => ({
        id: item.questionId,
        dataType: 'config',
        typeText: '环境配置',
        summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
        modeId: this.currentModeId || '', // <---- 使用当前模式ID
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }))

      const questionData = questions.map(item => ({
        id: item.id,
        dataType: 'question',
        typeText: '资料题库',
        summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
        modeId: this.currentModeId || '', // <---- 使用当前模式ID
        difficulty: item.difficulty || 'medium',
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }))

      const modeData = [
        {
          id: IdSvc.ROOT_ADMIN_MODE_ID, // <---- 使用常量
          dataType: 'root',
          typeText: '主模式',
          summary: '系统主模式，包含所有源数据',
          modeId: IdSvc.ROOT_ADMIN_MODE_ID, // <---- 使用常量
          isModeData: true,
          timestamp: new Date().getTime()
        }
      ]

      return [...configData, ...questionData, ...modeData]
        .sort((a, b) => b.timestamp - a.timestamp)
    },
    filteredData() {
      const sourceData = this.dataSection.isPreview
        ? [...this.dataSection.previewData.configs, ...this.dataSection.previewData.questions].map(item => ({
            ...item,
            summary: item.content || item.questionId || '未命名数据',
            timestamp: item.timestamp || new Date().getTime()
          }))
        : this.allData

      let result = [...sourceData]

      if (this.dataSection.filterType !== 'all') {
        result = result.filter(item => item.dataType === this.dataSection.filterType)
      }

      return result.sort((a, b) => b.timestamp - a.timestamp)
    },
    hasModeDataSelected() {
      return this.filteredData.some(item => item.selected && this.isModeData(item))
    },
    hasPreview() {
      return this.dataSection.previewData.totalCount > 0
    }
  },

  actions: {
    // 初始化
    async initialize() {
      // 在这里 `this` 就是 Pinia store 实例。EnvPart.initialize 内部会通过 this.currentModeId 获取 modeId。
      return InitPart.initialize(this)
    },

    // root_admin 管理
    initRootMode() { return RootPart.initRootMode(this) },
    saveDataStandards(standards) { return RootPart.saveDataStandards(this, standards) },
    recordRootTempOperation(actionType, data) { return RootPart.recordRootTempOperation(this, actionType, data) },
    clearRootTempData() { return RootPart.clearRootTempData(this) },
    updateRootConfigStep(step, validationStatus = {}) { return RootPart.updateRootConfigStep(this, step, validationStatus) },

    // ID 相关对外方法
    compareCardIds(id1, id2) { return IdSvc.compareCardIds(id1, id2) },
    getAllUsedCardIds() { return RootPart.getAllUsedCardIds(this) },
    generateNextCardId() {
      const usedIds = this.getAllUsedCardIds()
      return IdSvc.generateNextCardId(usedIds)
    },
    generateNextOptionId(cardId) {
      const options = this.getOptionsByCardId(cardId).map(o => o.id)
      return IdSvc.generateNextOptionId(options)
    },

    // 环境配置
    // <--- **重要：EnvPart 中的所有方法签名都已调整为接收 store 实例 `this` 作为 `ctx`** --->
    // 这样 EnvPart 内部就可以通过 `ctx.currentModeId` 获取模式 ID。
    async loadEnvironmentConfigs() { return EnvPart.loadEnvironmentConfigs(this) }, // <---- 传递 this
    normalizeCards(cards) { return EnvPart.normalizeCards(this, cards) },
    normalizeOptions(options) { return EnvPart.normalizeOptions(this, options) },
    async saveEnvironmentConfigs(configs) { return EnvPart.saveEnvironmentConfigs(this, configs) }, // <---- 传递 this
    getAllOptionsByCardId(cardId) { return EnvPart.getAllOptionsByCardId(this, cardId) },
    async saveQuestionContext(questionId, contextData) { return EnvPart.saveQuestionContext(this, questionId, contextData) }, // <---- 传递 this
    async getQuestionContext(questionId) { return EnvPart.getQuestionContext(this, questionId) }, // <---- 传递 this
    notifyEnvConfigChanged() {
      // EnvPart.notifyEnvConfigChanged 也会接收 this
      return typeof EnvPart.notifyEnvConfigChanged === 'function'
        ? EnvPart.notifyEnvConfigChanged(this)
        : true
    },

    // 全量环境（版本化）
    async listEnvFullSnapshots() {
      // dataManager?.loadEnvFullSnapshots 内部可能需要 modeId，所以我们统一在 actions 层面传递 `this`
      // EnvPart.listEnvFullSnapshots 已经修改为接收 `this`
      return EnvPart.listEnvFullSnapshots(this); // <---- 传递 this
    },
    
    async saveEnvFullSnapshot(versionLabel) {
      // EnvPart.saveEnvFullSnapshot 已经修改为接收 `this`
      return EnvPart.saveEnvFullSnapshot(this, versionLabel); // <---- 传递 this
    },

    async applyEnvFullSnapshot(versionLabel) {
      // EnvPart.applyEnvFullSnapshot 已经修改为接收 `this`
      return EnvPart.applyEnvFullSnapshot(this, versionLabel); // <---- 传递 this
    },

    // 题库
    async loadQuestionBank() {
      // dataManager 的 loadQuestionBank 可能需要 modeId，但这不是 envConfigs.js 的职能
      // 假设 dataManager 内部自行处理了 modeId 或 modeId 不影响其逻辑
      const bank = await this.dataManager.loadQuestionBank()
      this.questionBank = bank
      return bank
    },
    async addQuestionToBank(payload) {
      const normalizedQuestion = this.dataManager.normalizeQuestion(payload)
      const bank = await this.dataManager.loadQuestionBank()
      bank.questions.push(normalizedQuestion)
      await this.dataManager.saveQuestionBank(bank)
      this.questionBank = bank
      return normalizedQuestion
    },
    async removeQuestionFromBank(id) {
      const bank = await this.dataManager.loadQuestionBank()
      bank.questions = bank.questions.filter(q => q.id !== id)
      await this.dataManager.saveQuestionBank(bank)
      this.questionBank = bank
      return true
    },

    // 预设
    loadPresetMappings() { return PresetsPart.loadPresetMappings(this) },
    savePresetMappings() { return PresetsPart.savePresetMappings(this) },
    savePresetForSelectOption(cardId, selectOptionId, checkedOptions) { return PresetsPart.savePresetForSelectOption(this, cardId, selectOptionId, checkedOptions) },
    applyPresetToCard(cardId, selectOptionId) { return PresetsPart.applyPresetToCard(this, cardId, selectOptionId) },

    // 会话卡片 / 临时卡片 / 选项等操作
    loadSessionCards(modeId) { return CardsPart.loadSessionCards(this, modeId || this.currentModeId) }, // <---- 确保传递 this.currentModeId
    normalizeCardStructure(card) { return CardsPart.normalizeCardStructure(this, card) },
    addCard(cardData) { return CardsPart.addCard(this, cardData) },
    deleteCard(cardId) { return CardsPart.deleteCard(this, cardId) },
    updateSessionCard(updatedCard) { return CardsPart.updateSessionCard(this, updatedCard) },
    updateCardTitle(cardId, newTitle) { return CardsPart.updateCardTitle(this, cardId, newTitle) },
    updateCardOptions(cardId, updatedOptions) { return CardsPart.updateCardOptions(this, cardId, updatedOptions) },
    addOption(cardId, afterId) { return CardsPart.addOption(this, cardId, afterId) },
    deleteOption(cardId, optionId) { return CardsPart.deleteOption(this, cardId, optionId) },
    addSelectOption(cardId, label) { return CardsPart.addSelectOption(this, cardId, label) },
    deleteSelectOption(cardId, optionId) { return CardsPart.deleteSelectOption(this, cardId, optionId) },
    setShowDropdown(cardId, value) { return CardsPart.setShowDropdown(this, cardId, value) },
    generateNextSelectOptionId(cardId) { return CardsPart.generateNextSelectOptionId(this, cardId) },
    toggleSelectEditing(cardId) { return CardsPart.toggleSelectEditing(this, cardId) },
    toggleTitleEditing(cardId) { return CardsPart.toggleTitleEditing(this, cardId) },
    toggleTitleEditingForRoot(cardId) { return CardsPart.toggleTitleEditingForRoot(this, cardId) },
    toggleOptionsEditing(cardId) { return CardsPart.toggleOptionsEditing(this, cardId) },
    togglePresetEditing(cardId) { return CardsPart.togglePresetEditing(this, cardId) },
    toggleEditableField(cardId, field) { return CardsPart.toggleEditableField(this, cardId, field) },
    saveSessionCards(modeId) { return CardsPart.saveSessionCards(this, modeId || this.currentModeId) }, // <---- 确保传递 this.currentModeId
    validateConfiguration() { return CardsPart.validateConfiguration(this) },
    loadAllMediumCards() { return CardsPart.loadAllMediumCards(this) },
    saveToMedium() { return CardsPart.saveToMedium(this) },
    removeFromMedium(cardIds) { return CardsPart.removeFromMedium(this, cardIds) },
    loadFromMedium(mediumCardIds) { return CardsPart.loadFromMedium(this, mediumCardIds) },
    addTempCard(initialData = {}) { return CardsPart.addTempCard(this, initialData) },
    updateTempCard(updatedCard) { return CardsPart.updateTempCard(this, updatedCard) },
    promoteToSession(cardIds) { return CardsPart.promoteToSession(this, cardIds) },
    updateCardSelectedValue(cardId, newValue) { return CardsPart.updateCardSelectedValue(this, cardId, newValue) },

    // 导出 / 导入
    exportData(fileName = 'card_data.json') {
      // IO.exportData 需要 modeId
      return IO.exportData(this.longTermStorage, { modeId: this.currentModeId, fileName }) // <---- 传入 this.currentModeId
    },
    async importData(file) {
      // IO.importToLongTerm 需要 modeId
      return IO.importFromFile(file).then(data =>
        IO.importToLongTerm(this.longTermStorage, data, { modeId: this.currentModeId }) // <---- 传入 this.currentModeId
      )
    },

    // 模式管理（仅保留主模式相关）
    getMode(modeId) { return ModesPart.getMode(this, this.longTermStorage, modeId) },

    // 数据段管理
    isModeData(item) { return DataSectionPart.isModeData(this, item) },
    generateTooltip(item) { return DataSectionPart.generateTooltip(this, item) },
    getModeClass(item) { return DataSectionPart.getModeClass(this, item) },
    canEditItem(item) { return DataSectionPart.canEditItem(this, item) },
    updateSelected() { return DataSectionPart.updateSelected(this) },
    handleSelectAll() { return DataSectionPart.handleSelectAll(this) },
    async deleteItem(item) { return DataSectionPart.deleteItem(this, item) },
    async deleteSelected() { return DataSectionPart.deleteSelected(this) },
    async importDataFromFile(file) { return DataSectionPart.importDataFromFile(this, file) },
    async exportDataSection() { return DataSectionPart.exportDataSection(this) },
    async applyPreview() { return DataSectionPart.applyPreview(this) },
    cancelPreview() { return DataSectionPart.cancelPreview(this) },
    toggleManager() { return DataSectionPart.toggleManager(this) },
    clearFilters() { return DataSectionPart.clearFilters(this) },
    normalizeQuestion(question) { return this.dataManager.normalizeQuestion(question) },

    // 模式切换（固定为root_admin）
    setCurrentMode() {
      this.currentModeId = IdSvc.ROOT_ADMIN_MODE_ID // <---- 使用常量
      this.dataManager.setCurrentMode(IdSvc.ROOT_ADMIN_MODE_ID) // <---- 使用常量
      this.instance.state.currentMode = IdSvc.ROOT_ADMIN_MODE_ID // <---- 使用常量
    },

    // 模式内本地编辑
    updateModeCardLocalValue(modeId, cardId, fieldType, optIndex, value) {
      return ModeLocalEditPart.updateModeCardLocalValue(this, modeId || this.currentModeId, cardId, fieldType, optIndex, value) // <---- 确保传递 this.currentModeId
    },

    // Normalize 工具
    normalizeNullValue(value) {
      return Normalize.normalizeNullValue(value)
    },
    normalizeDataStructure(data, template) {
      return Normalize.normalizeDataStructure(data, template)
    },

    // 长期存储
    saveToLongTerm(modeId, namespace, dataId, data) {
      // LongTerm.saveToLongTerm 签名已调整为接收 modeId
      return LongTerm.saveToLongTerm(this.longTermStorage, modeId || this.currentModeId, namespace, dataId, data, this.validator) // <---- 确保传递 this.currentModeId
    },
    getFromLongTerm(modeId, namespace, dataId) {
      // LongTerm.getFromLongTerm 签名已调整为接收 modeId
      return LongTerm.getFromLongTerm(this.longTermStorage, modeId || this.currentModeId, namespace, dataId) // <---- 确保传递 this.currentModeId
    },
    deleteFromLongTerm(modeId, namespace, dataId) {
      // LongTerm.deleteFromLongTerm 签名已调整为接收 modeId
      return LongTerm.deleteFromLongTerm(this.longTermStorage, modeId || this.currentModeId, namespace, dataId) // <---- 确保传递 this.currentModeId
    },
    clearLongTermByMode(modeId) {
      // LongTerm.clearLongTermByMode 签名已调整为接收 modeId
      return LongTerm.clearLongTermByMode(this.longTermStorage, modeId || this.currentModeId, this.dataManager.rootAdminId) // <---- 确保传递 this.currentModeId
    }
  }
})