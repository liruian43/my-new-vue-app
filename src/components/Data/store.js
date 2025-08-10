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

// 定义8项内容的字段标识
export const FIELD_IDS = {
  CARD_COUNT: 'cardCount',       // 1.卡片数量（通过数组长度体现）
  CARD_ORDER: 'cardOrder',       // 3.卡片顺序（通过数组索引体现）
  CARD_TITLE: 'title',           // 4.卡片标题
  OPTIONS: 'options',            // 2.选项数据（数组）
  OPTION_NAME: 'optionName',     // 5.选项名称（options子项）
  OPTION_VALUE: 'optionValue',   // 6.选项值（options子项）
  OPTION_UNIT: 'optionUnit',     // 7.选项单位（options子项）
  SELECT_OPTIONS: 'selectOptions'// 8.下拉菜单
};

// 固定同步的字段（无需用户选择，点击联动即同步）
export const FIXED_SYNC_FIELDS = [
  FIELD_IDS.OPTIONS,
  FIELD_IDS.SELECT_OPTIONS,
  FIELD_IDS.CARD_COUNT,
  FIELD_IDS.CARD_ORDER
];

// 可配置同步的字段（用户选择是否同步展示内容）
export const CONFIGURABLE_SYNC_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT
];

// 可授权编辑的字段（用户选择是否允许目标模式编辑）
export const AUTHORIZABLE_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT
];

