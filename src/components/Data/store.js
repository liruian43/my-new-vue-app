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

export const useCardStore = defineStore('card', {
  state: () => ({
    // 存储数据
    tempCards: [], // 纯内存级
    sessionCards: [], // 会话级
    mediumCards: [], // 中期存储（localStorage）
    
    // 预设映射关系存储
    presetMappings: {}, // 结构: { [cardId]: { [selectOptionId]: {checkedOptionIds: [], optionsData: []} } }
    
    // 核心状态标识
    selectedCardId: null,
    deletingCardId: null,
    loading: false,
    error: null,
    viewMode: 'tree',
    storageType: localStorage.getItem('storageType') || 'local',
    
    // 模式管理
    modes: [],
    currentModeId: null,
    // 主模式（源数据区）
    rootMode: {
      id: 'root_admin',
      name: '根模式（源数据区）',
      level: 1,
      includeDataSection: true,
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
    }
  },
  
  actions: {
    // 初始化：加载会话数据
    initialize() {
      this.loading = true;
      this.error = null;
      
      try {
        // 1. 加载模式配置
        this.modes = JSON.parse(localStorage.getItem('app_modes')) || [];
        
        // 2. 加载当前模式的会话级数据
        if (this.currentModeId) {
          this.loadSessionCards(this.currentModeId);
        } else {
          // 默认进入主模式
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
      
      // 只保存勾选的选项及其完整信息（包括null值）
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
          // 只更新存在的值，保留其他属性
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
      // 确保卡片结构符合UniversalCard要求
      this.sessionCards = rawCards.map(card => this.normalizeCardStructure(card));
    },
    
    // 标准化卡片结构，确保包含所有必要字段
    normalizeCardStructure(card) {
      return {
        id: card.id || Date.now(),
        modeId: card.modeId || this.currentModeId,
        storageLevel: card.storageLevel || 'session',
        isTitleEditing: card.isTitleEditing ?? false,
        isOptionsEditing: card.isOptionsEditing ?? false,
        isSelectEditing: card.isSelectEditing ?? false,
        isPresetEditing: card.isPresetEditing ?? false,
        showDropdown: card.showDropdown ?? false,
        data: {
          title: card.data?.title ?? null,
          options: (card.data?.options || []).map(option => ({
            id: option.id || Date.now(),
            name: option.name ?? null,
            value: option.value ?? null,
            unit: option.unit ?? null,
            checked: option.checked ?? false
          })),
          // 关键修复：确保下拉选项的label始终是字符串（空字符串而非null）
          selectOptions: (card.data?.selectOptions || []).map(opt => ({
            id: opt.id || Date.now(),
            label: opt.label ?? ''  // 此处修改，解决toLowerCase报错
          })),
          selectedValue: card.data?.selectedValue ?? null  // 保持原有逻辑，不影响预设
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
    
    // 添加下拉选项时确保label是字符串
    addSelectOption(cardId, label) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        // 确保label是字符串（空字符串而非null）
        tempCard.data.selectOptions.push({ id: Date.now(), label: label ?? '' });
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        const card = this.sessionCards[sessionIndex];
        // 确保label是字符串（空字符串而非null）
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
    syncToMode(targetModeId, cardIds, authorize = false) {
      if (!targetModeId || targetModeId === 'root_admin') {
        this.error = '不能向主模式推送数据';
        return null;
      }
      
      if (!this.isRootMode) {
        this.error = '只有主模式可以推送数据';
        return null;
      }
      
      const validation = dataManager.validateConfig(this.sessionCards);
      if (!validation.pass) {
        this.error = '源数据校验失败，无法同步';
        return null;
      }
      
      const sourceCards = validation.validCards
        .filter(card => cardIds.includes(card.id))
        .map(card => this.normalizeCardStructure({
          ...card,
          sourceModeId: 'root_admin',
          syncStatus: 'synced',
          syncTime: new Date().toISOString(),
          authorized: authorize,
          authorizedBy: 'root_admin'
        }));
      
      const cardPresets = {};
      cardIds.forEach(id => {
        if (this.presetMappings[id]) {
          cardPresets[id] = this.presetMappings[id];
        }
      });
      
      if (sourceCards.length === 0) return null;
      
      const targetRawCards = sessionStorageEnhancer.load(targetModeId, 'cards') || [];
      const targetCards = [...targetRawCards.filter(card => !cardIds.includes(card.id)), ...sourceCards];
      
      sessionStorageEnhancer.save(targetModeId, 'cards', targetCards);
      
      if (this.currentModeId === targetModeId) {
        this.sessionCards = targetCards;
        
        Object.keys(cardPresets).forEach(cardId => {
          this.presetMappings[cardId] = cardPresets[cardId];
        });
        this.savePresetMappings();
      }
      
      return { targetModeId, syncedCount: sourceCards.length, authorized };
    },
    
    // 添加模式
    addMode(modeData) {
      const newMode = {
        id: `mode-${uuidv4()}`,
        ...modeData,
        level: 2,
        permissions: {
          card: { addCard: true, deleteCard: true, editTitle: true, editOptions: true },
          data: modeData.includeDataSection ? {
            view: true,
            save: true,
            export: false,
            import: true
          } : {},
          mode: {
            create: false,
            delete: false,
            assignPermissions: false,
            sync: false
          },
          authorize: { canAuthorize: false }
        },
        cardData: []
      };
      
      this.modes.push(newMode);
      localStorage.setItem('app_modes', JSON.stringify(this.modes));
      return newMode;
    },
    
    // 设置当前模式
    setCurrentMode(modeId) {
      if (this.currentModeId) {
        this.saveSessionCards(this.currentModeId);
      }
      
      this.currentModeId = modeId;
      this.loadSessionCards(modeId);
      
      this.tempCards = [];
      this.selectedCardId = null;
    },
    
    // 切换标题编辑状态
    toggleTitleEditing(cardId) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].isTitleEditing = !this.tempCards[tempIndex].isTitleEditing;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].isTitleEditing = !this.sessionCards[sessionIndex].isTitleEditing;
      }
    },
    
    // 切换选项编辑状态
    toggleOptionsEditing(cardId) {
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].isOptionsEditing = !this.tempCards[tempIndex].isOptionsEditing;
        return;
      }
      
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].isOptionsEditing = !this.sessionCards[sessionIndex].isOptionsEditing;
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
        const newOption = { id: Date.now(), name: null, value: null, unit: null, checked: false };
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
        const newOption = { id: Date.now(), name: null, value: null, unit: null, checked: false };
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
    },
    
    // 清除模式数据
    clearModeData(modeId) {
      sessionStorageEnhancer.clear(modeId, 'cards');
      if (this.currentModeId === modeId) {
        this.sessionCards = [];
      }
      
      this.mediumCards = this.mediumCards.filter(card => card.modeId !== modeId);
      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
      
      Object.keys(this.presetMappings).forEach(cardId => {
        const card = this.sessionCards.find(c => c.id === cardId) || 
                     this.mediumCards.find(c => c.id === cardId);
                     
        if (card && card.modeId === modeId) {
          delete this.presetMappings[cardId];
        }
      });
      this.savePresetMappings();
    }
  }
});