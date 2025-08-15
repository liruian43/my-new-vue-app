import { defineStore } from 'pinia';
import DataManager from '../manager'; // 导入数据管理器

// 初始化数据管理器
const dataManager = new DataManager();

export const useDataSectionStore = defineStore('dataSection', {
  state: () => ({
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
  }),

  getters: {
    // 主模式判断
    isRootMode() {
      return dataManager.rootAdminId === dataManager.getCurrentModeId();
    },

    // 当前模式
    currentMode() {
      return dataManager.getMode(dataManager.getCurrentModeId());
    },

    // 当前模式ID
    currentModeId() {
      return dataManager.getCurrentModeId();
    },

    // 整合所有数据（按时间倒序）
    allData() {
      // 获取基础数据并添加默认值，防止undefined
      const environmentConfigs = dataManager.loadEnvironmentConfigs() || {};
      const questionBank = dataManager.loadQuestionBank() || {};
      const modes = dataManager.loadSubModeInstances() || [];
      
      // 确保数组属性存在，避免map调用错误
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
        modeId: dataManager.getCurrentModeId() || '',
        syncStatus: dataManager.getSyncStatus?.(item.questionId) || {},
        timestamp: item.createdAt ? new Date(item.createdAt).getTime() : new Date().getTime()
      }));
      
      // 题库数据
      const questionData = questions.map(item => ({
        id: item.id,
        dataType: 'question',
        typeText: '资料题库',
        summary: item.content?.length > 50 ? `${item.content.substring(0, 50)}...` : item.content || '',
        modeId: dataManager.getCurrentModeId() || '',
        syncStatus: dataManager.getSyncStatus?.(item.id) || {},
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
      const sourceData = this.isPreview 
        ? [...this.previewData.configs, ...this.previewData.questions].map(item => ({
            ...item,
            summary: item.content || item.questionId || '未命名数据',
            timestamp: item.timestamp || new Date().getTime()
          }))
        : this.allData;
      
      let result = [...sourceData];
      
      // 类型筛选
      if (this.filterType !== 'all') {
        result = result.filter(item => item.dataType === this.filterType);
      }
      
      // 同步状态筛选
      if (this.isRootMode && this.syncFilter !== 'all') {
        result = result.filter(item => 
          this.checkSyncStatus(item.syncStatus, this.syncFilter)
        );
      }
      
      // 确保始终按时间排序
      return result.sort((a, b) => b.timestamp - a.timestamp);
    },

    // 是否有选中的模式数据
    hasModeDataSelected() {
      return this.filteredData.some(item => item.selected && this.isModeData(item));
    },

    // 是否有预览数据
    hasPreview() {
      return this.previewData.totalCount > 0;
    }
  },

  actions: {
    // 初始化
    async initialize() {
      // 初始化数据管理器
      await dataManager.initialize();
    },

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
      if (item.modeId === dataManager.getCurrentModeId()) return 'mode-current';
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
      this.selectedCount = count;
      this.selectAll = count > 0 && count === this.filteredData.filter(item => !this.isModeData(item)).length;
    },

    // 全选/取消全选
    handleSelectAll() {
      this.filteredData.forEach(item => {
        if (!this.isModeData(item)) item.selected = this.selectAll;
      });
      this.updateSelected();
    },

    // 删除单个数据项
    async deleteItem(item) {
      if (this.isModeData(item)) return;
      
      if (confirm(`确定要删除 ${item.id || '该数据'} 吗？`)) {
        if (item.dataType === 'config') {
          const configs = await dataManager.loadEnvironmentConfigs();
          configs.contextTemplates = configs.contextTemplates
            .filter(template => template.questionId !== item.id);
          await dataManager.saveEnvironmentConfigs(configs);
        } else if (item.dataType === 'question') {
          const bank = await dataManager.loadQuestionBank();
          bank.questions = bank.questions.filter(q => q.id !== item.id);
          await dataManager.saveQuestionBank(bank);
        }
      }
    },

    // 删除选中的数据项
    async deleteSelected() {
      if (this.selectedCount === 0 || this.hasModeDataSelected) return;
      
      if (confirm(`确定要删除选中的 ${this.selectedCount} 条数据吗？`)) {
        // 加载当前数据
        const configs = await dataManager.loadEnvironmentConfigs();
        const bank = await dataManager.loadQuestionBank();
        
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
        await dataManager.saveEnvironmentConfigs(configs);
        await dataManager.saveQuestionBank(bank);
        
        this.selectAll = false;
        this.selectedCount = 0;
      }
    },

    // 从文件导入数据
    async importDataFromFile(file) {
      try {
        const importedData = await dataManager.importFromFile(file);
        let configs = [];
        let questions = [];
        
        if (importedData.questions) {
          questions = importedData.questions.map(q => this.normalizeQuestion(q));
        }
        
        if (importedData.contextTemplates) {
          configs = importedData.contextTemplates;
        }
        
        this.previewData = {
          configs,
          questions,
          totalCount: configs.length + questions.length
        };
        this.isPreview = true;
        
        return this.previewData;
      } catch (err) {
        console.error('导入数据失败:', err);
        throw new Error(`导入失败: ${err.message}`);
      }
    },

    // 导出数据
    async exportData() {
      try {
        await dataManager.exportData(
          dataManager.getCurrentModeId(), 
          `data-export-${new Date().getTime()}.json`
        );
      } catch (err) {
        alert('导出失败: ' + err.message);
      }
    },

    // 应用预览数据
    async applyPreview() {
      if (this.previewData.totalCount === 0) return;
      
      // 加载当前数据
      const bank = await dataManager.loadQuestionBank();
      const configs = await dataManager.loadEnvironmentConfigs();
      
      if (this.previewData.questions.length > 0) {
        // 添加新题目
        const normalizedQuestions = this.previewData.questions.map(q => 
          dataManager.normalizeQuestion(q)
        );
        bank.questions = [...bank.questions, ...normalizedQuestions];
        await dataManager.saveQuestionBank(bank);
      }
      
      if (this.previewData.configs.length > 0) {
        // 添加或更新配置
        this.previewData.configs.forEach(config => {
          const index = configs.contextTemplates
            .findIndex(t => t.questionId === config.questionId);
          
          if (index >= 0) {
            configs.contextTemplates[index] = config;
          } else {
            configs.contextTemplates.push(config);
          }
        });
        await dataManager.saveEnvironmentConfigs(configs);
      }
      
      this.previewData = { configs: [], questions: [], totalCount: 0 };
      this.isPreview = false;
      alert(`已导入 ${this.previewData.questions.length} 条题目和 ${this.previewData.configs.length} 条环境配置`);
    },

    // 取消预览
    cancelPreview() {
      this.previewData = { configs: [], questions: [], totalCount: 0 };
      this.isPreview = false;
    },

    // 切换管理模式
    toggleManager() {
      this.isManager = !this.isManager;
      if (!this.isManager) {
        this.filteredData.forEach(item => item.selected = false);
        this.selectAll = false;
        this.selectedCount = 0;
      }
    },

    // 清除筛选条件
    clearFilters() {
      this.filterType = 'all';
      this.syncFilter = 'all';
    },

    // 规范化题目数据
    normalizeQuestion(question) {
      return dataManager.normalizeQuestion(question);
    }
  }
});
    