export const useCardStore = defineStore('card', {
  state: () => ({
    // 存储数据
    tempCards: [],       // 纯内存级
    sessionCards: [],    // 会话级
    mediumCards: [],     // 中期存储（localStorage）

    // 预设映射关系存储
    presetMappings: {}, 

    // 核心状态标识
    selectedCardId: null,
    deletingCardId: null,
    loading: false,
    error: null,
    viewMode: 'tree',
    storageType: localStorage.getItem('storageType') || 'local',

    // 模式管理（用户创建的模式）
    modes: [],
    currentModeId: 'root_admin', // 默认在主模式
    
    // 主模式（源数据区 - 固定不可删除）
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
      cardData: []
    }
  }),

  getters: {
    // 当前选中的卡片
    selectedCard() {
      let card = this.tempCards.find(card => card.id === this.selectedCardId);
      if (!card) {
        card = this.sessionCards.find(card => card.id === this.selectedCardId);
      }
      return card;
    },

    // 当前选中卡片的预设配置
    selectedCardPresets() {
      return this.presetMappings[this.selectedCardId] || {};
    },

    // 当前激活的模式
    currentMode() {
      if (this.currentModeId === 'root_admin') return this.rootMode;
      return this.modes.find(mode => mode.id === this.currentModeId) || null;
    },

    // 当前模式的会话级卡片
    currentModeSessionCards() {
      return [...this.sessionCards];
    },

    // 当前模式的中期存储卡片
    currentModeMediumCards() {
      return this.mediumCards.filter(card => card.modeId === this.currentModeId);
    },

    // 主模式中期存储数据
    rootMediumData() {
      return this.mediumCards.filter(card => card.modeId === 'root_admin');
    },

    // 是否为主模式
    isRootMode() {
      return this.currentModeId === 'root_admin';
    },

    // 选中卡片的可编辑字段配置
    selectedCardEditableFields() {
      return this.selectedCard?.editableFields || {
        optionName: true,
        optionValue: true,
        optionUnit: true,
        optionCheckbox: true,
        optionActions: true,
        select: true
      };
    },

    // 获取卡片的同步状态
    getCardSyncStatus() {
      return (cardId) => {
        const mode = this.currentMode;
        if (!mode || !mode.syncStatus) return null;
        
        return mode.syncStatus[cardId] || {
          hasSync: false,
          isAuthorized: false
        };
      };
    }
  },

  actions: {
    // 初始化：加载数据
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        // 1. 加载用户创建的模式（主模式不存储在localStorage）
        const storedModes = localStorage.getItem('app_user_modes');
        this.modes = storedModes ? JSON.parse(storedModes) : [];
        
        // 2. 加载当前模式的会话级数据
        if (this.currentModeId) {
          this.loadSessionCards(this.currentModeId);
        } else {
          this.currentModeId = 'root_admin';
          this.loadSessionCards('root_admin');
        }
        
        // 3. 加载中期存储数据
        this.loadAllMediumCards();
        
        // 4. 加载预设映射
        this.loadPresetMappings();
        
        // 5. 纯内存区初始化
        this.tempCards = [];
        
        // 6. 监听跨标签会话数据变化
        window.addEventListener('storage', (e) => {
          if (e.key.startsWith(sessionStorageEnhancer.sessionId) && 
              e.key.includes(this.currentModeId)) {
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

    // 加载预设映射
    loadPresetMappings() {
      const stored = localStorage.getItem('card_preset_mappings');
      if (stored) {
        try {
          this.presetMappings = JSON.parse(stored);
        } catch (e) {
          console.error('加载预设映射失败:', e);
          this.presetMappings = {};
        }
      }
    },

    // 保存预设映射
    savePresetMappings() {
      try {
        localStorage.setItem('card_preset_mappings', JSON.stringify(this.presetMappings));
        return true;
      } catch (e) {
        console.error('保存预设映射失败:', e);
        return false;
      }
    },

    // 为卡片的下拉选项保存预设配置
    savePresetForSelectOption(cardId, selectOptionId, checkedOptions) {
      if (!this.presetMappings[cardId]) {
        this.presetMappings[cardId] = {};
      }
      
      const optionsData = checkedOptions.map(option => ({
        id: option.id,
        name: option.name ?? null,
        value: option.value ?? null,
        unit: option.unit ?? null,
        checked: true
      }));
      
      this.presetMappings[cardId][selectOptionId] = {
        checkedOptionIds: checkedOptions.map(option => option.id),
        optionsData: optionsData
      };
      
      return this.savePresetMappings();
    },

    // 应用预设配置到卡片
    applyPresetToCard(cardId, selectOptionId) {
      const cardPresets = this.presetMappings[cardId];
      if (!cardPresets || !cardPresets[selectOptionId]) {
        return false;
      }
      
      const preset = cardPresets[selectOptionId];
      const card = this.sessionCards.find(c => c.id === cardId) || 
                   this.tempCards.find(c => c.id === cardId);
      
      if (!card) return false;
      
      // 重置所有选项的勾选状态
      card.data.options = card.data.options.map(option => ({
        ...option,
        checked: false
      }));
      
      // 应用预设的勾选状态和值
      preset.optionsData.forEach(presetOption => {
        const targetOption = card.data.options.find(o => o.id === presetOption.id);
        if (targetOption) {
          targetOption.checked = true;
          if (presetOption.name !== undefined) targetOption.name = presetOption.name;
          if (presetOption.value !== undefined) targetOption.value = presetOption.value;
          if (presetOption.unit !== undefined) targetOption.unit = presetOption.unit;
        }
      });
      
      return true;
    },

    // 加载指定模式的会话级卡片
    loadSessionCards(modeId) {
      const rawCards = sessionStorageEnhancer.load(modeId, 'cards') || [];
      this.sessionCards = rawCards.map(card => this.normalizeCardStructure(card));
    },

    // 标准化卡片结构
    normalizeCardStructure(card) {
      const baseCard = {
        id: card.id || Date.now(),
        modeId: card.modeId || this.currentModeId,
        storageLevel: card.storageLevel || 'session',
        isTitleEditing: card.isTitleEditing ?? false,
        isOptionsEditing: card.isOptionsEditing ?? false,
        isSelectEditing: card.isSelectEditing ?? false,
        isPresetEditing: card.isPresetEditing ?? false,
        showDropdown: card.showDropdown ?? false,
        
        // 同步和授权状态标记
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
            hasSync: card.syncStatus?.selectOptions?.hasSync ?? true, // 固定同步
            isAuthorized: card.syncStatus?.selectOptions?.isAuthorized ?? false
          }
        },
        
        data: {
          title: card.data?.title ?? null,
          options: (card.data?.options || []).map(option => ({
            id: option.id || Date.now(),
            name: option.name ?? null,
            value: option.value ?? null,
            unit: option.unit ?? null,
            checked: option.checked ?? false,
            localName: option.localName ?? null,
            localValue: option.localValue ?? null,
            localUnit: option.localUnit ?? null
          })),
          selectOptions: (card.data?.selectOptions || []).map(opt => ({
            id: opt.id || Date.now(),
            label: opt.label ?? ''
          })),
          selectedValue: card.data?.selectedValue ?? null
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
      
      return baseCard;
    },

    // 添加下拉选项
    addSelectOption(cardId, label) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        tempCard.data.selectOptions.push({ id: Date.now(), label: label ?? '' });
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        card.data.selectOptions.push({ id: Date.now(), label: label ?? '' });
      }
    },

    // 添加卡片
    addCard(cardData) {
      const newCard = this.normalizeCardStructure({
        ...cardData,
        storageLevel: 'session',
        id: Date.now()
      });
      
      this.sessionCards.push(newCard);
      this.selectedCardId = newCard.id;
      return newCard;
    },

    // 保存会话卡片
    saveSessionCards(modeId) {
      const validation = dataManager.validateConfig(this.sessionCards);
      if (validation.pass) {
        sessionStorageEnhancer.save(modeId, 'cards', validation.validCards);
        return true;
      }
      return false;
    },

    // 验证配置
    validateConfiguration() {
      return dataManager.validateConfig(this.sessionCards);
    },

    // 加载所有中期存储卡片
    loadAllMediumCards() {
      const storedData = localStorage.getItem('app_medium_cards');
      this.mediumCards = storedData ? JSON.parse(storedData) : [];
    },

    // 保存到中期存储
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

    // 从中期存储移除
    removeFromMedium(cardIds) {
      if (!cardIds || cardIds.length === 0) return;
      
      this.mediumCards = this.mediumCards.filter(card => !cardIds.includes(card.id));
      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
    },

    // 从中期存储加载
    loadFromMedium(mediumCardIds) {
      const mediumCards = this.mediumCards.filter(card => 
        mediumCardIds.includes(card.id)
      );
      
      if (mediumCards.length === 0) return [];
      
      this.sessionCards = [...this.sessionCards, ...mediumCards];
      this.saveSessionCards(this.currentModeId);
      return mediumCards;
    },

    // 添加临时卡片
    addTempCard(initialData = {}) {
      const newCard = this.normalizeCardStructure({
        ...initialData,
        storageLevel: 'temp'
      });
      
      this.tempCards.push(newCard);
      this.selectedCardId = newCard.id;
      return newCard;
    },

    // 更新临时卡片
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

    // 提升到会话级
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
      
      this.saveSessionCards(this.currentModeId);
      
      this.tempCards = this.tempCards.filter(card => !cardIds.includes(card.id));
      return promotedCards;
    },

    // 更新会话卡片
    updateSessionCard(updatedCard) {
      const index = this.sessionCards.findIndex(card => card.id === updatedCard.id);
      if (index !== -1) {
        this.sessionCards[index] = this.normalizeCardStructure({
          ...this.sessionCards[index],
          ...updatedCard,
          updatedAt: new Date().toISOString()
        });
        return this.sessionCards[index];
      }
      return null;
    },

    // 更新卡片标题
    updateCardTitle(cardId, newTitle) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].data.title = newTitle;
        return this.tempCards[tempIndex];
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].data.title = newTitle;
        return this.sessionCards[sessionIndex];
      }
      
      return null;
    },

    // 更新卡片选项
    updateCardOptions(cardId, updatedOptions) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].data.options = updatedOptions;
        return this.tempCards[tempIndex];
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].data.options = updatedOptions;
        return this.sessionCards[sessionIndex];
      }
      
      return null;
    },

    // 更新卡片选中值
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
        
        return this.sessionCards[sessionIndex];
      }
      
      return null;
    },

    // 删除卡片
    deleteCard(cardId) {
      this.tempCards = this.tempCards.filter(card => card.id !== cardId);
      this.sessionCards = this.sessionCards.filter(card => card.id !== cardId);
      this.saveSessionCards(this.currentModeId);
      this.removeFromMedium([cardId]);
      
      if (this.presetMappings[cardId]) {
        delete this.presetMappings[cardId];
        this.savePresetMappings();
      }
      
      if (this.selectedCardId === cardId) {
        this.selectedCardId = null;
      }
    },

    // 同步到模式
    syncToMode(targetModeId, cardIds, syncConfig) {
      if (!targetModeId || targetModeId === 'root_admin') {
        this.error = '不能向主模式推送数据';
        return null;
      }
      
      if (!this.isRootMode) {
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
          const titleSync = syncFields.includes(FIELD_IDS.CARD_TITLE);
          const titleAuth = authFields.includes(FIELD_IDS.CARD_TITLE);
          
          const nameSync = syncFields.includes(FIELD_IDS.OPTION_NAME);
          const nameAuth = authFields.includes(FIELD_IDS.OPTION_NAME);
          
          const valueSync = syncFields.includes(FIELD_IDS.OPTION_VALUE);
          const valueAuth = authFields.includes(FIELD_IDS.OPTION_VALUE);
          
          const unitSync = syncFields.includes(FIELD_IDS.OPTION_UNIT);
          const unitAuth = authFields.includes(FIELD_IDS.OPTION_UNIT);
          
          return this.normalizeCardStructure({
            ...card,
            modeId: targetModeId,
            sourceModeId: 'root_admin',
            syncStatus: {
              title: {
                hasSync: titleSync,
                isAuthorized: titleAuth
              },
              options: {
                name: {
                  hasSync: nameSync,
                  isAuthorized: nameAuth
                },
                value: {
                  hasSync: valueSync,
                  isAuthorized: valueAuth
                },
                unit: {
                  hasSync: unitSync,
                  isAuthorized: unitAuth
                }
              },
              selectOptions: {
                hasSync: true,  // 固定同步
                isAuthorized: false  // 固定不可编辑
              }
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
              }))
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
      
      const targetRawCards = sessionStorageEnhancer.load(targetModeId, 'cards') || [];
      const targetCards = [
        ...targetRawCards.filter(card => !cardIds.includes(card.id)),
        ...sourceCards
      ];
      
      sessionStorageEnhancer.save(targetModeId, 'cards', targetCards);
      
      if (this.currentModeId === targetModeId) {
        this.sessionCards = targetCards;
        Object.keys(cardPresets).forEach(cardId => {
          this.presetMappings[cardId] = cardPresets[cardId];
        });
        this.savePresetMappings();
      }
      
      this.updateModeSyncInfo(targetModeId, {
        lastSyncTime: new Date().toISOString(),
        syncFields,
        authFields,
        syncedCardIds: cardIds
      });
      
      return { targetModeId, syncedCount: sourceCards.length, syncFields, authFields };
    },

    // 更新模式的同步信息
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

    // 更新目标模式的卡片本地值
    updateModeCardLocalValue(modeId, cardId, fieldType, optIndex, value) {
      if (modeId !== this.currentModeId) return false;
      
      const cardIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return false;
      
      const card = this.sessionCards[cardIndex];
      
      if (fieldType === 'title') {
        if (!card.syncStatus.title.isAuthorized) return false;
        card.data.title = value;
      } 
      else if (optIndex !== undefined) {
        if (fieldType === 'name') {
          if (!card.syncStatus.options.name.isAuthorized) return false;
          card.data.options[optIndex].name = value;
        }
        else if (fieldType === 'value') {
          if (!card.syncStatus.options.value.isAuthorized) return false;
          card.data.options[optIndex].value = value;
        }
        else if (fieldType === 'unit') {
          if (!card.syncStatus.options.unit.isAuthorized) return false;
          card.data.options[optIndex].unit = value;
        }
      }
      
      this.saveSessionCards(modeId);
      return true;
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
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));
      return newMode;
    },

    // 删除模式
    deleteModes(modeIds) {
      const filteredIds = modeIds.filter(id => id !== 'root_admin');
      if (filteredIds.length === 0) return;
      
      this.modes = this.modes.filter(mode => !filteredIds.includes(mode.id));
      localStorage.setItem('app_user_modes', JSON.stringify(this.modes));
      
      if (filteredIds.includes(this.currentModeId)) {
        this.setCurrentMode('root_admin');
      }
    },

    // 设置当前模式
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

    // 切换标题编辑状态（修改点：root_admin 放开权限）
    toggleTitleEditing(cardId) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].isTitleEditing = !this.tempCards[tempIndex].isTitleEditing;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        // 修改点：root_admin 直接允许；其他模式仍按授权
        if (this.currentModeId === 'root_admin' || card.syncStatus.title.isAuthorized) {
          card.isTitleEditing = !card.isTitleEditing;
        }
      }
    },

    // 切换选项编辑状态（修改点：root_admin 放开权限）
    toggleOptionsEditing(cardId) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].isOptionsEditing = !this.tempCards[tempIndex].isOptionsEditing;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        // 修改点：root_admin 直接允许；其他模式按授权检查
        let canEdit = false;
        if (this.currentModeId === 'root_admin') {
          canEdit = true;
        } else {
          canEdit =
            card.syncStatus.options.name.isAuthorized || 
            card.syncStatus.options.value.isAuthorized ||
            card.syncStatus.options.unit.isAuthorized;
        }
        
        if (canEdit) {
          card.isOptionsEditing = !card.isOptionsEditing;
        }
      }
    },

    // 切换预设编辑状态
    togglePresetEditing(cardId) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].isPresetEditing = !this.tempCards[tempIndex].isPresetEditing;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        card.isPresetEditing = !card.isPresetEditing;
        
        if (card.isPresetEditing) {
          card.isOptionsEditing = true;
          card.isSelectEditing = true;
          card.editableFields.optionCheckbox = true;
        }
      }
    },

    // 添加选项
    addOption(cardId, afterId) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        const newOption = { 
          id: Date.now(), 
          name: null, 
          value: null, 
          unit: null, 
          checked: false,
          localName: null,
          localValue: null,
          localUnit: null
        };
        const options = [...tempCard.data.options];
        
        if (afterId) {
          const index = options.findIndex(o => o.id === afterId);
          if (index !== -1) options.splice(index + 1, 0, newOption);
          else options.push(newOption);
        } else {
          options.push(newOption);
        }
        
        tempCard.data.options = options;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const newOption = { 
          id: Date.now(), 
          name: null, 
          value: null, 
          unit: null, 
          checked: false,
          localName: null,
          localValue: null,
          localUnit: null
        };
        const card = this.sessionCards[sessionIndex];
        const options = [...card.data.options];
        
        if (afterId) {
          const index = options.findIndex(o => o.id === afterId);
          if (index !== -1) options.splice(index + 1, 0, newOption);
          else options.push(newOption);
        } else {
          options.push(newOption);
        }
        
        card.data.options = options;
      }
    },

    // 删除选项
    deleteOption(cardId, optionId) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        tempCard.data.options = tempCard.data.options.filter(o => o.id !== optionId);
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        card.data.options = card.data.options.filter(o => o.id !== optionId);
      }
    },

    // 删除下拉选项
    deleteSelectOption(cardId, optionId) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        tempCard.data.selectOptions = tempCard.data.selectOptions.filter(o => o.id !== optionId);
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        card.data.selectOptions = card.data.selectOptions.filter(o => o.id !== optionId);
        
        if (this.presetMappings[cardId] && this.presetMappings[cardId][optionId]) {
          delete this.presetMappings[cardId][optionId];
          this.savePresetMappings();
        }
      }
    },

    // 设置下拉显示状态
    setShowDropdown(cardId, value) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        tempCard.showDropdown = value;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].showDropdown = value;
      }
    },

    // 切换下拉编辑状态
    toggleSelectEditing(cardId) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].isSelectEditing = !this.tempCards[tempIndex].isSelectEditing;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].isSelectEditing = !this.sessionCards[sessionIndex].isSelectEditing;
      }
    },

    // 切换可编辑字段
    toggleEditableField(cardId, field) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].editableFields[field] = !this.tempCards[tempIndex].editableFields[field];
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].editableFields[field] = !this.sessionCards[sessionIndex].editableFields[field];
      }
    },

    // 更新可编辑字段配置
    updateEditableFields(cardId, fieldsConfig) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].editableFields = {
          ...this.tempCards[tempIndex].editableFields,
          ...fieldsConfig
        };
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].editableFields = {
          ...this.sessionCards[sessionIndex].editableFields,
          ...fieldsConfig
        };
      }
    },

    // 导出数据
    exportData(fileName = 'card_data.json') {
      return dataManager.exportData(this.currentModeId, fileName);
    },

    // 导入数据
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
        return { success: true, count: safeData.length };
      } catch (err) {
        this.error = `导入失败：${err.message}`;
        return { success: false, error: this.error };
      }
    }
  }
});
    