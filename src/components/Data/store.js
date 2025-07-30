// src/components/Data/store.js
import { defineStore } from 'pinia';
import DataManager, { 
  LocalStorageStrategy, 
  SessionStorageStrategy, 
  MemoryStorageStrategy 
} from './manager';

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
    cards: [],
    selectedCardId: null,
    deletingCardId: null,
    storageType: localStorage.getItem('storageType') || 'local',
    loading: false,
    error: null,
    viewMode: 'tree' // 新增：视图模式
  }),
  
  getters: {
    selectedCard(state) {
      return state.cards.find(card => card.id === state.selectedCardId);
    },
    
    dataPreview(state) {
      return state.cards;
    }
  },
  
  actions: {
    // 初始化加载数据
    initialize() {
      this.loading = true;
      this.error = null;
      
      try {
        // 从本地存储加载
        this.loadCardsFromLocal();
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
    },
    
    // 删除卡片
    deleteCard(id) {
      this.cards = this.cards.filter(card => card.id !== id);
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
    
    // 新增：切换标题编辑状态
    toggleTitleEditing(cardId) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].isTitleEditing = !this.cards[cardIndex].isTitleEditing;
        this.saveCardsToLocal();
      }
    },
    
    // 新增：切换选项编辑状态
    toggleOptionsEditing(cardId) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].isOptionsEditing = !this.cards[cardIndex].isOptionsEditing;
        this.saveCardsToLocal();
      }
    },
    
    // 新增：切换下拉菜单编辑状态
    toggleSelectEditing(cardId) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].isSelectEditing = !this.cards[cardIndex].isSelectEditing;
        this.saveCardsToLocal();
      }
    },
    
    // 新增：切换可编辑字段
    toggleEditableField(cardId, field) {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        this.cards[cardIndex].editableFields[field] = !this.cards[cardIndex].editableFields[field];
        this.saveCardsToLocal();
      }
    },
    
    // 新增：添加选项
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
    
    // 新增：删除选项
    deleteOption(cardId, optionId) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const card = this.cards[cardIndex];
      card.data.options = card.data.options.filter((option) => option.id !== optionId);
      this.saveCardsToLocal();
    },
    
    // 新增：添加下拉选项
    addSelectOption(cardId, label) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const newId = Date.now();
      const card = this.cards[cardIndex];
      card.data.selectOptions = [...card.data.selectOptions, { id: newId, label }];
      this.saveCardsToLocal();
    },
    
    // 新增：删除下拉选项
    deleteSelectOption(cardId, optionId) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const card = this.cards[cardIndex];
      card.data.selectOptions = card.data.selectOptions.filter((option) => option.id !== optionId);
      this.saveCardsToLocal();
    },
    
    // 新增：设置下拉菜单显示状态
    setShowDropdown(cardId, value) {
      const cardIndex = this.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      this.cards[cardIndex].showDropdown = value;
      this.saveCardsToLocal();
    },
    
    // 新增：设置视图模式
    setViewMode(mode) {
      this.viewMode = mode;
    }
  }
});