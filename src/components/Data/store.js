import { defineStore } from 'pinia';
import DataManager from './manager';
import { v4 as uuidv4 } from 'uuid';
import OtherModeTemplate from '../Othermodes/OtherModeTemplate.vue';

// 会话存储增强器
export class SessionStorageEnhancer {
  constructor(sessionId) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.prefix = `${this.sessionId}:`;
  }

  // 加载指定模式下的指定类型数据
  load(modeId, dataType) {
    const key = `${this.prefix}${modeId}:${dataType}`;
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  // 保存数据到指定模式和类型
  save(modeId, dataType, data) {
    const key = `${this.prefix}${modeId}:${dataType}`;
    sessionStorage.setItem(key, JSON.stringify(data));
    return true;
  }

  // 清除指定模式的数据
  clear(modeId) {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(`${this.prefix}${modeId}:`)) {
        sessionStorage.removeItem(key);
      }
    });
  }

  // 清除所有会话数据
  clearAll() {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

// 常量定义：合并了DataSectionStore的字段标识
export const FIELD_IDS = {
  // 原有固定同步字段
  CARD_COUNT: 'cardCount',
  CARD_ORDER: 'cardOrder',
  OPTIONS: 'options',
  SELECT_OPTIONS: 'selectOptions',
  
  // 原有可配置同步+授权字段
  CARD_TITLE: 'card_title',
  OPTION_NAME: 'option_name',
  OPTION_VALUE: 'option_value',
  OPTION_UNIT: 'option_unit',
  UI_CONFIG: 'ui_config',
  CHECKBOX: 'checkbox',
  
  // 新增：DataSectionStore相关字段
  DATA_SECTION_ID: 'data_section_id',
  SECTION_TITLE: 'section_title',
  SECTION_ITEMS: 'section_items',
  SECTION_VALIDITY: 'section_validity',
  SECTION_DEPENDENCIES: 'section_dependencies'
};

// 固定同步的字段（包含DataSectionStore的必要字段）
export const FIXED_SYNC_FIELDS = [
  FIELD_IDS.OPTIONS, 
  FIELD_IDS.SELECT_OPTIONS,
  FIELD_IDS.CARD_COUNT,
  FIELD_IDS.CARD_ORDER,
  FIELD_IDS.DATA_SECTION_ID,
  FIELD_IDS.SECTION_ITEMS
];

// 可配置同步的字段（扩展数据段相关）
export const CONFIGURABLE_SYNC_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT,
  FIELD_IDS.UI_CONFIG,
  FIELD_IDS.SECTION_TITLE,
  FIELD_IDS.SECTION_VALIDITY
];

// 可授权编辑的字段（扩展数据段相关）
export const AUTHORIZABLE_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT,
  FIELD_IDS.UI_CONFIG,
  FIELD_IDS.CHECKBOX,
  FIELD_IDS.SECTION_TITLE,
  FIELD_IDS.SECTION_ITEMS
];

// 路由实例存储
let routerInstance = null;

// 创建数据管理器实例
const dataManager = new DataManager();

