import { defineStore } from 'pinia';
import DataManager, { LocalStorageStrategy } from './manager';
import { v4 as uuidv4 } from 'uuid';
import rootStore from './store/rootstore'; // 引入拆分出的rootStore

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
  SELECT_OPTIONS: 'selectOptions'
};

// 固定同步
export const FIXED_SYNC_FIELDS = [
  FIELD_IDS.OPTIONS,
  FIELD_IDS.SELECT_OPTIONS,
  FIELD_IDS.CARD_COUNT,
  FIELD_IDS.CARD_ORDER
];

// 可配置同步
export const CONFIGURABLE_SYNC_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT
];

// 可授权编辑
export const AUTHORIZABLE_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT
];

export const useCardStore = defineStore('card', {
  state: () => ({
    // 引入rootStore的状态
    ...rootStore.state,
    
    // 数据区
    tempCards: [],
    sessionCards: [],
    mediumCards: [],
    presetMappings: {},

    // 选择/删除
    selectedCardId: null,
    deletingCardId: null,

    // 全局状态
    loading: false,
    error: null,
    viewMode: 'tree',
    storageType: localStorage.getItem('storageType') || 'local',

    // 模式管理
    modes: [],
    currentModeId: 'root_admin',
    
    // 存储增强器
    sessionStorageEnhancer,
    FIELD_IDS,
    FIXED_SYNC_FIELDS,
    CONFIGURABLE_SYNC_FIELDS,
    AUTHORIZABLE_FIELDS
  }),

  getters: {
    // 引入rootStore的getters
    isRootMode() {
      return rootStore.getters.isRootMode(rootStore.state, this);
    },
    
    rootMediumData() {
      return rootStore.getters.rootMediumData(this);
    },

    selectedCard() {
      let card = this.tempCards.find(card => card.id === this.selectedCardId);
      if (!card) {
        card = this.sessionCards.find(card => card.id === this.selectedCardId);
      }
      return card;
    },

    selectedCardPresets() {
      return this.presetMappings[this.selectedCardId] || {};
    },

    currentMode() {
      if (this.currentModeId === 'root_admin') return this.rootMode;
      return this.modes.find(mode => mode.id === this.currentModeId) || null;
    },

    currentModeSessionCards() {
      return [...this.sessionCards];
    },

    currentModeMediumCards() {
      return this.mediumCards.filter(card => card.modeId === this.currentModeId);
    },

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
    // 初始化
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const storedModes = localStorage.getItem('app_user_modes');
        this.modes = storedModes ? JSON.parse(storedModes) : [];

        // 初始化root模式
        rootStore.actions.initRootMode(this.rootMode);

        if (this.currentModeId) {
          this.loadSessionCards(this.currentModeId);
        } else {
          this.currentModeId = 'root_admin';
          this.loadSessionCards('root_admin');
        }

        this.loadAllMediumCards();
        this.loadPresetMappings();
        this.tempCards = [];

        window.addEventListener('storage', (e) => {
          if (e.key?.startsWith(this.sessionStorageEnhancer.sessionId) &&
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

    // 预设映射读写
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

    savePresetMappings() {
      try {
        localStorage.setItem('card_preset_mappings', JSON.stringify(this.presetMappings));
        return true;
      } catch (e) {
        console.error('保存预设映射失败:', e);
        return false;
      }
    },

    // 保存“下拉项 ⇄ 勾选项及其名称/值/单位(null保留)”
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
        optionsData
      };
      
      return this.savePresetMappings();
    },

    // 应用预设到卡片（选择下拉项时）
    applyPresetToCard(cardId, selectOptionId) {
      const cardPresets = this.presetMappings[cardId];
      if (!cardPresets || !cardPresets[selectOptionId]) return false;

      const preset = cardPresets[selectOptionId];
      const card = this.sessionCards.find(c => c.id === cardId) ||
                   this.tempCards.find(c => c.id === cardId);
      if (!card) return false;

      // 清空勾选
      card.data.options = card.data.options.map(option => ({
        ...option,
        checked: false
      }));

      // 应用映射
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

    // 会话卡片加载与标准化
    loadSessionCards(modeId) {
      const rawCards = this.sessionStorageEnhancer.load(modeId, 'cards') || [];
      this.sessionCards = rawCards.map(card => this.normalizeCardStructure(card));
    },

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
        
        // 同步授权状态
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

    // 下拉项增删
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

        // 同步清理该下拉项的预设映射
        if (this.presetMappings[cardId] && this.presetMappings[cardId][optionId]) {
          delete this.presetMappings[cardId][optionId];
          this.savePresetMappings();
        }

        // 如果删除的正是当前选中的下拉项，也一并清空选中
        const stillExists = card.data.selectOptions.some(o => o.label === card.data.selectedValue);
        if (!stillExists) {
          card.data.selectedValue = null;
        }
      }
    },

    // 卡片增删改存
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

    // 中期存储
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

    // 临时卡片
    addTempCard(initialData = {}) {
      const newCard = this.normalizeCardStructure({
        ...initialData,
        storageLevel: 'temp'
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
      
      this.saveSessionCards(this.currentModeId);
      this.tempCards = this.tempCards.filter(card => !cardIds.includes(card.id));
      return promotedCards;
    },

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

    // 字段更新
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

    // 选项行增删
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

    // UI 状态：下拉是否展示
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

    // UI 状态：按钮编辑开关（预设期间无效，确保“预设优先权”）
    toggleSelectEditing(cardId) {
      const temp = this.tempCards.find(c => c.id === cardId);
      if (temp) {
        if (temp.isPresetEditing) return; // 预设期间禁用
        temp.isSelectEditing = !temp.isSelectEditing;
        return;
      }
      const card = this.sessionCards.find(c => c.id === cardId);
      if (card) {
        if (card.isPresetEditing) return; // 预设期间禁用
        card.isSelectEditing = !card.isSelectEditing;
      }
    },

    // root_admin 放开权限
    toggleTitleEditing(cardId) {
      // 调用rootStore中的方法
      return rootStore.actions.toggleTitleEditingForRoot(rootStore.state, this, cardId);
    },

    // root_admin 放开权限（预设期间无效）
    toggleOptionsEditing(cardId) {
      const temp = this.tempCards.find(c => c.id === cardId);
      if (temp) {
        if (temp.isPresetEditing) return; // 预设期间禁用
        temp.isOptionsEditing = !temp.isOptionsEditing;
        return;
      }
      
      const card = this.sessionCards.find(c => c.id === cardId);
      if (card) {
        if (card.isPresetEditing) return; // 预设期间禁用
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

    // 编辑预设：进入时仅开启“下拉可编辑 + 复选框”，其它全部关；退出时保存一次并清空勾选
    togglePresetEditing(cardId) {
      const apply = (card) => {
        const entering = !card.isPresetEditing;

        if (entering) {
          // 进入预设：只启用两种能力
          card.isPresetEditing = true;

          // 1) 下拉可编辑
          card.isSelectEditing = true;

          // 2) 显示复选框
          card.editableFields.optionCheckbox = true;

          // 其它编辑能力全部关闭（避免混淆）
          // 标题编辑不强制关闭（允许在预设期间使用）
          card.isOptionsEditing = false; // 不开启“选项编辑”
          card.editableFields.optionName = false;
          card.editableFields.optionValue = false;
          card.editableFields.optionUnit = false;
          card.editableFields.optionActions = false; // 隐藏 +/-

          // 不控制下拉展开/收起
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

    // 细分字段可编辑显隐（预设期间无效）
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

    // 导出/导入
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
        return { success: true, count: safeData.length };
      } catch (err) {
        this.error = `导入失败：${err.message}`;
        return { success: false, error: this.error };
      }
    },

    // 模式相关
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

    // 调用rootStore中的同步方法
    syncToMode(targetModeId, cardIds, syncConfig) {
      return rootStore.actions.syncToMode(rootStore.state, this, this, targetModeId, cardIds, syncConfig);
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
      } else if (optIndex !== undefined) {
        if (fieldType === 'name') {
          if (!card.syncStatus.options.name.isAuthorized) return false;
          card.data.options[optIndex].name = value;
        } else if (fieldType === 'value') {
          if (!card.syncStatus.options.value.isAuthorized) return false;
          card.data.options[optIndex].value = value;
        } else if (fieldType === 'unit') {
          if (!card.syncStatus.options.unit.isAuthorized) return false;
          card.data.options[optIndex].unit = value;
        }
      }

      this.saveSessionCards(modeId);
      return true;
    }
  }
});
    