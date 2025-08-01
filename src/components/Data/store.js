import { defineStore } from 'pinia';
import DataManager, { 
  LocalStorageStrategy, 
  SessionStorageStrategy, 
  MemoryStorageStrategy 
} from './manager';
import { v4 as uuidv4 } from 'uuid';

// 创建数据管理器实例
let storageStrategy;
switch (localStorage.getItem('storageType') || 'local') {
  case 'local':
    storageStrategy = new LocalStorageStrategy();
    break;
  case 'session':
    storageStrategy = new SessionStorageStrategy();
    break;
  case 'memory':
    storageStrategy = new MemoryStorageStrategy();
    break;
}

const dataManager = new DataManager(storageStrategy);

export const useCardStore = defineStore('card', {
  state: () => ({
    // 原有状态
    cards: [],
    selectedCardId: null,
    deletingCardId: null,
    storageType: localStorage.getItem('storageType') || 'local',
    loading: false,
    error: null,
    viewMode: 'tree',
    
    // 新增：模式管理相关状态
    modes: [], // 模式列表
    currentModeId: null, // 当前激活的模式ID
    // 根模式(全权限)，不显示在模式列表中
    rootMode: {
      id: 'root_admin', // 主ID修改为root_admin
      name: '根模式',
      level: 1,
      includeDataSection: true,
      permissions: {
        card: {
          addCard: true,
          deleteCard: true,
          editTitle: true,
          editOptions: true
        },
        data: {
          view: true,
          save: true,
          export: true,
          import: true
        },
        mode: {
          create: true,
          delete: true,
          assignPermissions: true
        }
      },
      cardData: []
    }
  }),
  
  getters: {
    // 原有getters
    selectedCard(state) {
      return state.cards.find(card => card.id === state.selectedCardId);
    },
    
    dataPreview(state) {
      return state.cards;
    },
    
    // 新增：模式相关getters
    currentMode(state) {
      if (!state.currentModeId) {
        return state.modes.length > 0 ? state.modes[0] : null;
      }
      return state.modes.find(mode => mode.id === state.currentModeId) || null;
    },
    
    // 获取当前激活模式的卡片数据
    currentModeCards(state) {
      const currentMode = this.currentMode;
      if (!currentMode) return [];
      return currentMode.cardData || [];
    }
  },
  
  actions: {
    // 原有actions
    initialize() {
      this.loading = true;
      this.error = null;
      
      try {
        // 从本地存储加载卡片和模式数据
        this.loadCardsFromLocal();
        this.loadModesFromLocal();
      } catch (localError) {
        console.error('从本地加载失败:', localError);
        this.error = '无法加载数据';
      } finally {
        this.loading = false;
      }
    },
    
    // 从本地存储获取卡片
    loadCardsFromLocal() {
      const cards = dataManager.load('cards') || [];
      this.cards = cards;
    },
    
    // 保存卡片到本地存储
    saveCardsToLocal() {
      dataManager.save('cards', this.cards);
    },
    
    // 添加新卡片
    addCard(cardData) {
      const newCard = {
        id: Date.now(),
        ...cardData,
        showDropdown: false,
        isTitleEditing: false,
        isOptionsEditing: false,
        isSelectEditing: false,
        editableFields: {
          optionName: true,
          optionValue: true,
          optionUnit: true,
          optionCheckbox: true,
          optionActions: true,
          select: true
        }
      };
      
      this.cards.push(newCard);
      this.selectedCardId = newCard.id;
      this.saveCardsToLocal();
      
      // 如果有当前激活模式，同步到模式的cardData
      if (this.currentMode) {
        this.currentMode.cardData = [...this.currentMode.cardData, newCard];
        this.saveModesToLocal();
      }
    },
    
    // 删除卡片
    deleteCard(id) {
      this.cards = this.cards.filter(card => card.id !== id);
      
      // 同步删除当前模式中的卡片
      if (this.currentMode && this.currentMode.cardData) {
        this.currentMode.cardData = this.currentMode.cardData.filter(card => card.id !== id);
        this.saveModesToLocal();
      }
      
      this.selectedCardId = null;
      this.deletingCardId = null;
      this.saveCardsToLocal();
    },
    
    // 更新卡片
    updateCard(updatedCard) {
      const index = this.cards.findIndex(card => card.id === updatedCard.id);
      if (index !== -1) {
        this.cards[index] = updatedCard;
        this.saveCardsToLocal();
      }
      
      // 同步更新当前模式中的卡片
      if (this.currentMode && this.currentMode.cardData) {
        const modeIndex = this.currentMode.cardData.findIndex(card => card.id === updatedCard.id);
        if (modeIndex !== -1) {
          this.currentMode.cardData[modeIndex] = updatedCard;
          this.saveModesToLocal();
        }
      }
    },
    
    // 切换存储类型
    changeStorageType(type) {
      let newStrategy;
      
      switch (type) {
        case 'local':
          newStrategy = new LocalStorageStrategy();
          break;
        case 'session':
          newStrategy = new SessionStorageStrategy();
          break;
        case 'memory':
          newStrategy = new MemoryStorageStrategy();
          break;
        default:
          throw new Error('不支持的存储类型');
      }
      
      // 更新存储策略
      dataManager.storage = newStrategy;
      this.storageType = type;
      localStorage.setItem('storageType', type);
      
      // 重新保存数据到新存储
      this.saveCardsToLocal();
      this.saveModesToLocal(); // 新增：保存模式数据
    },
    
    // 导出数据
    exportData(fileName = 'card_data.json') {
      dataManager.exportToFile(this.cards, fileName);
    },
    
    // 导入数据
    async importData(file) {
      const importedData = await dataManager.importFromFile(file);
      this.cards = importedData;
      this.saveCardsToLocal();
    },
    
    // 清空所有数据
    clearAllData() {
      this.cards = [];
      dataManager.delete('cards');
      this.selectedCardId = null;
      this.deletingCardId = null;
    },
    
    // 切换标题编辑状态
    toggleTitleEditing(cardId) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].isTitleEditing = !this.cards[cardIndex].isTitleEditing;
        this.saveCardsToLocal();
      }
    },
    
    // 切换选项编辑状态
    toggleOptionsEditing(cardId) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].isOptionsEditing = !this.cards[cardIndex].isOptionsEditing;
        this.saveCardsToLocal();
      }
    },
    
    // 切换下拉菜单编辑状态
    toggleSelectEditing(cardId) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].isSelectEditing = !this.cards[cardIndex].isSelectEditing;
        this.saveCardsToLocal();
      }
    },
    
    // 切换可编辑字段
    toggleEditableField(cardId, field) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].editableFields[field] = !this.cards[cardIndex].editableFields[field];
        this.saveCardsToLocal();
      }
    },
    
    // 添加选项
    addOption(cardId, afterId) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const newId = Date.now();
      const newOption = {
        id: newId,
        name: "新选项",
        value: "",
        unit: "",
        checked: false,
      };

      const card = this.cards[cardIndex];
      const options = [...card.data.options];

      if (!afterId) {
        options.push(newOption);
      } else {
        const index = options.findIndex((o) => o.id === afterId);
        if (index !== -1) {
          options.splice(index + 1, 0, newOption);
        }
      }

      card.data.options = options;
      this.saveCardsToLocal();
    },
    
    // 删除选项
    deleteOption(cardId, optionId) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const card = this.cards[cardIndex];
      card.data.options = card.data.options.filter((option) => option.id !== optionId);
      this.saveCardsToLocal();
    },
    
    // 添加下拉选项
    addSelectOption(cardId, label) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const newId = Date.now();
      const card = this.cards[cardIndex];
      card.data.selectOptions = [...card.data.selectOptions, { id: newId, label }];
      this.saveCardsToLocal();
    },
    
    // 删除下拉选项
    deleteSelectOption(cardId, optionId) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const card = this.cards[cardIndex];
      card.data.selectOptions = card.data.selectOptions.filter((option) => option.id !== optionId);
      this.saveCardsToLocal();
    },
    
    // 设置下拉菜单显示状态
    setShowDropdown(cardId, value) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      this.cards[cardIndex].showDropdown = value;
      this.saveCardsToLocal();
    },
    
    // 设置视图模式
    setViewMode(mode) {
      this.viewMode = mode;
    },
    
    // 新增：模式管理相关actions
    // 加载模式数据
    loadModesFromLocal() {
      const modes = dataManager.load('modes') || [];
      this.modes = modes;
      
      // 如果有模式但没有选中的模式，自动选择第一个
      if (modes.length > 0 && !this.currentModeId) {
        this.currentModeId = modes[0].id;
      }
    },
    
    // 保存模式数据
    saveModesToLocal() {
      dataManager.save('modes', this.modes);
    },
    
    // 添加模式
    addMode(modeData) {
      const newMode = {
        id: `mode-${uuidv4()}`,
        ...modeData,
        level: 2, // 默认中间级
        permissions: {
          card: {
            addCard: true,
            deleteCard: true,
            editTitle: true,
            editOptions: true
          },
          data: modeData.includeDataSection ? {
            view: true,
            save: false,
            export: false,
            import: false
          } : {},
          mode: {
            create: false,
            delete: false,
            assignPermissions: false
          }
        },
        cardData: [] // 模式专属的卡片数据
      };
      
      this.modes.push(newMode);
      this.currentModeId = newMode.id;
      this.saveModesToLocal();
      
      return newMode;
    },
    
    // 删除多个模式
    deleteModes(modeIds) {
      // 过滤掉要删除的模式
      this.modes = this.modes.filter(mode => !modeIds.includes(mode.id));
      
      // 如果当前模式被删除，自动切换到第一个模式
      if (modeIds.includes(this.currentModeId)) {
        this.currentModeId = this.modes.length > 0 ? this.modes[0].id : null;
      }
      
      this.saveModesToLocal();
    },
    
    // 设置当前模式
    setCurrentMode(modeId) {
      this.currentModeId = modeId;
      // 切换模式时同步卡片数据
      const mode = this.modes.find(m => m.id === modeId);
      if (mode && mode.cardData) {
        this.cards = [...mode.cardData];
      }
    }
  }
});
    