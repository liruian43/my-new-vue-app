import { defineStore } from 'pinia';
import DataManager, { LocalStorageStrategy } from './manager';
import { v4 as uuidv4 } from 'uuid';

// 存储策略初始化
const longTermStorage = new LocalStorageStrategy();
const dataManager = new DataManager(longTermStorage);

// 会话级存储增强
const sessionStorageEnhancer = {
  get sessionId() {
    let sessionId = sessionStorage.getItem('app_session_id');
    if (!sessionId) {
      sessionId = `session_${uuidv4()}`;
      sessionStorage.setItem('app_session_id', sessionId);
    }
    return sessionId;
  },
  getStorageKey(modeId, type) {
    return `${this.sessionId}_${modeId}_${type}`;
  },
  save(modeId, type, data) {
    const key = this.getStorageKey(modeId, type);
    sessionStorage.setItem(key, JSON.stringify(data));
  },
  load(modeId, type) {
    const key = this.getStorageKey(modeId, type);
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },
  clear(modeId, type) {
    const key = this.getStorageKey(modeId, type);
    sessionStorage.removeItem(key);
  }
};

// 字段标识
export const FIELD_IDS = {
  CARD_COUNT: 'cardCount',
  CARD_ORDER: 'cardOrder',
  CARD_TITLE: 'title',
  OPTIONS: 'options',
  OPTION_NAME: 'optionName',
  OPTION_VALUE: 'optionValue',
  OPTION_UNIT: 'optionUnit',
  SELECT_OPTIONS: 'selectOptions',
  SCORE_RULES: 'scoreRules',
  UI_CONFIG: 'uiConfig',
  CHECKBOX: 'checkbox'
};

export const FIXED_SYNC_FIELDS = [
  FIELD_IDS.OPTIONS,
  FIELD_IDS.SELECT_OPTIONS,
  FIELD_IDS.CARD_COUNT,
  FIELD_IDS.CARD_ORDER
];

export const CONFIGURABLE_SYNC_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT,
  FIELD_IDS.UI_CONFIG
];

export const AUTHORIZABLE_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT,
  FIELD_IDS.CHECKBOX
];

