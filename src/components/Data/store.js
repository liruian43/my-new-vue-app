// src/components/Data/store.js
// 说明：本文件只“引用” ID 规则（src/components/Data/services/id.js），不实现任何 ID 逻辑。

import { defineStore } from 'pinia'

// 管理与实例
import DataManager from './manager'
import { dataInstance } from './dataInstance'

// 只保留必要的模块化分片（删除了已移除的模块引用）
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

// 引入 emptiness.js中的校验函数
import { hasAtLeastOneCardAndOptionInSession } from './utils/emptiness'

// 唯一的 ID/Key 规则来源（仅引用）
import * as IdSvc from './services/id'

import { DataValidator } from './validators/dataValidator'

// 会话存储增强器（与 ID 无关，保留）
export class SessionStorageEnhancer {
  constructor(sessionId) {
    this.sessionId = sessionId || `session_${Date.now()}`
    this.prefix = `${this.sessionId}:`
  }
  load(modeId, dataType) {
    const key = `${this.prefix}${modeId}:${dataType}`
    const data = sessionStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }
  save(modeId, dataType, data) {
    const key = `${this.prefix}${modeId}:${dataType}`
    sessionStorage.setItem(key, JSON.stringify(data))
    return true
  }
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

// 常量（非 ID 逻辑）
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

// 初始化管理器与实例（在store外部初始化，不作为state属性）
const dataManager = new DataManager()
const instance = dataInstance.init()
const validator = new DataValidator()
const sessionStorageEnhancer = new SessionStorageEnhancer() // 在这里实例化

// 兼容旧模块：把 ID 能力在 dataManager 上转发（仅转发，不实现）
dataManager.validator = validator
dataManager.generateNextCardId = (usedIds = []) =>
  IdSvc.generateNextCardId(usedIds instanceof Set ? usedIds : new Set(usedIds || []))
dataManager.compareCardIds = (a, b) => IdSvc.compareCardIds(String(a || ''), String(b || ''))
dataManager.isValidCardId = (id) => IdSvc.isValidCardId(String(id || ''))

export const useCardStore = defineStore('data', {
  state: () => ({
    // 主模式配置（非 ID 逻辑）
    rootMode: {
      dataStandards: {
        // 保留原有正则配置，但校验请统一用 IdSvc
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

    // 环境配置区（与实例 state 解耦）
    environmentConfigs: {
      cards: {},   // { A: { id:'A', ... }, ... }
      options: {}, // { A1: { name, value, unit }, ... }
      uiPresets: [],
      scoringRules: [],
      contextTemplates: []
      // 删除联动控制相关配置，因为相关模块已移除
    },

    // 题库区（通过 manager 读写）
    questionBank: {
      questions: [],
      categories: [],
      lastUpdated: null
    },

    // 其他状态（删除联动同步相关状态）
    subModes: {
      instances: [],
      activeInstanceId: null
      // 删除隔离策略和解析数据，因为相关模块已移除
    },
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

    // 会话/临时卡片（与实例 state 解耦）
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
    modes: [],
    currentModeId: instance.state.currentMode, // 初始可与实例同步，但仅保存字符串
    modeRoutes: {} // 保留但不使用，后续可彻底移除
  }),

  getters: {
    // 暴露常量（通过getter访问，而非state）
    FIELD_IDS: () => FIELD_IDS,
    
    // 暴露服务实例（通过getter访问，避免放在state中）
    sessionStorageEnhancer: () => sessionStorageEnhancer,
    dataManager: () => dataManager,
    instance: () => instance,
    validator: () => validator,
    longTermStorage: () => dataManager.longTermStorage,

    // 保留基础模式判断
    isRootMode() { return this.currentModeId === 'root_admin' },
    rootMediumData() { return this.mediumCards.filter(card => card.modeId === 'root_admin') },
    rootUnsavedChanges() { return this.rootMode.tempOperations.unsavedHistory.length > 0 },

    // ID 相关校验：统一转发到 IdSvc
    isValidCardId: () => (id) => IdSvc.isValidCardId(String(id || '')),
    isValidOptionId: () => (id) => IdSvc.isValidOptionId(String(id || '')),
    isValidExcelId: () => (id) => IdSvc.isValidExcelId(String(id || '')),

    // 环境配置读取
    getCardById: (s) => (cardId) => (s.sessionCards || []).find(c => c.id === cardId) || null,
    getOptionByFullId: (s) => (fullId) => s.environmentConfigs.options[fullId] || null,
    getOptionsByCardId: (s) => (cardId) => {
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

    // 子模式
    activeSubMode() { return this.subModes.instances.find(i => i.id === this.subModes.activeInstanceId) },

    // 通用
    selectedCard() {
      let card = this.tempCards.find(c => c.id === this.selectedCardId)
      if (!card) card = this.sessionCards.find(c => c.id === this.selectedCardId)
      return card
    },
    selectedCardPresets() { return this.presetMappings[this.selectedCardId] || {} },
    currentMode() {
      return this.currentModeId === 'root_admin'
        ? this.rootMode
        : (this.modes.find(m => m.id === this.currentModeId) || null)
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
        // 选项本身是数字 ID，直接数值排序
        return [...(card?.data?.options || [])].sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))
      }
    },

    // 数据段管理（DataSection）
    dataSectionIsRootMode() {
      return dataManager.rootAdminId === this.currentModeId
    },
    dataSectionCurrentMode() { return this.getMode(this.currentModeId) },
    allData() {
      const environmentConfigs = this.environmentConfigs || {}
      const questionBank = this.questionBank || {}
      const modes = this.subModes.instances || []

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
        modeId: this.currentModeId || '',
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }))

      const questionData = questions.map(item => ({
        id: item.id,
        dataType: 'question',
        typeText: '资料题库',
        summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
        modeId: this.currentModeId || '',
        difficulty: item.difficulty || 'medium',
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }))

      const modeData = [
        {
          id: dataManager.rootAdminId || 'root_admin',
          dataType: 'root',
          typeText: '主模式',
          summary: '系统主模式，包含所有源数据',
          modeId: dataManager.rootAdminId || 'root_admin',
          isModeData: true,
          timestamp: new Date().getTime()
        },
        ...modes.map(item => ({
          id: item.id,
          dataType: 'other-mode',
          typeText: '其他模式',
          summary: item.description || '用户创建的子模式',
          modeId: item.id,
          isModeData: true,
          timestamp: new Date().getTime() - (modes.indexOf(item) * 1000)
        }))
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
    async initialize() { return InitPart.initialize(this) },

    // root_admin 管理
    initRootMode() { return RootPart.initRootMode(this) },
    saveDataStandards(standards) { return RootPart.saveDataStandards(this, standards) },
    recordRootTempOperation(actionType, data) { return RootPart.recordRootTempOperation(this, actionType, data) },
    clearRootTempData() { return RootPart.clearRootTempData(this) },
    updateRootConfigStep(step, validationStatus = {}) { return RootPart.updateRootConfigStep(this, step, validationStatus) },

    // ID 相关对外方法：引用 IdSvc（不实现逻辑）
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

    // 环境配置（标准字段）
    async loadEnvironmentConfigs() { return EnvPart.loadEnvironmentConfigs(this.longTermStorage) },
    normalizeCards(cards) { return EnvPart.normalizeCards(this, cards) },
    normalizeOptions(options) { return EnvPart.normalizeOptions(this, options) },
    saveEnvironmentConfigs(configs) { return EnvPart.saveEnvironmentConfigs(this.longTermStorage, configs) },
    getAllOptionsByCardId(cardId) { return EnvPart.getAllOptionsByCardId(this, cardId) },
    saveQuestionContext(questionId, contextData) { return EnvPart.saveQuestionContext(this, questionId, contextData) },
    getQuestionContext(questionId) { return EnvPart.getQuestionContext(this, questionId) },
    notifyEnvConfigChanged() {
      return typeof EnvPart.notifyEnvConfigChanged === 'function'
        ? EnvPart.notifyEnvConfigChanged(this)
        : true
    },

    // 全量环境（版本化）- 通过 manager
    async listEnvFullSnapshots() {
      const snaps = await this.dataManager?.loadEnvFullSnapshots?.() || [];
      return (Array.isArray(snaps) ? snaps : []).map(s => ({
        version: s.version,
        timestamp: s.timestamp,
        hash: s.hash
      }));
    },
    
    // 按方案修改的核心方法
    async saveEnvFullSnapshot(versionLabel) {
      const version = String(versionLabel || '').trim();
      if (!version) {
        this.error = '版本号不能为空'; // 直接设置 store.error
        return false;
      }

      const snaps = await this.dataManager?.loadEnvFullSnapshots?.() || [];
      const arr = Array.isArray(snaps) ? snaps : [];

      // 检查版本号是否已存在
      if (arr.some(s => s.version === version)) {
        this.error = `版本号已存在：${version}`;
        return false;
      }

      // 硬校验：台面上必须至少有“1 张卡 + 至少 1 条选项（结构）”
      if (!hasAtLeastOneCardAndOptionInSession(this)) {
        this.error = '无效信息：至少需要一张卡片和一条选项，才能保存全量配置';
        return false;
      }

      // 从 sessionCards 构建要保存的 environment
      const environmentToSave = EnvPart.buildEnvironmentFromSession(this);
      const fullConfigsToSave = EnvPart.buildFullConfigs(environmentToSave);
      const hash = EnvPart.hashString(EnvPart.stableStringify(fullConfigsToSave));

      const newSnapshot = {
        version,
        timestamp: Date.now(),
        hash,
        environment: environmentToSave,
        fullConfigs: fullConfigsToSave
      };

      arr.push(newSnapshot);
      await this.dataManager?.saveEnvFullSnapshots?.(arr);
      this.error = null;
      return true;
    },

    async applyEnvFullSnapshot(versionLabel) {
      return EnvPart.applyEnvFullSnapshot(this, versionLabel);
    },

    // 题库（通过 manager）
    async loadQuestionBank() {
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

    // 子模式基础功能（保留但简化）
    async loadSubModeInstances() { 
      // 简化实现，只加载实例列表
      const instances = await LongTerm.getFromLongTerm(this.longTermStorage, 'root_admin', 'subModes', 'instances')
      this.subModes.instances = Array.isArray(instances) ? instances : []
      return this.subModes.instances
    },

    // 预设
    loadPresetMappings() { return PresetsPart.loadPresetMappings(this) },
    savePresetMappings() { return PresetsPart.savePresetMappings(this) },
    savePresetForSelectOption(cardId, selectOptionId, checkedOptions) { return PresetsPart.savePresetForSelectOption(this, cardId, selectOptionId, checkedOptions) },
    applyPresetToCard(cardId, selectOptionId) { return PresetsPart.applyPresetToCard(this, cardId, selectOptionId) },

    // 会话卡片 / 临时卡片 / 选项 / 下拉 / 中期存储 / 导入导出
    loadSessionCards(modeId) { return CardsPart.loadSessionCards(this, modeId) },
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
    saveSessionCards(modeId) { return CardsPart.saveSessionCards(this, modeId) },
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
      return IO.exportData(this.longTermStorage, { modeId: this.currentModeId, fileName })
    },
    async importData(file) {
      return IO.importFromFile(file).then(data =>
        IO.importToLongTerm(this.longTermStorage, data, { modeId: this.currentModeId })
      )
    },

    // 模式（添加/删除/获取/保存）
    addMode(modeData) { return ModesPart.addMode(this, modeData) },
    deleteModes(modeIds) { return ModesPart.deleteModes(this, modeIds) },
    getMode(modeId) { return ModesPart.getMode(this.longTermStorage, modeId, dataManager.rootAdminId) },
    saveModesToStorage() { return ModesPart.saveModesToStorage(this) },

    // 数据段管理（DataSection）
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

    // 模式切换：与 manager/instance 同步当前模式ID（非 ID 逻辑）
    setCurrentMode(modeId) {
      this.currentModeId = modeId
      this.dataManager.setCurrentMode(modeId)
      this.instance.state.currentMode = modeId
    },

    // 模式内本地编辑
    updateModeCardLocalValue(modeId, cardId, fieldType, optIndex, value) {
      return ModeLocalEditPart.updateModeCardLocalValue(this, modeId, cardId, fieldType, optIndex, value)
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
      return LongTerm.saveToLongTerm(this.longTermStorage, modeId, namespace, dataId, data, this.validator)
    },
    getFromLongTerm(modeId, namespace, dataId) {
      return LongTerm.getFromLongTerm(this.longTermStorage, modeId, namespace, dataId)
    },
    deleteFromLongTerm(modeId, namespace, dataId) {
      return LongTerm.deleteFromLongTerm(this.longTermStorage, modeId, namespace, dataId)
    },
    clearLongTermByMode(modeId) {
      return LongTerm.clearLongTermByMode(this.longTermStorage, modeId, dataManager.rootAdminId)
    }
  }
})
    