export const useCardStore = defineStore('data', {
  state: () => ({
    // 1) 主模式（root_admin）
    rootMode: {
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
      contextTemplates: [],
      
      // 模式联动控制相关状态
      linkageControl: {
        isModeDropdownOpen: false,
        selectedMode: '',
        isInPrepareState: false,
        
        // 同步选项（控制是否展示内容）
        syncOptions: [
          { id: 1, name: '卡片标题', fieldId: FIELD_IDS.CARD_TITLE, checked: false },
          { id: 2, name: '选项名称', fieldId: FIELD_IDS.OPTION_NAME, checked: false },
          { id: 3, name: '选项值', fieldId: FIELD_IDS.OPTION_VALUE, checked: false },
          { id: 4, name: '选项单位', fieldId: FIELD_IDS.OPTION_UNIT, checked: false },
          { id: 5, name: '数据段标题', fieldId: FIELD_IDS.SECTION_TITLE, checked: false } // 新增
        ],
        
        // 授权选项（控制是否允许编辑）
        authOptions: [
          { id: 1, name: '卡片标题', fieldId: FIELD_IDS.CARD_TITLE, checked: false },
          { id: 2, name: '选项名称', fieldId: FIELD_IDS.OPTION_NAME, checked: false },
          { id: 3, name: '选项值', fieldId: FIELD_IDS.OPTION_VALUE, checked: false },
          { id: 4, name: '选项单位', fieldId: FIELD_IDS.OPTION_UNIT, checked: false },
          { id: 5, name: '复选框', fieldId: FIELD_IDS.CHECKBOX, checked: false },
          { id: 6, name: '数据段内容', fieldId: FIELD_IDS.SECTION_ITEMS, checked: false } // 新增
        ]
      }
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
      pendingSyncs: [],
      currentLinkageConfig: null
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

    // 7) 数据段管理区（来自DataSectionStore）
    dataSection: {
      // UI状态
      isManager: false,
      filterType: 'all',
      syncFilter: 'all',
      isPreview: false,
      previewData: { configs: [], questions: [], totalCount: 0 },
      selectAll: false,
      selectedCount: 0,
      
      // 临时存储
      tempSelected: []
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
    
    // 路由管理相关状态
    modeRoutes: {}, // 存储模式路由信息: { modeId: { routeName, path } }
    
    // 初始化数据管理器和会话存储增强器
    sessionStorageEnhancer: new SessionStorageEnhancer(),
    dataManager: dataManager,
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

    // 环境配置区接口
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

    // 模式联动控制相关计算属性
    filteredModes: (s) => {
      return s.modes.filter(mode => mode.id !== 'root_admin');
    },
    canConfirmLinkage: (s) => {
      if (!s.environmentConfigs.linkageControl.isInPrepareState || 
          !s.environmentConfigs.linkageControl.selectedMode || 
          !s.currentModeId) return false;
      return true;
    },

    // 题库区
    allQuestionCategories() { return [...this.questionBank.categories]; },
    getQuestionById: (s) => (id) => s.questionBank.questions.find(q => q.id === id),
    isQuestionExpressionValid: (s) => (expression) =>
      s.rootMode.dataStandards.questionExpressionPattern.test(expression),

    // 联动授权读取
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

    // 原有通用getters
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
    sortedOptions(card) { return [...card.data.options].sort((a, b) => parseInt(a.id) - parseInt(b.id)); },

    // ------------------------------
    // 数据段管理相关getters（来自DataSectionStore）
    // ------------------------------
    dataSectionIsRootMode() {
      return dataManager.rootAdminId === this.currentModeId;
    },
    
    dataSectionCurrentMode() {
      return this.getMode(this.currentModeId);
    },
    
    // 整合所有数据（按时间倒序）
    allData() {
      // 获取基础数据并添加默认值
      const environmentConfigs = this.environmentConfigs || {};
      const questionBank = this.questionBank || {};
      const modes = this.subModes.instances || [];
      
      // 确保数组属性存在
      const contextTemplates = Array.isArray(environmentConfigs.contextTemplates) 
        ? environmentConfigs.contextTemplates 
        : [];
      const questions = Array.isArray(questionBank.questions) 
        ? questionBank.questions 
        : [];

      // 环境配置数据
      const configData = contextTemplates.map(item => ({
        id: item.questionId,
        dataType: 'config',
        typeText: '环境配置',
        summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
        modeId: this.currentModeId || '',
        syncStatus: this.getCardSyncStatus(item.questionId) || {},
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }));
      
      // 题库数据
      const questionData = questions.map(item => ({
        id: item.id,
        dataType: 'question',
        typeText: '资料题库',
        summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
        modeId: this.currentModeId || '',
        syncStatus: this.getCardSyncStatus(item.id) || {},
        difficulty: item.difficulty || 'medium',
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }));
      
      // 模式数据
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
      ];
      
      // 按时间戳降序排序
      return [...configData, ...questionData, ...modeData]
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    
    // 筛选后的数据
    filteredData() {
      const sourceData = this.dataSection.isPreview 
        ? [...this.dataSection.previewData.configs, ...this.dataSection.previewData.questions].map(item => ({
            ...item,
            summary: item.content || item.questionId || '未命名数据',
            timestamp: item.timestamp || new Date().getTime()
          }))
        : this.allData;
      
      let result = [...sourceData];
      
      // 类型筛选
      if (this.dataSection.filterType !== 'all') {
        result = result.filter(item => item.dataType === this.dataSection.filterType);
      }
      
      // 同步状态筛选
      if (this.isRootMode && this.dataSection.syncFilter !== 'all') {
        result = result.filter(item => 
          this.checkSyncStatus(item.syncStatus, this.dataSection.syncFilter)
        );
      }
      
      return result.sort((a, b) => b.timestamp - a.timestamp);
    },
    
    // 是否有选中的模式数据
    hasModeDataSelected() {
      return this.filteredData.some(item => item.selected && this.isModeData(item));
    },
    
    // 是否有预览数据
    hasPreview() {
      return this.dataSection.previewData.totalCount > 0;
    }
  },

  actions: {
    // ------------------------------
    // 整合modeUtils的路由与模式管理功能
    // ------------------------------
    
    // 初始化路由实例
    initRouter(router) {
      routerInstance = router;
    },

    // 生成模式页面
    generateModePage(mode) {
      if (!routerInstance) {
        console.error('路由实例未初始化，请先调用initRouter()');
        return null;
      }
      
      if (!mode || !mode.id) {
        console.error('生成模式页面失败：缺少模式ID');
        return null;
      }
      
      // 标准化路由路径
      const standardizedPath = `/mode/${mode.id}`;
      const modeWithStandardPath = { ...mode, routePath: standardizedPath };
      
      const modeComponent = {
        id: modeWithStandardPath.id,
        name: `${modeWithStandardPath.id}-component`,
        path: modeWithStandardPath.routePath,
        component: this.createModeComponent(modeWithStandardPath)
      };
      
      this.registerModeRoute(modeComponent);
      this.saveGeneratedMode(modeComponent);
      
      console.log(`已生成模式页面: ${mode.name} (${mode.id})`);
      return modeComponent;
    },

    // 创建模式组件
    createModeComponent(mode) {
      return {
        template: `<OtherModeTemplate :mode-id="modeId" />`,
        data() {
          return { modeId: mode.id };
        },
        components: { OtherModeTemplate }
      };
    },

    // 注册模式路由
    registerModeRoute(modeComponent) {
      if (!routerInstance) return;
      
      const routeExists = routerInstance.getRoutes().some(
        route => route.path === modeComponent.path
      );
      
      if (!routeExists) {
        routerInstance.addRoute({
          path: modeComponent.path,
          name: modeComponent.name,
          component: modeComponent.component,
          meta: { modeId: modeComponent.id, requiresAuth: true }
        });
      }
    },

    // 保存生成的模式
    saveGeneratedMode(modeComponent) {
      let generatedModes = JSON.parse(localStorage.getItem('generated_modes') || '[]');
      
      const index = generatedModes.findIndex(m => m.id === modeComponent.id);
      if (index !== -1) {
        generatedModes[index] = modeComponent;
      } else {
        generatedModes.push({
          id: modeComponent.id,
          name: modeComponent.name,
          path: modeComponent.path
        });
      }
      
      localStorage.setItem('generated_modes', JSON.stringify(generatedModes));
    },

    // 删除模式页面
    deleteModePage(modeId) {
      if (!routerInstance) return;
      
      // 从路由中移除
      const route = routerInstance.getRoutes().find(r => r.meta?.modeId === modeId);
      if (route) {
        routerInstance.removeRoute(route.name);
      }
      
      // 从存储中移除
      let generatedModes = JSON.parse(localStorage.getItem('generated_modes') || '[]');
      generatedModes = generatedModes.filter(m => m.id !== modeId);
      localStorage.setItem('generated_modes', JSON.stringify(generatedModes));
      
      console.log(`已彻底删除模式页面数据: ${modeId}`);
    },

    // 加载已生成的模式
    loadGeneratedModes() {
      return JSON.parse(localStorage.getItem('generated_modes') || '[]');
    },

    // 跳转到模式页面
    navigateToMode(modeId) {
      if (!routerInstance) {
        console.error('路由实例未初始化');
        return;
      }
      
      const targetPath = `/mode/${modeId}`;
      routerInstance.push(targetPath).catch(err => {
        if (!err.message.includes('Avoided redundant navigation')) {
          console.error('导航到模式页面失败:', err);
        }
      });
    },

    // 发送反馈到主模式
    sendFeedbackToRoot(modeId, feedback) {
      const rootMode = this.getMode('root_admin');
      
      if (!rootMode.feedback) {
        rootMode.feedback = {};
      }
      
      if (!rootMode.feedback[modeId]) {
        rootMode.feedback[modeId] = [];
      }
      
      rootMode.feedback[modeId].push({
        ...feedback,
        timestamp: new Date().toISOString()
      });
      
      this.saveModesToStorage();
    },

    // 校验同步权限
    checkSyncPermission(sourceModeId, targetModeId) {
      // 强制只有root_admin可以作为数据源
      if (sourceModeId !== 'root_admin') {
        console.warn('权限校验失败：只有root_admin可以作为同步源');
        return false;
      }
      
      // 不能同步到自己
      if (sourceModeId === targetModeId) {
        console.warn('权限校验失败：不能同步到自身模式');
        return false;
      }
      
      const targetMode = this.getMode(targetModeId);
      if (!targetMode) {
        console.warn(`权限校验失败：目标模式${targetModeId}不存在`);
        return false;
      }
      
      return true;
    },

    // 处理值
    processValue(value) {
      if (value === '' || value === undefined) {
        return null;
      }
      if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
        throw new Error('不允许输入"null"字符串，请留空表示空值');
      }
      return value;
    },

    // 检查字段是否同步
    isFieldSynced(field, syncFields) {
      if ([
        FIELD_IDS.OPTIONS, 
        FIELD_IDS.SELECT_OPTIONS,
        FIELD_IDS.CARD_COUNT,
        FIELD_IDS.CARD_ORDER,
        FIELD_IDS.DATA_SECTION_ID,
        FIELD_IDS.SECTION_ITEMS
      ].includes(field)) {
        return true;
      }
      return syncFields.includes(field);
    },

    // 主协调函数
    coordinateMode(linkageConfig) {
      const { 
        sourceModeId, 
        sourceData, 
        targetModeIds, 
        syncFields, 
        authFields 
      } = linkageConfig;
      
      // 初始化源数据（如果未提供）
      const resolvedSourceData = sourceData || {
        cards: this.sessionCards.map((card, index) => ({
          id: card.id,
          showDropdown: card.showDropdown,
          data: {
            title: card.data.title,
            options: card.data.options,
            selectOptions: card.data.selectOptions,
            selectedValue: card.data.selectedValue,
            showSelect: card.data.showSelect || true
          },
          cardIndex: index,
          optionCount: card.data.options.length
        })),
        timestamp: new Date().toISOString()
      };
      
      // 前置校验
      if (sourceModeId !== 'root_admin') {
        throw new Error('只有root_admin可以作为同步源');
      }
      if (!Array.isArray(targetModeIds) || targetModeIds.length === 0) {
        throw new Error('目标模式列表不能为空');
      }
      if (!resolvedSourceData?.cards || !Array.isArray(resolvedSourceData.cards)) {
        throw new Error('源数据格式错误，cards必须是数组');
      }
      
      // 验证同步字段
      const validSyncFields = [...Object.values(FIELD_IDS)];
      syncFields.forEach(field => {
        if (!validSyncFields.includes(field)) {
          throw new Error(`无效的同步字段: ${field}，允许的字段：${validSyncFields.join(',')}`);
        }
      });
      
      let successCount = 0;
      
      // 同步到目标模式
      targetModeIds.forEach(targetId => {
        if (this.checkSyncPermission(sourceModeId, targetId)) {
          try {
            this.syncToTargetMode(
              sourceModeId, 
              targetId, 
              resolvedSourceData, 
              syncFields, 
              authFields
            );
            dataManager.saveMode(targetId);
            successCount++;
            console.log(`已完成root_admin到${targetId}的完整同步`);
          } catch (error) {
            console.error(`同步到${targetId}失败：`, error);
          }
        }
      });
      
      // 同步完成后通知dataManager
      dataManager.syncComplete();
      
      return {
        success: successCount > 0,
        total: targetModeIds.length,
        successCount: successCount
      };
    },

    // 同步到目标模式
    syncToTargetMode(sourceId, targetId, sourceData, syncFields, authFields) {
      const targetMode = this.getMode(targetId);
      
      if (!targetMode) return;
      
      // 确保目标模式有cardData数组
      if (!Array.isArray(targetMode.cardData)) {
        targetMode.cardData = [];
      }
      
      // 卡片数量同步
      targetMode.cardData = targetMode.cardData.filter(targetCard => 
        sourceData.cards.some(sourceCard => sourceCard.id === targetCard.id)
      );
      
      // 同步每张卡片的数据
      sourceData.cards.forEach((sourceCard, cardIndex) => {
        const cardToSync = {
          id: sourceCard.id,
          showDropdown: sourceCard.showDropdown ?? false,
          isTitleEditing: false,
          isOptionsEditing: false,
          isSelectEditing: false,
          orderIndex: cardIndex,
          editableFields: {
            [FIELD_IDS.CARD_TITLE]: authFields.includes(FIELD_IDS.CARD_TITLE),
            [FIELD_IDS.OPTION_NAME]: authFields.includes(FIELD_IDS.OPTION_NAME),
            [FIELD_IDS.OPTION_VALUE]: authFields.includes(FIELD_IDS.OPTION_VALUE),
            [FIELD_IDS.OPTION_UNIT]: authFields.includes(FIELD_IDS.OPTION_UNIT),
            [FIELD_IDS.SECTION_TITLE]: authFields.includes(FIELD_IDS.SECTION_TITLE),
            [FIELD_IDS.SECTION_ITEMS]: authFields.includes(FIELD_IDS.SECTION_ITEMS),
            optionActions: false,
            select: false
          },
          syncStatus: {
            [FIELD_IDS.CARD_TITLE]: this.isFieldSynced(FIELD_IDS.CARD_TITLE, syncFields),
            [FIELD_IDS.OPTION_NAME]: this.isFieldSynced(FIELD_IDS.OPTION_NAME, syncFields),
            [FIELD_IDS.OPTION_VALUE]: this.isFieldSynced(FIELD_IDS.OPTION_VALUE, syncFields),
            [FIELD_IDS.OPTION_UNIT]: this.isFieldSynced(FIELD_IDS.OPTION_UNIT, syncFields),
            [FIELD_IDS.SECTION_TITLE]: this.isFieldSynced(FIELD_IDS.SECTION_TITLE, syncFields),
            [FIELD_IDS.SECTION_ITEMS]: this.isFieldSynced(FIELD_IDS.SECTION_ITEMS, syncFields),
            [FIELD_IDS.OPTIONS]: true,
            [FIELD_IDS.SELECT_OPTIONS]: true,
            [FIELD_IDS.CARD_COUNT]: true,
            [FIELD_IDS.CARD_ORDER]: true
          },
          data: {
            title: null,
            options: [],
            selectOptions: [],
            selectedValue: sourceCard.data?.selectedValue ?? '',
            showSelect: sourceCard.data?.showSelect ?? true
          }
        };
        
        // 处理现有目标卡片
        const existingTargetCard = targetMode.cardData.find(c => c.id === sourceCard.id);
        const targetOptions = existingTargetCard ? [...existingTargetCard.data.options] : [];
        
        // 选项数据同步
        sourceCard.data.options.forEach(sourceOption => {
          const existingOption = targetOptions.find(o => o.id === sourceOption.id);
          
          const processedOption = {
            id: sourceOption.id || Date.now() + Math.random(),
            name: this.isFieldSynced(FIELD_IDS.OPTION_NAME, syncFields)
              ? this.processValue(sourceOption.name)
              : (existingOption?.name ?? null),
            value: this.isFieldSynced(FIELD_IDS.OPTION_VALUE, syncFields)
              ? this.processValue(sourceOption.value)
              : (existingOption?.value ?? null),
            unit: this.isFieldSynced(FIELD_IDS.OPTION_UNIT, syncFields)
              ? this.processValue(sourceOption.unit)
              : (existingOption?.unit ?? null),
            checked: sourceOption.checked !== undefined 
              ? sourceOption.checked 
              : (existingOption?.checked ?? false),
            localName: existingOption?.localName ?? null,
            localValue: existingOption?.localValue ?? null,
            localUnit: existingOption?.localUnit ?? null
          };
          
          if (existingOption) {
            Object.assign(existingOption, processedOption);
          } else {
            targetOptions.push(processedOption);
          }
        });
        
        // 确保选项顺序
        cardToSync.data.options = targetOptions.sort((a, b) => {
          const indexA = sourceCard.data.options.findIndex(option => option.id === a.id);
          const indexB = sourceCard.data.options.findIndex(option => option.id === b.id);
          return indexA - indexB;
        });
        
        // 下拉菜单同步
        cardToSync.data.selectOptions = (sourceCard.data?.selectOptions || []).map(option => ({
          id: option.id || Date.now() + Math.random(),
          label: this.processValue(option.label),
          localLabel: existingTargetCard?.data?.selectOptions?.find(o => o.id === option.id)?.localLabel ?? null
        }));
        
        // 卡片标题同步
        cardToSync.data.title = this.isFieldSynced(FIELD_IDS.CARD_TITLE, syncFields)
          ? this.processValue(sourceCard.data?.title)
          : (existingTargetCard?.data?.title ?? null);
        cardToSync.data.localTitle = existingTargetCard?.data?.localTitle ?? null;
        
        // 更新或新增卡片
        const targetCardIndex = targetMode.cardData.findIndex(c => c.id === sourceCard.id);
        if (targetCardIndex > -1) {
          targetMode.cardData[targetCardIndex] = {
            ...targetMode.cardData[targetCardIndex],
            ...cardToSync,
            data: {
              ...targetMode.cardData[targetCardIndex].data,
              ...cardToSync.data
            }
          };
        } else {
          targetMode.cardData.push(cardToSync);
        }
      });
      
      // 确保卡片顺序
      targetMode.cardData.sort((a, b) => a.orderIndex - b.orderIndex);
      
      // 更新模式元数据
      targetMode.lastSynced = new Date().toISOString();
      targetMode.source = 'root_admin';
      targetMode.syncFields = [...syncFields];
      targetMode.authFields = [...authFields];
      targetMode.syncCompleted = true;
      
      // 保存更新后的模式
      this.saveModesToStorage();
    },

    // ------------------------------
    // 原有store.js的功能
    // ------------------------------
    
    // 初始化
    async initialize() {
      this.loading = true;
      this.error = null;
      try {
        // 确保数据管理器已正确初始化
        if (!this.dataManager) {
          this.dataManager = new DataManager();
        }
        
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

        // 初始化模式路由
        this.initializeModeRoutes();

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

    // 初始化模式路由
    initializeModeRoutes() {
      this.modes.forEach(mode => {
        if (!this.modeRoutes[mode.id]) {
          const routeName = `Mode-${mode.id}`;
          const path = mode.path || `/mode/${mode.id}`;
          this.modeRoutes[mode.id] = { routeName, path };
        }
      });
    },

    // 添加模式路由记录
    addModeRoute(modeId, routeName, path) {
      this.modeRoutes[modeId] = { routeName, path };
    },

    // 生成模式路由路径
    generateModeRoutePath(modeId) {
      return `/mode/${modeId}`;
    },

    // 获取模式路由信息
    getModeRoute(modeId) {
      return this.modeRoutes[modeId] || null;
    },

    // 模式联动控制相关方法
    toggleModeDropdown() {
      this.environmentConfigs.linkageControl.isModeDropdownOpen = 
        !this.environmentConfigs.linkageControl.isModeDropdownOpen;
    },
    
    selectMode(modeName) {
      this.environmentConfigs.linkageControl.selectedMode = modeName;
      this.environmentConfigs.linkageControl.isModeDropdownOpen = false;
    },
    
    togglePrepareStatus() {
      if (this.environmentConfigs.linkageControl.isInPrepareState) {
        // 取消准备状态时重置选项
        this.environmentConfigs.linkageControl.syncOptions.forEach(item => {
          item.checked = false;
        });
        this.environmentConfigs.linkageControl.authOptions.forEach(item => {
          item.checked = false;
        });
      }
      this.environmentConfigs.linkageControl.isInPrepareState = 
        !this.environmentConfigs.linkageControl.isInPrepareState;
    },
    
    resetLinkageState() {
      this.environmentConfigs.linkageControl.selectedMode = '';
      this.environmentConfigs.linkageControl.isInPrepareState = false;
      this.environmentConfigs.linkageControl.syncOptions.forEach(item => {
        item.checked = false;
      });
      this.environmentConfigs.linkageControl.authOptions.forEach(item => {
        item.checked = false;
      });
      this.linkageSync.currentLinkageConfig = null;
    },
    
    confirmLinkage() {
      // 找到目标模式ID
      let targetModeIds = [];
      if (this.environmentConfigs.linkageControl.selectedMode === '所有模式') {
        targetModeIds = this.filteredModes.map(mode => mode.id);
      } else {
        const targetMode = this.modes.find(mode => mode.name === this.environmentConfigs.linkageControl.selectedMode);
        if (targetMode) {
          targetModeIds = [targetMode.id];
        } else {
          this.error = '未找到目标模式';
          return null;
        }
      }
      
      // 构建联动配置
      const linkageConfig = {
        sourceModeId: this.currentModeId || 'root_admin',
        targetMode: this.environmentConfigs.linkageControl.selectedMode,
        targetModeIds: targetModeIds,
        // 固定同步字段
        fixedSync: FIXED_SYNC_FIELDS,
        // 用户选择的同步字段（使用fieldId）
        sync: this.environmentConfigs.linkageControl.syncOptions
          .filter(item => item.checked)
          .map(item => item.fieldId),
        // 用户选择的授权字段（使用fieldId）
        auth: this.environmentConfigs.linkageControl.authOptions
          .filter(item => item.checked)
          .map(item => item.fieldId),
        timestamp: new Date().toISOString()
      };
      
      // 保存当前联动配置
      this.linkageSync.currentLinkageConfig = linkageConfig;
      
      // 执行同步 - 使用整合后的coordinateMode方法
      const result = this.coordinateMode(linkageConfig);
      
      // 重置状态
      this.resetLinkageState();
      
      return result;
    },
    
    // 根据联动配置同步数据到目标模式
    syncDataToTargets(linkageConfig) {
      if (!linkageConfig || !linkageConfig.targetModeIds || linkageConfig.targetModeIds.length === 0) {
        this.error = '无效的联动配置或目标模式';
        return null;
      }
      
      // 获取所有需要同步的卡片ID（当前会话中的所有卡片）
      const cardIds = this.sessionCards.map(card => card.id);
      
      // 对每个目标模式执行同步
      const results = [];
      for (const targetModeId of linkageConfig.targetModeIds) {
        const result = this.syncToMode(targetModeId, cardIds, {
          sync: linkageConfig.sync,
          auth: linkageConfig.auth
        });
        
        if (result) {
          results.push(result);
        }
      }
      
      // 记录同步历史
      this.recordSyncHistory({
        sourceModeId: linkageConfig.sourceModeId,
        targetMode: linkageConfig.targetMode,
        targetModeIds: linkageConfig.targetModeIds,
        cardIds,
        syncFields: linkageConfig.sync,
        authFields: linkageConfig.auth
      });
      
      return {
        success: results.length > 0,
        syncedModes: results.length,
        details: results
      };
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
      return this.dataManager.compareCardIds(id1, id2);
    },
    getAllUsedCardIds() {
      const set = new Set();
      Object.keys(this.environmentConfigs.cards || {}).forEach(id => set.add(id));
      (this.sessionCards || []).forEach(c => c?.id && set.add(c.id));
      (this.tempCards || []).forEach(c => c?.id && set.add(c.id));
      return set;
    },
    generateNextCardId() {
      const used = this.getAllUsedCardIds();
      return this.dataManager.generateNextCardId(used);
    },
    generateNextOptionId(cardId) {
      if (!this.isValidCardId(cardId)) { console.error(`卡片ID ${cardId} 不符合标准格式`); return '1'; }
      const options = this.getOptionsByCardId(cardId);
      const existingIds = options.map(opt => opt.id);
      return this.dataManager.generateNextOptionId(existingIds);
    },
    // 对外标准接口：root_admin 垄断
    generateCardId() { return this.generateNextCardId(); },
    generateOptionId(cardId) { return this.generateNextOptionId(cardId); },

    // 2) 环境配置区
    async loadEnvironmentConfigs() {
      const configs = await this.dataManager.loadEnvironmentConfigs();
      this.environmentConfigs = {
        ...this.environmentConfigs,
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
      this.environmentConfigs = {
        ...this.environmentConfigs,
        ...normalizedConfigs
      };
      this.notifyEnvConfigChanged();
      return this.dataManager.saveEnvironmentConfigs(normalizedConfigs);
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
      this.dataManager.saveEnvironmentConfigs(this.environmentConfigs);
      return context;
    },
    getQuestionContext(questionId) {
      return this.environmentConfigs.contextTemplates.find(t => t.questionId === questionId) || null;
    },

    // 3) 题库区
    async loadQuestionBank() {
      const bankData = await this.dataManager.loadQuestionBank();
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
      const normalizedQuestion = this.dataManager.normalizeQuestion(questionData);
      const validation = this.dataManager.validator.validateQuestion(normalizedQuestion);
      if (!validation.pass) { this.error = `题目验证失败: ${validation.errors.join(', ')}`; return false; }
      const idx = this.questionBank.questions.findIndex(q => q.id === normalizedQuestion.id);
      if (idx >= 0) this.questionBank.questions[idx] = normalizedQuestion;
      else this.questionBank.questions.push(normalizedQuestion);
      this.questionBank.lastUpdated = new Date().toISOString();
      this.dataManager.saveQuestionBank(this.questionBank);
      return true;
    },
    removeQuestionFromBank(questionId) {
      this.questionBank.questions = this.questionBank.questions.filter(q => q.id !== questionId);
      this.questionBank.lastUpdated = new Date().toISOString();
      this.dataManager.saveQuestionBank(this.questionBank);
      return true;
    },

    // 4) 联动区
    setFieldAuthorization(sourceModeId, targetModeId, field, authorized) {
      if (!AUTHORIZABLE_FIELDS.includes(field)) {
        console.warn(`字段 ${field} 不在标准可授权列表中，但已记录以兼容UI`);
      }
      const key = `${sourceModeId}_${targetModeId}_${field}`;
      this.linkageSync.fieldAuthorizations[key] = !!authorized;
      this.dataManager.saveFieldAuthorizations(this.linkageSync.fieldAuthorizations);
      return true;
    },
    recordSyncHistory(syncData) {
      const entry = this.dataManager.createSyncHistoryEntry(syncData);
      this.linkageSync.syncHistory.unshift(entry);
      if (this.linkageSync.syncHistory.length > 50) {
        this.linkageSync.syncHistory.pop();
      }
      this.dataManager.saveSyncHistory(this.linkageSync.syncHistory);
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
      const instances = await this.dataManager.loadSubModeInstances();
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
      const feedback = this.dataManager.matchResultsWithQuestionBank(results, this.questionBank.questions);
      this.matchingFeedback.feedbackResults.push({
        ...feedback,
        submissionId: submission.id,
        generatedAt: new Date().toISOString()
      });
      submission.status = 'completed';
      this.dataManager.saveFeedbackData({
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
        checkedOptionIds: checkedOptions.map(option => option.id),
        optionsData
      };
      this.savePresetMappings();
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

      // 确定新卡 ID
      let newCardId = null;
      const requestedId = cardData?.id;
      
      if (requestedId && this.isValidCardId(requestedId) && !usedIds.has(requestedId)) {
        newCardId = requestedId;
      } else {
        newCardId = this.generateCardId();
      }

      // 规范化会话结构
      const normalized = this.normalizeCardStructure({
        ...cardData,
        storageLevel: 'session',
        id: newCardId
      });

      // 放入会话列表
      this.sessionCards.push(normalized);

      // 环境配置：仅标准字段
      this.environmentConfigs.cards[newCardId] = {
        id: newCardId,
        name: normalized.data.title ?? null,
        dropdown: (normalized.data.selectOptions || []).map(opt => opt?.label ?? null)
      };

      // 将已有选项写入环境配置
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

      // 选中
      this.selectedCardId = newCardId;

      if (this.isRootMode) {
        this.recordRootTempOperation('add_card', { cardId: newCardId });
      }

      // 通知模式解析
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
      // 新增选项ID
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
      // 确保dataManager已正确初始化
      if (!this.dataManager || !this.dataManager.validator) {
        console.error('数据管理器未正确初始化');
        this.error = '数据存储失败：内部错误';
        return false;
      }
      
      const validation = this.dataManager.validator.validateConfig(this.sessionCards);
      if (validation.pass) {
        this.sessionStorageEnhancer.save(modeId, 'cards', validation.validCards);
        return true;
      }
      return false;
    },

    validateConfiguration() {
      return this.dataManager.validator.validateConfig(this.sessionCards);
    },

    loadAllMediumCards() {
      const storedData = localStorage.getItem('app_medium_cards');
      this.mediumCards = storedData ? JSON.parse(storedData) : [];
    },

    saveToMedium() {
      const currentMode = this.currentMode;
      if (!currentMode) return [];

      const validation = this.dataManager.validator.validateConfig(this.sessionCards);
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

        // 同步环境配置 dropdown
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
      return this.dataManager.exportData(this.currentModeId, fileName);
    },

    async importData(file) {
      try {
        const importedData = await this.dataManager.importFromFile(file);
        const safeData = importedData.map(card => this.normalizeCardStructure({
          ...card,
          modeId: this.currentModeId,
          storageLevel: 'session'
        }));

        this.sessionCards = [...this.sessionCards, ...safeData];
        this.saveSessionCards(this.currentModeId);

        // 同步到环境配置
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

    // 添加模式
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
      
      // 为新模式创建路由
      this.generateModePage(newMode);
      
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));
      return newMode;
    },

    // 删除模式
    deleteModes(modeIds) {
      const filteredIds = modeIds.filter(id => id !== 'root_admin');
      if (filteredIds.length === 0) return;

      // 先删除相关路由
      filteredIds.forEach(modeId => {
        this.deleteModePage(modeId);
      });

      this.modes = this.modes.filter(mode => !filteredIds.includes(mode.id));
      
      // 删除相关路由记录
      filteredIds.forEach(modeId => {
        if (this.modeRoutes[modeId]) {
          delete this.modeRoutes[modeId];
        }
      });
      
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));

      if (filteredIds.includes(this.currentModeId)) {
        this.setCurrentMode('root_admin');
      }
    },

    // 获取模式
    getMode(modeId) {
      if (modeId === 'root_admin') {
        return this.rootMode;
      }
      return this.modes.find(mode => mode.id === modeId) || null;
    },

    // 保存模式到存储
    saveModesToStorage() {
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));
      localStorage.setItem('root_mode_config', JSON.stringify({
        cardData: this.rootMode.cardData, 
        dataStandards: this.rootMode.dataStandards
      }));
    },

    // 联动同步（主接口）
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
      const validation = this.dataManager.validator.validateConfig(this.sessionCards);

      if (!validation.pass) {
        this.error = '源数据校验失败，无法同步';
        return null;
      }

      const sourceCards = validation.validCards
        .filter(card => cardIds.includes(card.id))
        .map(card => {
          return this.dataManager.prepareSyncCardData(card, {
            targetModeId,
            titleSync: syncFields.includes(this.FIELD_IDS.CARD_TITLE),
            titleAuth: authFields.includes(this.FIELD_IDS.CARD_TITLE),
            nameSync: syncFields.includes(this.FIELD_IDS.OPTION_NAME),
            nameAuth: authFields.includes(this.FIELD_IDS.OPTION_NAME),
            valueSync: syncFields.includes(this.FIELD_IDS.OPTION_VALUE),
            valueAuth: authFields.includes(this.FIELD_IDS.OPTION_VALUE),
            unitSync: syncFields.includes(this.FIELD_IDS.OPTION_UNIT),
            unitAuth: authFields.includes(this.FIELD_IDS.OPTION_UNIT),
            uiSync: syncFields.includes(this.FIELD_IDS.UI_CONFIG)
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
    },

    // ------------------------------
    // 数据段管理相关方法（来自DataSectionStore）
    // ------------------------------
    
    // 工具方法：判断是否为模式数据
    isModeData(item) {
      return item.isModeData || item.dataType === 'root' || item.dataType === 'other-mode';
    },

    // 生成数据项提示信息
    generateTooltip(item) {
      let tooltip = `ID: ${item.id}\n类型: ${item.typeText}\n模式: ${item.modeId}`;
      
      if (this.isRootMode && item.syncStatus) {
        tooltip += `\n同步状态: ${this.getSyncText(item.syncStatus)}`;
      }
      
      if (item.summary) {
        tooltip += `\n内容: ${item.summary}`;
      }
      
      return tooltip;
    },

    // 获取模式样式类名
    getModeClass(item) {
      if (item.dataType === 'root') return 'mode-root';
      if (item.dataType === 'other-mode') return 'mode-other';
      if (item.modeId === this.currentModeId) return 'mode-current';
      return '';
    },

    // 获取同步状态文本
    getSyncText(status) {
      if (!status) return '未同步';
      if (status.hasConflict) return '冲突';
      return status.hasSync ? '已同步' : '未同步';
    },

    // 获取同步状态样式
    getSyncClass(status) {
      if (!status) return 'sync-unsynced';
      if (status.hasConflict) return 'sync-conflict';
      return status.hasSync ? 'sync-synced' : 'sync-unsynced';
    },

    // 检查是否可以编辑数据项
    canEditItem(item) {
      const currentMode = this.currentMode;
      if (!currentMode || !currentMode.permissions) return false;
      
      if (item.dataType === 'question') {
        return currentMode.permissions.card?.editOptions || false;
      }
      if (item.dataType === 'config') {
        return currentMode.permissions.data?.save || false;
      }
      return false;
    },

    // 检查同步状态是否符合筛选条件
    checkSyncStatus(syncStatus, filter) {
      if (!syncStatus) return filter === 'unsynced';
      
      switch(filter) {
        case 'synced':
          return syncStatus.hasSync;
        case 'unsynced':
          return !syncStatus.hasSync;
        case 'conflict':
          return syncStatus.hasConflict;
        default:
          return true;
      }
    },

    // 更新选中数量
    updateSelected() {
      const count = this.filteredData.filter(item => item.selected && !this.isModeData(item)).length;
      this.dataSection.selectedCount = count;
      this.dataSection.selectAll = count > 0 && count === this.filteredData.filter(item => !this.isModeData(item)).length;
    },

    // 全选/取消全选
    handleSelectAll() {
      this.filteredData.forEach(item => {
        if (!this.isModeData(item)) item.selected = this.dataSection.selectAll;
      });
      this.updateSelected();
    },

    // 删除单个数据项
    async deleteItem(item) {
      if (this.isModeData(item)) return;
      
      if (confirm(`确定要删除 ${item.id || '该数据'} 吗？`)) {
        if (item.dataType === 'config') {
          const configs = await this.dataManager.loadEnvironmentConfigs();
          configs.contextTemplates = configs.contextTemplates
            .filter(template => template.questionId !== item.id);
          await this.dataManager.saveEnvironmentConfigs(configs);
          await this.loadEnvironmentConfigs(); // 重新加载配置
        } else if (item.dataType === 'question') {
          const bank = await this.dataManager.loadQuestionBank();
          bank.questions = bank.questions.filter(q => q.id !== item.id);
          await this.dataManager.saveQuestionBank(bank);
          await this.loadQuestionBank(); // 重新加载题库
        }
      }
    },

    // 删除选中的数据项
    async deleteSelected() {
      if (this.dataSection.selectedCount === 0 || this.hasModeDataSelected) return;
      
      if (confirm(`确定要删除选中的 ${this.dataSection.selectedCount} 条数据吗？`)) {
        // 加载当前数据
        const configs = await this.dataManager.loadEnvironmentConfigs();
        const bank = await this.dataManager.loadQuestionBank();
        
        // 处理删除
        this.filteredData.forEach(item => {
          if (item.selected && !this.isModeData(item)) {
            if (item.dataType === 'config') {
              configs.contextTemplates = configs.contextTemplates
                .filter(template => template.questionId !== item.id);
            } else if (item.dataType === 'question') {
              bank.questions = bank.questions.filter(q => q.id !== item.id);
            }
          }
        });
        
        // 保存更改
        await this.dataManager.saveEnvironmentConfigs(configs);
        await this.dataManager.saveQuestionBank(bank);
        
        // 重新加载数据
        await this.loadEnvironmentConfigs();
        await this.loadQuestionBank();
        
        this.dataSection.selectAll = false;
        this.dataSection.selectedCount = 0;
      }
    },

    // 从文件导入数据
    async importDataFromFile(file) {
      try {
        const importedData = await this.dataManager.importFromFile(file);
        let configs = [];
        let questions = [];
        
        if (importedData.questions) {
          questions = importedData.questions.map(q => this.normalizeQuestion(q));
        }
        
        if (importedData.contextTemplates) {
          configs = importedData.contextTemplates;
        }
        
        this.dataSection.previewData = {
          configs,
          questions,
          totalCount: configs.length + questions.length
        };
        this.dataSection.isPreview = true;
        
        return this.dataSection.previewData;
      } catch (err) {
        console.error('导入数据失败:', err);
        throw new Error(`导入失败: ${err.message}`);
      }
    },

    // 导出数据（复用原有方法，保持一致性）
    async exportDataSection() {
      return this.exportData(`data-section-export-${new Date().getTime()}.json`);
    },

    // 应用预览数据
    async applyPreview() {
      if (this.dataSection.previewData.totalCount === 0) return;
      
      // 加载当前数据
      const bank = await this.dataManager.loadQuestionBank();
      const configs = await this.dataManager.loadEnvironmentConfigs();
      
      if (this.dataSection.previewData.questions.length > 0) {
        // 添加新题目
        const normalizedQuestions = this.dataSection.previewData.questions.map(q => 
          this.dataManager.normalizeQuestion(q)
        );
        bank.questions = [...bank.questions, ...normalizedQuestions];
        await this.dataManager.saveQuestionBank(bank);
        await this.dataManager.saveQuestionBank(bank);
        await this.loadQuestionBank(); // 重新加载题库
      }
      
      if (this.dataSection.previewData.configs.length > 0) {
        // 添加或更新配置
        this.dataSection.previewData.configs.forEach(config => {
          const index = configs.contextTemplates
            .findIndex(t => t.questionId === config.questionId);
          
          if (index >= 0) {
            configs.contextTemplates[index] = config;
          } else {
            configs.contextTemplates.push(config);
          }
        });
        await this.dataManager.saveEnvironmentConfigs(configs);
        await this.loadEnvironmentConfigs(); // 重新加载配置
      }
      
      this.dataSection.previewData = { configs: [], questions: [], totalCount: 0 };
      this.dataSection.isPreview = false;
      alert(`已导入 ${this.dataSection.previewData.questions.length} 条题目和 ${this.dataSection.previewData.configs.length} 条环境配置`);
    },

    // 取消预览
    cancelPreview() {
      this.dataSection.previewData = { configs: [], questions: [], totalCount: 0 };
      this.dataSection.isPreview = false;
    },

    // 切换管理模式
    toggleManager() {
      this.dataSection.isManager = !this.dataSection.isManager;
      if (!this.dataSection.isManager) {
        this.filteredData.forEach(item => item.selected = false);
        this.dataSection.selectAll = false;
        this.dataSection.selectedCount = 0;
      }
    },

    // 清除筛选条件
    clearFilters() {
      this.dataSection.filterType = 'all';
      this.dataSection.syncFilter = 'all';
    },

    // 规范化题目数据
    normalizeQuestion(question) {
      return this.dataManager.normalizeQuestion(question);
    },

    // 设置当前模式（新增辅助方法，用于数据段管理）
    setCurrentMode(modeId) {
      this.currentModeId = modeId;
      this.loadSessionCards(modeId);
    }
  }
});
