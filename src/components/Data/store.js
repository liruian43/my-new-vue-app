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
        
        // 4. 纯内存区初始化
        this.tempCards = [];
        
        // 5. 监听跨标签会话数据变化
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
          selectOptions: (card.data?.selectOptions || []).map(opt => ({
            id: opt.id || Date.now(),
            label: opt.label ?? null
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
    },
    
    // 保存会话级卡片（自动触发校验）
    async saveSessionCards(modeId) {
      const validation = await this.validateConfiguration();
      if (validation.pass) {
        sessionStorageEnhancer.save(modeId, 'cards', validation.validCards);
        return true;
      }
      return false;
    },
    
    // 调用manager进行配置校验
    validateConfiguration() {
      return dataManager.validateConfig(this.sessionCards);
    },
    
    // 加载所有模式的中期存储卡片
    loadAllMediumCards() {
      const storedData = localStorage.getItem('app_medium_cards');
      this.mediumCards = storedData ? JSON.parse(storedData) : [];
    },
    
    // 保存到中期存储
    saveToMedium() {
      const currentMode = this.currentMode;
      if (!currentMode) return [];
      
      // 先校验数据
      const validation = dataManager.validateConfig(this.sessionCards);
      if (!validation.pass) {
        this.error = '数据校验失败，无法保存到中期存储';
        console.error('中期存储校验失败:', validation.errors);
        return [];
      }
      
      // 准备中期存储数据
      const mediumData = validation.validCards.map(card => ({
        ...card,
        modeId: currentMode.id,
        storedAt: new Date().toISOString()
      }));
      
      // 合并并去重
      this.mediumCards = [
        ...this.mediumCards.filter(c => !(c.modeId === currentMode.id && mediumData.some(m => m.id === c.id))),
        ...mediumData
      ];
      
      // 保存到localStorage
      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
      return mediumData;
    },
    
    // 从中期存储移除卡片
    removeFromMedium(cardIds) {
      if (!cardIds || cardIds.length === 0) return;
      
      this.mediumCards = this.mediumCards.filter(card => !cardIds.includes(card.id));
      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
    },
    
    // 中期存储 → 会话级
    loadFromMedium(mediumCardIds) {
      const mediumCards = this.mediumCards.filter(card => 
        mediumCardIds.includes(card.id)
      );
      
      if (mediumCards.length === 0) return [];
      
      this.sessionCards = [...this.sessionCards, ...mediumCards];
      this.saveSessionCards(this.currentModeId);
      return mediumCards;
    },
    
    // 纯内存级：添加临时卡片
    addTempCard(initialData = {}) {
      const newCard = this.normalizeCardStructure({
        ...initialData,
        storageLevel: 'temp'
      });
      
      this.tempCards.push(newCard);
      this.selectedCardId = newCard.id;
      return newCard;
    },
    
    // 纯内存级：更新临时卡片
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
    
    // 纯内存 → 会话级
    promoteToSession(cardIds) {
      if (!cardIds || cardIds.length === 0) return [];
      
      const promotedCards = this.tempCards
        .filter(card => cardIds.includes(card.id))
        .map(card => this.normalizeCardStructure({
          ...card,
          storageLevel: 'session',
          addedToSessionAt: new Date().toISOString()
        }));
      
      // 合并到会话级（去重）
      this.sessionCards = [
        ...this.sessionCards.filter(card => !cardIds.includes(card.id)),
        ...promotedCards
      ];
      
      // 保存会话数据
      this.saveSessionCards(this.currentModeId);
      
      // 从纯内存移除
      this.tempCards = this.tempCards.filter(card => !cardIds.includes(card.id));
      return promotedCards;
    },
    
    // 会话级：添加卡片
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
    
    // 会话级：更新卡片
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
    
    // 会话级：更新卡片标题
    updateCardTitle(cardId, newTitle) {
      // 先尝试更新临时卡片
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].data.title = newTitle;
        return this.tempCards[tempIndex];
      }
      
      // 再尝试更新会话卡片
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].data.title = newTitle;
        return this.sessionCards[sessionIndex];
      }
      
      return null;
    },
    
    // 会话级：更新卡片选项
    updateCardOptions(cardId, updatedOptions) {
      // 先尝试更新临时卡片
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].data.options = updatedOptions;
        return this.tempCards[tempIndex];
      }
      
      // 再尝试更新会话卡片
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].data.options = updatedOptions;
        return this.sessionCards[sessionIndex];
      }
      
      return null;
    },
    
    // 会话级：更新下拉选择值
    updateCardSelectedValue(cardId, newValue) {
      // 先尝试更新临时卡片
      const tempIndex = this.tempCards.findIndex(c => c.id === cardId);
      if (tempIndex !== -1) {
        this.tempCards[tempIndex].data.selectedValue = newValue;
        return this.tempCards[tempIndex];
      }
      
      // 再尝试更新会话卡片
      const sessionIndex = this.sessionCards.findIndex(c => c.id === cardId);
      if (sessionIndex !== -1) {
        this.sessionCards[sessionIndex].data.selectedValue = newValue;
        return this.sessionCards[sessionIndex];
      }
      
      return null;
    },
    
    // 会话级：删除卡片
    deleteCard(cardId) {
      // 先从纯内存删除
      this.tempCards = this.tempCards.filter(card => card.id !== cardId);
      
      // 再从会话级删除
      this.sessionCards = this.sessionCards.filter(card => card.id !== cardId);
      this.saveSessionCards(this.currentModeId);
      
      // 最后从中期存储删除
      this.removeFromMedium([cardId]);
      
      if (this.selectedCardId === cardId) {
        this.selectedCardId = null;
      }
    },
    
    // 模式联动：主模式推送数据到非主模式
    syncToMode(targetModeId, cardIds, authorize = false) {
      if (!targetModeId || targetModeId === 'root_admin') {
        this.error = '不能向主模式推送数据';
        return null;
      }
      
      // 验证主模式权限
      if (!this.isRootMode) {
        this.error = '只有主模式可以推送数据';
        return null;
      }
      
      // 获取要推送的主模式数据（已校验）
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
      
      if (sourceCards.length === 0) return null;
      
      // 加载目标模式的会话数据并合并
      const targetRawCards = sessionStorageEnhancer.load(targetModeId, 'cards') || [];
      const targetCards = [...targetRawCards.filter(card => !cardIds.includes(card.id)), ...sourceCards];
      
      // 保存到目标模式的会话存储
      sessionStorageEnhancer.save(targetModeId, 'cards', targetCards);
      
      // 如果目标模式是当前活跃模式，实时更新
      if (this.currentModeId === targetModeId) {
        this.sessionCards = targetCards;
      }
      
      return { targetModeId, syncedCount: sourceCards.length, authorized };
    },
    
    // 模式管理：添加非主模式
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
    
    // 切换模式
    setCurrentMode(modeId) {
      // 保存当前模式的会话数据
      if (this.currentModeId) {
        this.saveSessionCards(this.currentModeId);
      }
      
      // 切换到新模式并加载其数据
      this.currentModeId = modeId;
      this.loadSessionCards(modeId);
      
      // 清空纯内存区和选中状态
      this.tempCards = [];
      this.selectedCardId = null;
    },
    
    // 卡片编辑操作：标题编辑状态切换
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
    
    // 选项编辑状态切换
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
    
    // 添加选项
    addOption(cardId, afterId) {
      const tempCard = this.tempCards.find(c => c.id === cardId);
      if (tempCard) {
        const newOption = { id: Date.now(), name: '', value: null, unit: '', checked: false };
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
        const newOption = { id: Date.now(), name: '', value: null, unit: '', checked: false };
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
      }
    },
    
    // 控制下拉框显示
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
    
    // 下拉编辑状态切换
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
    
    // 批量更新可编辑字段
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
    
    // 导入导出（委托给manager处理）
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
    
    // 清空模式数据
    clearModeData(modeId) {
      // 清空会话级
      sessionStorageEnhancer.clear(modeId, 'cards');
      if (this.currentModeId === modeId) {
        this.sessionCards = [];
      }
      
      // 清空中期存储
      this.mediumCards = this.mediumCards.filter(card => card.modeId !== modeId);
      localStorage.setItem('app_medium_cards', JSON.stringify(this.mediumCards));
    }
  }
});
    