export const useCardStore = defineStore('card', {
  state: () => ({
    // 1) root_admin模式区 — 标准源头
    rootMode: {
      id: 'root_admin',
      name: '根模式（源数据区）',
      level: 1,
      permissions: {
        card: { addCard: true, deleteCard: true, editTitle: true, editOptions: true },
        data: { view: true, save: true, export: true, import: true },
        mode: { create: true, delete: true, assignPermissions: true, sync: true },
        authorize: { canAuthorize: true }
      },
      tempOperations: {
        currentEditingQuestion: null,
        configStep: 0,
        validationStatus: {},
        unsavedHistory: []
      },
      dataStandards: {
        cardIdPattern: /^[A-Z]+$/, // A, B, AA...
        optionIdPattern: /^\d+$/, // 1,2,3...
        fullOptionIdPattern: /^[A-Z]+\d+$/, // A1, B2...
        requiredOptionFields: ['name', 'value', 'unit'],
        questionExpressionPattern: /^([A-Z]+\d+)([+-/][A-Z]+\d+)→$/ // 支持多运算符
      },
      cardData: []
    },

    // 2) 环境配置区 — 标准容器（仅标准字段）
    environmentConfigs: {
      cards: {},   // { "A": { id:"A", name:"材料", dropdown:["玄铁","青铜"] } }
      options: {}, // { "A1": { name:"玄铁", value:"5", unit:"kg" } }
      uiPresets: [],
      scoringRules: [],
      contextTemplates: []
    },

    // 3) 题库区
    questionBank: {
      questions: [],
      categories: [],
      lastUpdated: null
    },

    // 4) 联动区
    linkageSync: {
      syncHistory: [],
      fieldAuthorizations: {}, // key: `${sourceModeId}_${targetModeId}_${field}`
      pendingSyncs: []
    },

    // 5) 其他模式
    subModes: {
      instances: [],
      activeInstanceId: null,
      isolationPolicies: {},
      parsedData: {}
    },

    // 6) 匹配反馈区
    matchingFeedback: {
      submissionHistory: [],
      feedbackResults: [],
      scoringLogs: []
    },

    // 通用状态（服务 UniversalCard）
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
    currentModeId: 'root_admin',

    sessionStorageEnhancer,
    FIELD_IDS,
    FIXED_SYNC_FIELDS,
    CONFIGURABLE_SYNC_FIELDS,
    AUTHORIZABLE_FIELDS
  }),

  getters: {
    // root_admin
    isRootMode() { return this.currentModeId === 'root_admin'; },
    rootMediumData() { return this.mediumCards.filter(card => card.modeId === 'root_admin'); },
    rootUnsavedChanges() { return this.rootMode.tempOperations.unsavedHistory.length > 0; },
    isValidCardId: (s) => (id) => s.rootMode.dataStandards.cardIdPattern.test(id),
    isValidOptionId: (s) => (id) => s.rootMode.dataStandards.optionIdPattern.test(id),
    isValidFullOptionId: (s) => (id) => s.rootMode.dataStandards.fullOptionIdPattern.test(id),

    // 环境配置区接口（4.1）
    getCardById: (s) => (cardId) => s.environmentConfigs.cards[cardId] || null,
    getOptionByFullId: (s) => (fullId) => s.environmentConfigs.options[fullId] || null,
    getOptionsByCardId: (s) => (cardId) => {
      return Object.entries(s.environmentConfigs.options)
        .filter(([fid]) => fid.startsWith(cardId))
        .map(([fullId, option]) => ({
          id: fullId.replace(cardId, ''),
          fullId,
          ...option
        }));
    },

    // 题库区
    allQuestionCategories() { return [...this.questionBank.categories]; },
    getQuestionById: (s) => (id) => this.questionBank.questions.find(q => q.id === id),
    isQuestionExpressionValid: (s) => (expression) =>
      s.rootMode.dataStandards.questionExpressionPattern.test(expression),

    // 联动授权读取（与 set 相同 key 规则）
    getFieldAuthorization: (s) => (sourceModeId, targetModeId, field) => {
      const key = `${sourceModeId}_${targetModeId}_${field}`;
      return !!s.linkageSync.fieldAuthorizations[key];
    },

    // 其他模式
    activeSubMode() { return this.subModes.instances.find(i => i.id === this.subModes.activeInstanceId); },
    getParsedSubModeData: (s) => (instanceId) => s.subModes.parsedData[instanceId] || { cards: [], options: [] },

    // 匹配反馈
    getFeedbackBySubmission: (s) => (submissionId) =>
      s.matchingFeedback.feedbackResults.find(f => f.submissionId === submissionId),

    // 原有
    selectedCard() {
      let card = this.tempCards.find(c => c.id === this.selectedCardId);
      if (!card) card = this.sessionCards.find(c => c.id === this.selectedCardId);
      return card;
    },
    selectedCardPresets() { return this.presetMappings[this.selectedCardId] || {}; },
    currentMode() { return this.currentModeId === 'root_admin' ? this.rootMode : (this.modes.find(m => m.id === this.currentModeId) || null); },
    currentModeSessionCards() { return [...this.sessionCards]; },
    currentModeMediumCards() { return this.mediumCards.filter(c => c.modeId === this.currentModeId); },
    selectedCardEditableFields() {
      return this.selectedCard?.editableFields || {
        optionName: true, optionValue: true, optionUnit: true,
        optionCheckbox: true, optionActions: true, select: true
      };
    },
    getCardSyncStatus() {
      return (cardId) => {
        const mode = this.currentMode; if (!mode || !mode.syncStatus) return null;
        return mode.syncStatus[cardId] || { hasSync: false, isAuthorized: false };
      };
    },
    sortedSessionCards() { return [...this.sessionCards].sort((a, b) => this.compareCardIds(a.id, b.id)); },
    sortedTempCards() { return [...this.tempCards].sort((a, b) => this.compareCardIds(a.id, b.id)); },
    sortedOptions(card) { return [...card.data.options].sort((a, b) => parseInt(a.id) - parseInt(b.id)); }
  },

  actions: {
    // 初始化
    async initialize() {
      this.loading = true; this.error = null;
      try {
        const storedModes = localStorage.getItem('app_user_modes');
        this.modes = storedModes ? JSON.parse(storedModes) : [];
        this.initRootMode();
        await this.loadQuestionBank();
        await this.loadEnvironmentConfigs();
        await this.loadSubModeInstances();

        if (this.currentModeId) this.loadSessionCards(this.currentModeId);
        else { this.currentModeId = 'root_admin'; this.loadSessionCards('root_admin'); }

        this.loadAllMediumCards();
        this.loadPresetMappings();
        this.tempCards = [];

        window.addEventListener('storage', (e) => {
          if (e.key?.startsWith(this.sessionStorageEnhancer.sessionId) && e.key.includes(this.currentModeId)) {
            this.loadSessionCards(this.currentModeId);
          }
        });
      } catch (error) {
        console.error('初始化失败:', error);
        this.error = '数据加载失败，请刷新页面重试';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 1) root_admin
    initRootMode() {
      const storedRootConfig = localStorage.getItem('root_mode_config');
      if (storedRootConfig) {
        try {
          const config = JSON.parse(storedRootConfig);
          this.rootMode.cardData = config.cardData || [];
          if (config.dataStandards) {
            this.rootMode.dataStandards = { ...this.rootMode.dataStandards, ...config.dataStandards };
          }
        } catch (e) { console.error('加载主模式配置失败:', e); }
      }
    },
    saveDataStandards(standards) {
      this.rootMode.dataStandards = { ...this.rootMode.dataStandards, ...standards };
      localStorage.setItem('root_mode_config', JSON.stringify({
        cardData: this.rootMode.cardData, dataStandards: this.rootMode.dataStandards
      }));
      return this.rootMode.dataStandards;
    },
    recordRootTempOperation(actionType, data) {
      this.rootMode.tempOperations.unsavedHistory.push({
        id: Date.now(), actionType, data, timestamp: new Date().toISOString()
      });
      if (this.rootMode.tempOperations.unsavedHistory.length > 100) {
        this.rootMode.tempOperations.unsavedHistory.shift();
      }
    },
    clearRootTempData() {
      this.rootMode.tempOperations = {
        currentEditingQuestion: null, configStep: 0, validationStatus: {}, unsavedHistory: []
      };
    },
    updateRootConfigStep(step, validationStatus = {}) {
      this.rootMode.tempOperations.configStep = step;
      this.rootMode.tempOperations.validationStatus = validationStatus;
    },

    // Excel 风格卡片ID生成
    compareCardIds(id1, id2) {
      if (id1.length !== id2.length) return id1.length - id2.length;
      return id1.localeCompare(id2);
    },
    getAllUsedCardIds() {
      const set = new Set();
      Object.keys(this.environmentConfigs.cards || {}).forEach(id => set.add(id));
      (this.sessionCards || []).forEach(c => c?.id && set.add(c.id));
      (this.tempCards || []).forEach(c => c?.id && set.add(c.id));
      return set;
    },
    nextExcelId(id) {
      if (!id) return 'A';
      const nums = id.split('').map(c => c.charCodeAt(0) - 65);
      let i = nums.length - 1;
      
      while (i >= 0 && nums[i] === 25) {
        nums[i] = 0;
        i--;
      }
      
      if (i < 0) {
        nums.unshift(0);
      } else {
        nums[i] += 1;
      }
      
      return nums.map(n => String.fromCharCode(n + 65)).join('');
    },
    generateNextCardId() {
      const used = this.getAllUsedCardIds();
      // 若一个都没有，从 A 开始
      let currentMax = 'A';
      // 先找出集合内的“最大”ExcelID（按长度+字典序）
      for (const id of used) {
      if (!this.isValidCardId(id)) continue;
      const better =
      (id.length > currentMax.length) ||
      (id.length === currentMax.length && id.localeCompare(currentMax) > 0);
      if (better) currentMax = id;
      }
      // 从最大值开始 +1，直到找出未占用的
      let candidate = used.size === 0 ? 'A' : this.nextExcelId(currentMax);
      while (used.has(candidate)) candidate = this.nextExcelId(candidate);
      return candidate;
    },
    generateNextOptionId(cardId) {
      if (!this.isValidCardId(cardId)) { console.error(`卡片ID ${cardId} 不符合标准格式`); return '1'; }
      const keys = Object.keys(this.environmentConfigs.options || {}).filter(k => k.startsWith(cardId));
      if (keys.length === 0) return '1';
      const max = Math.max(...keys.map(k => parseInt(k.replace(cardId, ''), 10)).filter(n => !Number.isNaN(n)));
      const id = String((max || 0) + 1);
      if (!this.isValidOptionId(id)) { console.error(`生成的选项ID ${id} 不符合标准格式`); return '1'; }
      return id;
    },
    // 对外标准接口：root_admin 垄断
    generateCardId() { return this.generateNextCardId(); },
    generateOptionId(cardId) { return this.generateNextOptionId(cardId); },

    // 2) 环境配置区
    async loadEnvironmentConfigs() {
      const configs = await dataManager.loadEnvironmentConfigs();
      this.environmentConfigs = {
        cards: this.normalizeCards(configs.cards || {}),
        options: this.normalizeOptions(configs.options || {}),
        uiPresets: configs.uiPresets || [],
        scoringRules: configs.scoringRules || [],
        contextTemplates: configs.contextTemplates || []
      };
    },
    normalizeCards(cards) {
      const out = {};
      Object.entries(cards).forEach(([id, card]) => {
        if (!this.rootMode.dataStandards.cardIdPattern.test(id)) { console.warn(`卡片ID ${id} 不符合标准，跳过`); return; }
        out[id] = { id, name: card?.name ?? null, dropdown: Array.isArray(card?.dropdown) ? card.dropdown.map(x => (x ?? null)) : [] };
      });
      return out;
    },
    normalizeOptions(options) {
      const out = {};
      Object.entries(options).forEach(([fullId, option]) => {
        if (!this.rootMode.dataStandards.fullOptionIdPattern.test(fullId)) { console.warn(`选项ID ${fullId} 不符合标准，跳过`); return; }
        out[fullId] = { name: option?.name ?? null, value: option?.value ?? null, unit: option?.unit ?? null };
      });
      return out;
    },
    saveEnvironmentConfigs(configs) {
      const normalizedConfigs = {
        ...configs,
        cards: this.normalizeCards(configs.cards || this.environmentConfigs.cards),
        options: this.normalizeOptions(configs.options || this.environmentConfigs.options)
      };
      this.environmentConfigs = normalizedConfigs;
      this.notifyEnvConfigChanged();
      return dataManager.saveEnvironmentConfigs(normalizedConfigs);
    },
    getAllOptionsByCardId(cardId) {
      return Object.entries(this.environmentConfigs.options)
        .filter(([fullId]) => fullId.startsWith(cardId))
        .map(([fullId, opt]) => ({ fullId, name: opt.name, value: opt.value, unit: opt.unit }));
    },
    saveQuestionContext(questionId, contextData) {
      const context = {
        questionId,
        uiConfig: contextData.uiConfig || {},
        scoringRules: contextData.scoringRules || [],
        options: contextData.options || [],
        createdAt: new Date().toISOString()
      };
      const idx = this.environmentConfigs.contextTemplates.findIndex(t => t.questionId === questionId);
      if (idx >= 0) this.environmentConfigs.contextTemplates[idx] = context;
      else this.environmentConfigs.contextTemplates.push(context);
      dataManager.saveEnvironmentConfigs(this.environmentConfigs);
      return context;
    },
    getQuestionContext(questionId) {
      return this.environmentConfigs.contextTemplates.find(t => t.questionId === questionId) || null;
    },

    // 3) 题库区
    async loadQuestionBank() {
      const bankData = await dataManager.loadQuestionBank();
      const valid = bankData.questions?.filter(q => {
        if (!this.isQuestionExpressionValid(q.expression)) { console.warn(`题目 ${q.id} 表达式无效，跳过`); return false; }
        const ids = q.expression.match(/[A-Z]+\d+/g) || [];
        if (!ids.every(fid => !!this.getOptionByFullId(fid))) { console.warn(`题目 ${q.id} 引用不存在ID，跳过`); return false; }
        return true;
      }) || [];
      this.questionBank = {
        questions: valid, categories: bankData.categories || [], lastUpdated: bankData.lastUpdated || new Date().toISOString()
      };
    },
    addQuestionToBank(questionData) {
      const expr = questionData.expression;
      if (!this.isQuestionExpressionValid(expr)) {
        this.error = `题目表达式格式无效，必须符合 ${this.rootMode.dataStandards.questionExpressionPattern.toString()}`;
        return false;
      }
      const ids = expr.match(/[A-Z]+\d+/g) || [];
      if (ids.length === 0) { this.error = '无法解析题目表达式中的ID'; return false; }
      for (const fid of ids) {
        if (!this.getOptionByFullId(fid)) { this.error = `表达式中引用的选项 ${fid} 不存在`; return false; }
      }
      const normalizedQuestion = dataManager.normalizeQuestion(questionData);
      const validation = dataManager.validator.validateQuestion(normalizedQuestion);
      if (!validation.pass) { this.error = `题目验证失败: ${validation.errors.join(', ')}`; return false; }
      const idx = this.questionBank.questions.findIndex(q => q.id === normalizedQuestion.id);
      if (idx >= 0) this.questionBank.questions[idx] = normalizedQuestion;
      else this.questionBank.questions.push(normalizedQuestion);
      this.questionBank.lastUpdated = new Date().toISOString();
      dataManager.saveQuestionBank(this.questionBank);
      return true;
    },
    removeQuestionFromBank(questionId) {
      this.questionBank.questions = this.questionBank.questions.filter(q => q.id !== questionId);
      this.questionBank.lastUpdated = new Date().toISOString();
      dataManager.saveQuestionBank(this.questionBank);
      return true;
    },

    // 4) 联动区
    setFieldAuthorization(sourceModeId, targetModeId, field, authorized) {
      if (!AUTHORIZABLE_FIELDS.includes(field)) {
        console.warn(`字段 ${field} 不在标准可授权列表中，但已记录以兼容UI`);
      }
      const key = `${sourceModeId}_${targetModeId}_${field}`;
      this.linkageSync.fieldAuthorizations[key] = !!authorized;
      dataManager.saveFieldAuthorizations(this.linkageSync.fieldAuthorizations);
      return true;
    },
    recordSyncHistory(syncData) {
      const entry = {
        id: `sync_${uuidv4()}`,
        sourceModeId: syncData.sourceModeId,
        targetModeId: syncData.targetModeId,
        cardIds: syncData.cardIds,
        fields: syncData.fields,
        timestamp: new Date().toISOString(),
        status: syncData.status || 'completed'
      };
      // 修复：写入正确的数组属性
      this.linkageSync.syncHistory.unshift(entry);
      if (this.linkageSync.syncHistory.length > 50) {
        this.linkageSync.syncHistory.pop();
      }
      dataManager.saveSyncHistory(this.linkageSync.syncHistory);
      return entry;
    },
    async syncData(cardIdList, targetModeId, { sync = [], auth = [] } = {}) {
      return this.syncToMode(targetModeId, cardIdList, {
        syncFields: sync,
        authFields: auth
      });
    },

    // 5) 其他模式
    async loadSubModeInstances() {
      const instances = await dataManager.loadSubModeInstances();
      this.subModes.instances = instances || [];
      this.subModes.instances.forEach(inst => this.parseSubModeData(inst.id));
    },
    parseSubModeData(instanceId) {
      const instance = this.subModes.instances.find(inst => inst.id === instanceId);
      if (!instance) return null;

      const parsedCards = Object.values(this.environmentConfigs.cards).map(card => ({
        ...card,
        displayName: card.name || `卡片 ${card.id}`,
        isEditable: this.getFieldAuthorization('root_admin', instanceId, FIELD_IDS.CARD_TITLE)
      }));

      const parsedOptions = Object.entries(this.environmentConfigs.options).map(([fullId, option]) => {
        const cardId = fullId.replace(/\d+$/, '');
        const optionId = fullId.replace(cardId, '');
        return {
          fullId,
          cardId,
          optionId,
          ...option,
          displayValue: option.value !== null ? `${option.value}${option.unit || ''}` : '',
          isNameEditable: this.getFieldAuthorization('root_admin', instanceId, FIELD_IDS.OPTION_NAME),
          isValueEditable: this.getFieldAuthorization('root_admin', instanceId, FIELD_IDS.OPTION_VALUE),
          isUnitEditable: this.getFieldAuthorization('root_admin', instanceId, FIELD_IDS.OPTION_UNIT)
        };
      });

      this.subModes.parsedData[instanceId] = {
        cards: parsedCards,
        options: parsedOptions,
        parsedAt: new Date().toISOString()
      };
      return this.subModes.parsedData[instanceId];
    },

    // 6) 匹配反馈区
    submitForMatching(instanceId, results) {
      const invalidIds = results.filter(it => !this.isValidFullOptionId(it.optionId)).map(it => it.optionId);
      if (invalidIds.length > 0) {
        this.error = `以下选项ID不符合标准格式：${invalidIds.join(', ')}`;
        return null;
      }
      const submission = {
        id: `sub_${uuidv4()}`,
        instanceId,
        results,
        submittedAt: new Date().toISOString(),
        status: 'pending'
      };
      this.matchingFeedback.submissionHistory.push(submission);
      const feedback = dataManager.matchResultsWithQuestionBank(results, this.questionBank.questions);
      this.matchingFeedback.feedbackResults.push({
        ...feedback,
        submissionId: submission.id,
        generatedAt: new Date().toISOString()
      });
      submission.status = 'completed';
      dataManager.saveFeedbackData({
        submissions: this.matchingFeedback.submissionHistory,
        feedbacks: this.matchingFeedback.feedbackResults
      });
      return feedback;
    },

    // 通用/兼容方法
    notifyEnvConfigChanged() {
      (this.subModes.instances || []).forEach(inst => this.parseSubModeData(inst.id));
    },

    loadPresetMappings() {
      const stored = localStorage.getItem('card_preset_mappings');
      if (stored) {
        try { this.presetMappings = JSON.parse(stored); }
        catch (e) { console.error('加载预设映射失败:', e); this.presetMappings = {}; }
      }
    },
    savePresetMappings() {
      try {
        localStorage.setItem('card_preset_mappings', JSON.stringify(this.presetMappings));
        return true;
      } catch (e) {
        console.error('保存预设映射失败:', e);
        return false;
      }
    },
    savePresetForSelectOption(cardId, selectOptionId, checkedOptions) {
      if (!this.presetMappings[cardId]) this.presetMappings[cardId] = {};
      const optionsData = checkedOptions.map(option => ({
        id: option.id,
        name: option.name ?? null,
        value: option.value ?? null,
        unit: option.unit ?? null,
        checked: true
      }));
      this.presetMappings[cardId][selectOptionId] = {
        // 修复变量名错误
        checkedOptionIds: checkedOptions.map(option => option.id),
        optionsData
      };
      return this.savePresetMappings();
    },
    applyPresetToCard(cardId, selectOptionId) {
      const cardPresets = this.presetMappings[cardId];
      if (!cardPresets || !cardPresets[selectOptionId]) return false;
      const preset = cardPresets[selectOptionId];
      const card = this.sessionCards.find(c => c.id === cardId) || this.tempCards.find(c => c.id === cardId);
      if (!card) return false;
      card.data.options = card.data.options.map(o => ({ ...o, checked: false }));
      preset.optionsData.forEach(presetOption => {
        const target = card.data.options.find(o => o.id === presetOption.id);
        if (target) {
          target.checked = true;
          if (presetOption.name !== undefined) target.name = presetOption.name;
          if (presetOption.value !== undefined) target.value = presetOption.value;
          if (presetOption.unit !== undefined) target.unit = presetOption.unit;
        }
      });
      return true;
    },

    loadSessionCards(modeId) {
      const rawCards = this.sessionStorageEnhancer.load(modeId, 'cards') || [];
      this.sessionCards = rawCards.map(card => this.normalizeCardStructure(card));
    },

    // 仅最小补齐，不篡改受控数据结构
    normalizeCardStructure(card) {
      const normalizeOptions = (options) => {
        const list = Array.isArray(options) ? options : [];
        // 若 id 不为纯数字，则按顺序映射为 "1","2",...（避免 UI 用到 Date.now）
        return list.map((opt, idx) => {
          const idStr = (opt && typeof opt.id !== 'undefined') ? String(opt.id) : String(idx + 1);
          const numeric = /^\d+$/.test(idStr) ? idStr : String(idx + 1);
          return {
            ...opt,
            id: numeric
          };
        });
      };
      const normalizeSelectOptions = (options) => {
        const list = Array.isArray(options) ? options : [];
        return list.map((opt, idx) => {
          const idStr = (opt && typeof opt.id !== 'undefined') ? String(opt.id) : String(idx + 1);
          const numeric = /^\d+$/.test(idStr) ? idStr : String(idx + 1);
          return {
            ...opt,
            id: numeric,
            label: opt?.label ?? null
          };
        });
      };

      // 卡片ID：若缺失或不合规，由 root_admin 生成
      let cardId = card.id;
      if (!cardId || !this.rootMode.dataStandards.cardIdPattern.test(cardId)) {
        cardId = this.generateCardId();
      }

      return {
        id: cardId,
        modeId: card.modeId || this.currentModeId,
        storageLevel: card.storageLevel || 'session',
        isTitleEditing: card.isTitleEditing ?? false,
        isOptionsEditing: card.isOptionsEditing ?? false,
        isSelectEditing: card.isSelectEditing ?? false,
        isPresetEditing: card.isPresetEditing ?? false,
        showDropdown: card.showDropdown ?? false,
        syncStatus: {
          title: {
            hasSync: card.syncStatus?.title?.hasSync ?? false,
            isAuthorized: card.syncStatus?.title?.isAuthorized ?? false
          },
          options: {
            name: {
              hasSync: card.syncStatus?.options?.name?.hasSync ?? false,
              isAuthorized: card.syncStatus?.options?.name?.isAuthorized ?? false
            },
            value: {
              hasSync: card.syncStatus?.options?.value?.hasSync ?? false,
              isAuthorized: card.syncStatus?.options?.value?.isAuthorized ?? false
            },
            unit: {
              hasSync: card.syncStatus?.options?.unit?.hasSync ?? false,
              isAuthorized: card.syncStatus?.options?.unit?.isAuthorized ?? false
            }
          },
          selectOptions: {
            hasSync: card.syncStatus?.selectOptions?.hasSync ?? true,
            isAuthorized: card.syncStatus?.selectOptions?.isAuthorized ?? false
          }
        },
        data: {
          title: card.data?.title ?? null,
          options: normalizeOptions(card.data?.options),
          selectOptions: normalizeSelectOptions(card.data?.selectOptions),
          selectedValue: card.data?.selectedValue ?? null,
          uiConfig: card.data?.uiConfig || {},
          scoreRules: card.data?.scoreRules || []
        },
        editableFields: {
          ...{
            optionName: true,
            optionValue: true,
            optionUnit: true,
            optionCheckbox: true,
            optionActions: true,
            select: true
          },
          ...card.editableFields
        }
      };
    },

    // 按 UniversalCard 受控模型添加卡片：保留传入的 options/selectOptions
    addCard(cardData) {
      // 本地辅助：收集当前已占用的卡片ID（环境配置 + 会话 + 临时）
      const usedIds = new Set([
        ...Object.keys(this.environmentConfigs.cards || {}),
        ...((this.sessionCards || []).map(c => c?.id).filter(Boolean)),
        ...((this.tempCards || []).map(c => c?.id).filter(Boolean))
      ]);

      // 本地辅助：Excel ID 自增（A..Z->AA..）
      const nextExcelIdLocal = (id) => {
        if (!id) return 'A';
        const nums = id.split('').map(c => c.charCodeAt(0) - 65);
        let i = nums.length - 1;
        
        while (i >= 0 && nums[i] === 25) {
          nums[i] = 0;
          i--;
        }
        
        if (i < 0) {
          nums.unshift(0);
        } else {
          nums[i] += 1;
        }
        
        return nums.map(n => String.fromCharCode(n + 65)).join('');
      };

      // 1) 确定新卡 ID：优先使用外部提供且合法且未占用，否则按 Excel 递增直到未占用
      let newCardId = null;
      const requestedId = cardData?.id;
      
      if (requestedId && this.isValidCardId(requestedId) && !usedIds.has(requestedId)) {
        newCardId = requestedId;
      } else {
        // 先用生成器给一个起点（通常是 A 或最大+1），然后确保避开已用集合
        let candidate = this.generateCardId ? this.generateCardId() : 'A';
        
        while (usedIds.has(candidate)) {
          candidate = nextExcelIdLocal(candidate);
        }
        
        newCardId = candidate;
      }

      // 2) 规范化会话结构（保留你传入的 options/selectOptions，不清空）
      const normalized = this.normalizeCardStructure({
        ...cardData,
        storageLevel: 'session',
        id: newCardId
      });

      // 3) 放入会话列表
      this.sessionCards.push(normalized);

      // 4) 环境配置：仅标准字段
      this.environmentConfigs.cards[newCardId] = {
        id: newCardId,
        name: normalized.data.title ?? null,
        dropdown: (normalized.data.selectOptions || []).map(opt => opt?.label ?? null)
      };

      // 将已有选项写入环境配置（id 已被 normalize 为数字字符串）
      (normalized.data.options || []).forEach(opt => {
        const fullId = `${newCardId}${opt.id}`;
        if (this.isValidFullOptionId(fullId)) {
          this.environmentConfigs.options[fullId] = {
            name: opt.name ?? null,
            value: opt.value ?? null,
            unit: opt.unit ?? null
          };
        }
      });

      // 5) 选中
      this.selectedCardId = newCardId;

      if (this.isRootMode) {
        this.recordRootTempOperation('add_card', { cardId: newCardId });
      }

      // 6) 通知模式解析
      this.notifyEnvConfigChanged();
      return normalized;
    },

    deleteCard(cardId) {
      this.tempCards = this.tempCards.filter(c => c.id !== cardId);
      this.sessionCards = this.sessionCards.filter(c => c.id !== cardId);
      this.saveSessionCards(this.currentModeId);
      this.removeFromMedium([cardId]);

      if (this.environmentConfigs.cards[cardId]) {
        delete this.environmentConfigs.cards[cardId];
        Object.keys(this.environmentConfigs.options).forEach(fullId => {
          if (fullId.startsWith(cardId)) delete this.environmentConfigs.options[fullId];
        });
      }
      if (this.presetMappings[cardId]) {
        delete this.presetMappings[cardId];
        this.savePresetMappings();
      }
      if (this.selectedCardId === cardId) this.selectedCardId = null;

      if (this.isRootMode) {
        this.recordRootTempOperation('delete_card', { cardId });
      }
      this.notifyEnvConfigChanged();
    },

    updateSessionCard(updatedCard) {
      const idx = this.sessionCards.findIndex(c => c.id === updatedCard.id);
      if (idx !== -1) {
        this.sessionCards[idx] = this.normalizeCardStructure({
          ...this.sessionCards[idx],
          ...updatedCard
        });
        // 环境配置：仅标准字段
        const cid = updatedCard.id;
        if (this.environmentConfigs.cards[cid]) {
          this.environmentConfigs.cards[cid] = {
            ...this.environmentConfigs.cards[cid],
            name: this.sessionCards[idx].data?.title ?? null,
            dropdown: (this.sessionCards[idx].data?.selectOptions || []).map(opt => opt?.label ?? null)
          };
          this.notifyEnvConfigChanged();
        }
        if (this.isRootMode) {
          this.recordRootTempOperation('update_card', { cardId: cid });
        }
        return this.sessionCards[idx];
      }
      return null;
    },

    updateCardTitle(cardId, newTitle) {
      const tIdx = this.tempCards.findIndex(c => c.id === cardId);
      if (tIdx !== -1) {
        this.tempCards[tIdx].data.title = newTitle;
        return this.tempCards[tIdx];
      }
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) {
        this.sessionCards[sIdx].data.title = newTitle;
        if (this.environmentConfigs.cards[cardId]) {
          this.environmentConfigs.cards[cardId].name = newTitle ?? null;
          this.notifyEnvConfigChanged();
        }
        return this.sessionCards[sIdx];
      }
      return null;
    },

    // 批量更新卡片选项的三要素（不新增/删除ID）
    updateCardOptions(cardId, updatedOptions) {
      const assignTo = (card) => {
        card.data.options = updatedOptions;
        updatedOptions.forEach(option => {
          const fullId = `${cardId}${option.id}`;
          if (!this.isValidFullOptionId(fullId)) {
            console.warn(`选项ID ${fullId} 不符合标准格式，未更新到环境配置`);
            return;
          }
          this.environmentConfigs.options[fullId] = {
            name: option.name ?? null,
            value: option.value ?? null,
            unit: option.unit ?? null
          };
        });
        this.notifyEnvConfigChanged();
        return card;
      };
      const tIdx = this.tempCards.findIndex(c => c.id === cardId);
      if (tIdx !== -1) return assignTo(this.tempCards[tIdx]);
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) return assignTo(this.sessionCards[sIdx]);
      return null;
    },

    // 新增选项：受控 + 环境配置
    addOption(cardId, afterId) {
      if (!this.isValidCardId(cardId)) {
        console.error(`卡片ID ${cardId} 不符合标准格式，无法添加选项`);
        return;
      }
      // 新增选项ID：基于环境配置的最大+1，删除不补位
      const newOptionNumericId = this.generateOptionId(cardId);
      const fullId = `${cardId}${newOptionNumericId}`;
      const newOption = {
        id: newOptionNumericId,
        name: null, value: null, unit: null,
        checked: false,
        localName: null, localValue: null, localUnit: null
      };

      const insertTo = (card) => {
        const options = [...card.data.options];
        if (afterId) {
          const index = options.findIndex(o => o.id === afterId);
          if (index !== -1) options.splice(index + 1, 0, newOption);
          else options.push(newOption);
        } else {
          options.push(newOption);
        }
        card.data.options = options;
      };

      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        insertTo(tempCard);
      } else {
        const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
        if (sIdx !== -1) {
          insertTo(this.sessionCards[sIdx]);
          // 环境配置新增选项（标准字段）
          this.environmentConfigs.options[fullId] = { name: null, value: null, unit: null };
          this.notifyEnvConfigChanged();
        }
      }
    },

    deleteOption(cardId, optionId) {
      if (!this.isValidCardId(cardId)) { console.error(`卡片ID ${cardId} 不符合标准格式`); return; }
      if (!this.isValidOptionId(optionId)) { console.error(`选项ID ${optionId} 不符合标准格式`); return; }
      const fullId = `${cardId}${optionId}`;
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        tempCard.data.options = tempCard.data.options.filter(o => o.id !== optionId);
        return;
      }
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) {
        const card = this.sessionCards[sIdx];
        card.data.options = card.data.options.filter(o => o.id !== optionId);
        if (this.environmentConfigs.options[fullId]) {
          delete this.environmentConfigs.options[fullId];
          this.notifyEnvConfigChanged();
        }
      }
    },

    addSelectOption(cardId, label) {
      const pushTo = (card) => {
        const nextId = this.generateNextSelectOptionId(cardId);
        card.data.selectOptions.push({ id: nextId, label: label ?? null });
        // 同步环境配置 dropdown
        if (this.environmentConfigs.cards[cardId]) {
          this.environmentConfigs.cards[cardId].dropdown =
            card.data.selectOptions.map(opt => opt.label ?? null);
          this.notifyEnvConfigChanged();
        }
      };
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) return pushTo(tempCard);
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) pushTo(this.sessionCards[sIdx]);
    },

    deleteSelectOption(cardId, optionId) {
      const removeFrom = (card) => {
        card.data.selectOptions = card.data.selectOptions.filter(o => o.id !== optionId);
        if (this.presetMappings[cardId] && this.presetMappings[cardId][optionId]) {
          delete this.presetMappings[cardId][optionId];
          this.savePresetMappings();
        }
        const stillExists = card.data.selectOptions.some(o => o.label === card.data.selectedValue);
        if (!stillExists) card.data.selectedValue = null;
        if (this.environmentConfigs.cards[cardId]) {
          this.environmentConfigs.cards[cardId].dropdown =
            card.data.selectOptions.map(opt => opt.label ?? null);
          this.notifyEnvConfigChanged();
        }
      };
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) return removeFrom(tempCard);
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) removeFrom(this.sessionCards[sIdx]);
    },

    setShowDropdown(cardId, value) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) { tempCard.showDropdown = value; return; }
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) this.sessionCards[sIdx].showDropdown = value;
    },

    generateNextSelectOptionId(cardId) {
      if (!this.isValidCardId(cardId)) {
        console.error(`卡片ID ${cardId} 不符合标准格式`);
        return '1';
      }
      const card = this.sessionCards.find(c => c.id === cardId) || this.tempCards.find(c => c.id === cardId);
      if (!card || !card.data.selectOptions.length) return '1';
      const maxSelectId = Math.max(...card.data.selectOptions.map(opt => parseInt(opt.id, 10)).filter(n => !Number.isNaN(n)));
      return String((maxSelectId || 0) + 1);
    },

    toggleSelectEditing(cardId) {
      const temp = this.tempCards.find(c => c.id === cardId);
      if (temp) { if (temp.isPresetEditing) return; temp.isSelectEditing = !temp.isSelectEditing; return; }
      const card = this.sessionCards.find(c => c.id === cardId);
      if (card) { if (card.isPresetEditing) return; card.isSelectEditing = !card.isSelectEditing; }
    },
    toggleTitleEditing(cardId) { return this.toggleTitleEditingForRoot(cardId); },
    toggleTitleEditingForRoot(cardId) {
      const tIdx = this.tempCards.findIndex(c => c.id === cardId);
      if (tIdx !== -1) { this.tempCards[tIdx].isTitleEditing = !this.tempCards[tIdx].isTitleEditing; return; }
      const sIdx = this.sessionCards.findIndex(c => c.id === cardId);
      if (sIdx !== -1) {
        const card = this.sessionCards[sIdx];
        if (this.currentModeId === 'root_admin' || card.syncStatus.title.isAuthorized) {
          card.isTitleEditing = !card.isTitleEditing;
        }
      }
    },
    toggleOptionsEditing(cardId) {
      const temp = this.tempCards.find(c => c.id === cardId);
      if (temp) { if (temp.isPresetEditing) return; temp.isOptionsEditing = !temp.isOptionsEditing; return; }
      const card = this.sessionCards.find(c => c.id === cardId);
      if (card) {
        if (card.isPresetEditing) return;
        let canEdit = false;
        if (this.currentModeId === 'root_admin') canEdit = true;
        else {
          canEdit =
            card.syncStatus.options.name.isAuthorized ||
            card.syncStatus.options.value.isAuthorized ||
            card.syncStatus.options.unit.isAuthorized;
        }
        if (canEdit) card.isOptionsEditing = !card.isOptionsEditing;
      }
    },
    togglePresetEditing(cardId) {
      const apply = (card) => {
        const entering = !card.isPresetEditing;

        if (entering) {
          // 进入预设：只启用两种能力（下拉编辑、复选框显示）
          card.isPresetEditing = true;
          card.isSelectEditing = true;
          card.editableFields.optionCheckbox = true;

          // 其它编辑能力全部关闭（避免混淆）
          card.isOptionsEditing = false;
          card.editableFields.optionName = false;
          card.editableFields.optionValue = false;
          card.editableFields.optionUnit = false;
          card.editableFields.optionActions = false;
        } else {
          // 退出预设：保存一次并清空勾选
          const selectedOpt = card.data.selectOptions.find(
            opt => opt.label === card.data.selectedValue
          );
          if (selectedOpt) {
            const checkedOptions = card.data.options.filter(o => o.checked);
            this.savePresetForSelectOption(card.id, selectedOpt.id, checkedOptions);
          }
          card.data.options = card.data.options.map(o => ({ ...o, checked: false }));

          // 退出预设本身
          card.isPresetEditing = false;

          // 退出时让“下拉编辑”也退出
          card.isSelectEditing = false;

          // 恢复 +/− 按钮可见，其它保持现状
          card.editableFields.optionActions = true;
        }
      };

      const temp = this.tempCards.find(c => c.id === cardId);
      if (temp) return apply(temp);

      const sess = this.sessionCards.find(c => c.id === cardId);
      if (sess) return apply(sess);
    },

    toggleEditableField(cardId, field) {
      const temp = this.tempCards.find(c => c.id === cardId);
      if (temp) {
        if (temp.isPresetEditing) return; // 预设期间禁用
        temp.editableFields[field] = !temp.editableFields[field];
        return;
      }

      const card = this.sessionCards.find(c => c.id === cardId);
      if (card) {
        if (card.isPresetEditing) return; // 预设期间禁用
        card.editableFields[field] = !card.editableFields[field];
      }
    },

    // 持久化当前会话卡片
    saveSessionCards(modeId) {
      const validation = dataManager.validateConfig(this.sessionCards);
      if (validation.pass) {
        this.sessionStorageEnhancer.save(modeId, 'cards', validation.validCards);
        return true;
      }
      return false;
    },

    validateConfiguration() {
      return dataManager.validateConfig(this.sessionCards);
    },

    loadAllMediumCards() {
      const storedData = localStorage.getItem('app_medium_cards');
      this.mediumCards = storedData ? JSON.parse(storedData) : [];
    },

    saveToMedium() {
      const currentMode = this.currentMode;
      if (!currentMode) return [];

      const validation = dataManager.validateConfig(this.sessionCards);
      if (!validation.pass) {
        this.error = '数据校验失败，无法保存到中期存储';
        console.error('中期存储校验失败:', validation.errors);
        return [];
      }

      const mediumData = validation.validCards.map(card => ({
        ...card,
        modeId: currentMode.id,
        storedAt: new Date().toISOString()
      }));

      this.mediumCards = [
        ...this.mediumCards.filter(c => !(c.modeId === currentMode.id && mediumData.some(m => m.id === c.id))),
        ...mediumData
      ];

      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
      return mediumData;
    },

    removeFromMedium(cardIds) {
      if (!cardIds || cardIds.length === 0) return;
      this.mediumCards = this.mediumCards.filter(card => !cardIds.includes(card.id));
      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
    },

    loadFromMedium(mediumCardIds) {
      const mediumCards = this.mediumCards.filter(card => mediumCardIds.includes(card.id));
      if (mediumCards.length === 0) return [];
      this.sessionCards = [...this.sessionCards, ...mediumCards];
      this.saveSessionCards(this.currentModeId);
      return mediumCards;
    },

    addTempCard(initialData = {}) {
      const newCard = this.normalizeCardStructure({
        ...initialData,
        storageLevel: 'temp',
        // 若传入 id 合法则使用，否则生成
        id: this.rootMode.dataStandards.cardIdPattern.test(initialData?.id || '')
          ? initialData.id
          : this.generateCardId()
      });

      this.tempCards.push(newCard);
      this.selectedCardId = newCard.id;
      return newCard;
    },

    updateTempCard(updatedCard) {
      const index = this.tempCards.findIndex(card => card.id === updatedCard.id);
      if (index !== -1) {
        this.tempCards[index] = this.normalizeCardStructure({
          ...this.tempCards[index],
          ...updatedCard,
          storageLevel: 'temp'
        });
        return this.tempCards[index];
      }
      return null;
    },

    promoteToSession(cardIds) {
      if (!cardIds || cardIds.length === 0) return [];

      const promotedCards = this.tempCards
        .filter(card => cardIds.includes(card.id))
        .map(card => this.normalizeCardStructure({
          ...card,
          storageLevel: 'session',
          addedToSessionAt: new Date().toISOString()
        }));

      this.sessionCards = [
        ...this.sessionCards.filter(card => !cardIds.includes(card.id)),
        ...promotedCards
      ];

      // 同步到环境配置（仅标准字段）
      promotedCards.forEach(card => {
        this.environmentConfigs.cards[card.id] = {
          id: card.id,
          name: card.data.title ?? null,
          dropdown: (card.data.selectOptions || []).map(opt => opt?.label ?? null)
        };
        // 写入选项
        (card.data.options || []).forEach(opt => {
          const fullId = `${card.id}${opt.id}`;
          if (this.isValidFullOptionId(fullId)) {
            this.environmentConfigs.options[fullId] = {
              name: opt.name ?? null,
              value: opt.value ?? null,
              unit: opt.unit ?? null
            };
          }
        });
      });

      this.saveSessionCards(this.currentModeId);
      this.tempCards = this.tempCards.filter(card => !cardIds.includes(card.id));

      if (this.isRootMode) {
        this.recordRootTempOperation('promote_to_session', { cardIds });
      }

      this.notifyEnvConfigChanged();
      return promotedCards;
    },

    updateCardSelectedValue(cardId, newValue) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].data.selectedValue = newValue;
        return this.tempCards[tempIndex];
      }

      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].data.selectedValue = newValue;
        const selectedOption = this.sessionCards[sessionIndex].data.selectOptions
          .find(opt => opt.label === newValue);

        if (selectedOption) {
          this.applyPresetToCard(cardId, selectedOption.id);
        }

        // 同步环境配置 dropdown（selectedValue 不入环境配置标准字段）
        if (this.environmentConfigs.cards[cardId]) {
          this.environmentConfigs.cards[cardId].dropdown =
            this.sessionCards[sessionIndex].data.selectOptions.map(opt => opt.label ?? null);
          this.notifyEnvConfigChanged();
        }

        return this.sessionCards[sessionIndex];
      }

      return null;
    },

    exportData(fileName = 'card_data.json') {
      return dataManager.exportData(this.currentModeId, fileName);
    },

    async importData(file) {
      try {
        const importedData = await dataManager.importFromFile(file);
        const safeData = importedData.map(card => this.normalizeCardStructure({
          ...card,
          modeId: this.currentModeId,
          storageLevel: 'session'
        }));

        this.sessionCards = [...this.sessionCards, ...safeData];
        this.saveSessionCards(this.currentModeId);

        // 同步到环境配置（仅标准字段）
        safeData.forEach(card => {
          this.environmentConfigs.cards[card.id] = {
            id: card.id,
            name: card.data.title ?? null,
            dropdown: (card.data.selectOptions || []).map(opt => opt?.label ?? null)
          };
          (card.data.options || []).forEach(option => {
            const fullId = `${card.id}${option.id}`;
            if (this.isValidFullOptionId(fullId)) {
              this.environmentConfigs.options[fullId] = {
                name: option.name ?? null,
                value: option.value ?? null,
                unit: option.unit ?? null
              };
            }
          });
        });

        this.notifyEnvConfigChanged();
        return { success: true, count: safeData.length };
      } catch (err) {
        this.error = `导入失败：${err.message}`;
        return { success: false, error: this.error };
      }
    },

    addMode(modeData) {
      if (modeData.id === 'root_admin' || modeData.name === '根模式（源数据区）') {
        this.error = '不能创建与主模式同名或同ID的模式';
        return null;
      }
      const newMode = {
        id: modeData.id || `mode-${uuidv4()}`,
        ...modeData,
        level: 2,
        isUserMode: true,
        syncInfo: {
          lastSyncTime: null,
          syncFields: [],
          authFields: [],
          syncedCardIds: []
        }
      };
      this.modes.push(newMode);
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));
      return newMode;
    },

    deleteModes(modeIds) {
      const filteredIds = modeIds.filter(id => id !== 'root_admin');
      if (filteredIds.length === 0) return;

      this.modes = this.modes.filter(mode => !filteredIds.includes(mode.id));
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));

      if (filteredIds.includes(this.currentModeId)) {
        this.setCurrentMode('root_admin');
      }
    },

    setCurrentMode(modeId) {
      const modeExists = modeId === 'root_admin' || this.modes.some(m => m.id === modeId);
      if (!modeExists) return;

      if (this.currentModeId) {
        this.saveSessionCards(this.currentModeId);
      }

      this.currentModeId = modeId;
      this.loadSessionCards(modeId);
      this.tempCards = [];
      this.selectedCardId = null;
    },

    // 联动同步（主接口），UI 可继续调用该方法；也可通过 syncData 包装调用
    syncToMode(targetModeId, cardIds, syncConfig) {
      if (!targetModeId || targetModeId === 'root_admin') {
        this.error = '不能向主模式推送数据';
        return null;
      }
      if (this.currentModeId !== 'root_admin') {
        this.error = '只有主模式可以推送数据';
        return null;
      }

      const { syncFields = [], authFields = [] } = syncConfig || {};
      const validation = dataManager.validateConfig(this.sessionCards);

      if (!validation.pass) {
        this.error = '源数据校验失败，无法同步';
        return null;
      }

      const sourceCards = validation.validCards
        .filter(card => cardIds.includes(card.id))
        .map(card => {
          const titleSync = syncFields.includes(this.FIELD_IDS.CARD_TITLE);
          const titleAuth = authFields.includes(this.FIELD_IDS.CARD_TITLE);
          const nameSync = syncFields.includes(this.FIELD_IDS.OPTION_NAME);
          const nameAuth = authFields.includes(this.FIELD_IDS.OPTION_NAME);
          const valueSync = syncFields.includes(this.FIELD_IDS.OPTION_VALUE);
          const valueAuth = authFields.includes(this.FIELD_IDS.OPTION_VALUE);
          const unitSync = syncFields.includes(this.FIELD_IDS.OPTION_UNIT);
          const unitAuth = authFields.includes(this.FIELD_IDS.OPTION_UNIT);
          const uiSync = syncFields.includes(this.FIELD_IDS.UI_CONFIG);

          // 记录授权（按字段）
          authFields.forEach(field => {
            this.setFieldAuthorization('root_admin', targetModeId, field, true);
          });

          // 根据同步字段裁剪数据（不改变本地源卡）
          return this.normalizeCardStructure({
            ...card,
            modeId: targetModeId,
            sourceModeId: 'root_admin',
            syncStatus: {
              title: { hasSync: titleSync, isAuthorized: titleAuth },
              options: {
                name: { hasSync: nameSync, isAuthorized: nameAuth },
                value: { hasSync: valueSync, isAuthorized: valueAuth },
                unit:  { hasSync: unitSync,  isAuthorized: unitAuth }
              },
              selectOptions: { hasSync: true, isAuthorized: false },
              uiConfig: { hasSync: uiSync, isAuthorized: false }
            },
            data: {
              ...card.data,
              title: titleSync ? card.data.title : null,
              options: card.data.options.map(option => ({
                ...option,
                name: nameSync ? option.name : null,
                value: valueSync ? option.value : null,
                unit: unitSync ? option.unit : null,
                localName: null,
                localValue: null,
                localUnit: null
              })),
              uiConfig: uiSync ? card.data.uiConfig : {}
            },
            syncTime: new Date().toISOString()
          });
        });
      const cardPresets = {};
      cardIds.forEach(id => {
        if (this.presetMappings[id]) {
          cardPresets[id] = this.presetMappings[id];
        }
      });

      if (sourceCards.length === 0) return null;

      // 将目标模式下的会话卡片替换或追加
      const targetRawCards = this.sessionStorageEnhancer.load(targetModeId, 'cards') || [];
      const targetCards = [
        ...targetRawCards.filter(card => !cardIds.includes(card.id)),
        ...sourceCards
      ];

      this.sessionStorageEnhancer.save(targetModeId, 'cards', targetCards);

      // 若当前即目标模式，更新本地状态与预设
      if (this.currentModeId === targetModeId) {
        this.sessionCards = targetCards;
        Object.keys(cardPresets).forEach(cardId => {
          this.presetMappings[cardId] = cardPresets[cardId];
        });
        this.savePresetMappings();
      }

      // 同步完成后，更新子模式解析数据
      const subModeInstance = this.subModes.instances.find(inst => inst.id === targetModeId);
      if (subModeInstance) {
        this.parseSubModeData(targetModeId);
      }

      this.updateModeSyncInfo(targetModeId, {
        lastSyncTime: new Date().toISOString(),
        syncFields,
        authFields,
        syncedCardIds: cardIds
      });

      // 记录同步历史
      this.recordSyncHistory({
        sourceModeId: 'root_admin',
        targetModeId,
        cardIds,
        fields: syncFields
      });

      return { targetModeId, syncedCount: sourceCards.length, syncFields, authFields };
    },

    updateModeSyncInfo(modeId, syncInfo) {
      const modeIndex = this.modes.findIndex(m => m.id === modeId);
      if (modeIndex !== -1) {
        this.modes[modeIndex] = {
          ...this.modes[modeIndex],
          syncInfo: {
            ...this.modes[modeIndex].syncInfo,
            ...syncInfo
          }
        };
        localStorage.setItem('app_user_modes', JSON.stringify(this.modes));
      }
    },

    updateModeCardLocalValue(modeId, cardId, fieldType, optIndex, value) {
      if (modeId !== this.currentModeId) return false;

      const cardIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return false;

      const card = this.sessionCards[cardIndex];

      if (fieldType === 'title') {
        if (!card.syncStatus.title.isAuthorized) return false;
        card.data.title = value;

        // 如果是root模式，同时更新环境配置
        if (this.isRootMode && this.environmentConfigs.cards[cardId]) {
          this.environmentConfigs.cards[cardId].name = value ?? null;
          this.notifyEnvConfigChanged();
        }
      } else if (optIndex !== undefined) {
        const option = card.data.options[optIndex];
        if (!option) return false;

        const fullId = `${cardId}${option.id}`;

        if (fieldType === 'name') {
          if (!card.syncStatus.options.name.isAuthorized) return false;
          option.name = value;
          if (this.isRootMode && this.environmentConfigs.options[fullId]) {
            this.environmentConfigs.options[fullId].name = value ?? null;
            this.notifyEnvConfigChanged();
          }
        } else if (fieldType === 'value') {
          if (!card.syncStatus.options.value.isAuthorized) return false;
          option.value = value;
          if (this.isRootMode && this.environmentConfigs.options[fullId]) {
            this.environmentConfigs.options[fullId].value = value ?? null;
            this.notifyEnvConfigChanged();
          }
        } else if (fieldType === 'unit') {
          if (!card.syncStatus.options.unit.isAuthorized) return false;
          option.unit = value;
          if (this.isRootMode && this.environmentConfigs.options[fullId]) {
            this.environmentConfigs.options[fullId].unit = value ?? null;
            this.notifyEnvConfigChanged();
          }
        }
      }

      this.saveSessionCards(modeId);
      return true;
    }
  }
});
