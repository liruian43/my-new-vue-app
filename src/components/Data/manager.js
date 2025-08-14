// 保留localStorage存储策略（长期存储专用）
export class LocalStorageStrategy {
  constructor() {
    this.prefix = 'app_long_term_';
  }

  setItem(key, data) {
    const storageKey = this.prefix + key;
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  }

  getItem(key) {
    const storageKey = this.prefix + key;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  }

  removeItem(key) {
    const storageKey = this.prefix + key;
    localStorage.removeItem(storageKey);
    return true;
  }

  clear() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}

// 数据校验类（增强）
export class DataValidator {
  // 校验单张卡片配置
  validateCard(card) {
    const errors = [];
    const safeCard = { ...card, invalid: false }; // 标记卡片是否无效

    // 基础结构校验
    if (!safeCard.data) {
      errors.push('缺少data字段');
      safeCard.data = {};
    }

    // 卡片标题校验
    if (safeCard.data.title === undefined || safeCard.data.title === null || safeCard.data.title.trim() === '') {
      errors.push('卡片标题不能为空');
    }

    // 选项数组校验
    if (!Array.isArray(safeCard.data.options)) {
      errors.push('options必须是数组');
      safeCard.data.options = [];
    } else if (safeCard.data.options.length === 0) {
      errors.push('至少需要一个选项');
    }

    // 选项内容校验
    safeCard.data.options = safeCard.data.options.map((opt, index) => {
      const safeOpt = { ...opt };
      const optErrors = [];
      
      if (safeOpt.name === undefined || safeOpt.name === null || safeOpt.name.trim() === '') {
        optErrors.push(`选项${index + 1}名称不能为空`);
      }
      if (safeOpt.value === undefined || safeOpt.value === null || isNaN(safeOpt.value)) {
        optErrors.push(`选项${index + 1}数值必须为有效数字`);
        safeOpt.value = 0; // 补充默认值
      }
      if (safeOpt.unit === undefined || safeOpt.unit === null) {
        safeOpt.unit = ''; // 补充默认值
      }

      if (optErrors.length > 0) {
        errors.push(...optErrors);
      }
      return safeOpt;
    });

    // 下拉菜单校验
    if (!Array.isArray(safeCard.data.selectOptions)) {
      safeCard.data.selectOptions = []; // 补充默认值
    }

    // 新增：UI配置和评分规则校验
    if (safeCard.data.uiConfig === undefined || typeof safeCard.data.uiConfig !== 'object') {
      safeCard.data.uiConfig = {};
    }
    
    if (safeCard.data.scoreRules === undefined || !Array.isArray(safeCard.data.scoreRules)) {
      safeCard.data.scoreRules = [];
    }

    // 标记无效卡片
    if (errors.length > 0) {
      safeCard.invalid = true;
      safeCard.validationErrors = errors;
    }

    return {
      pass: errors.length === 0,
      errors,
      card: safeCard
    };
  }

  // 校验题目
  validateQuestion(question) {
    const errors = [];
    
    if (!question.id) errors.push('题目必须有唯一ID');
    if (!question.content || question.content.trim() === '') errors.push('题目内容不能为空');
    if (!Array.isArray(question.options) || question.options.length === 0) {
      errors.push('题目必须包含选项');
    }
    if (!question.correctAnswer) errors.push('题目必须设置正确答案');
    
    // 环境配置校验
    if (!question.environmentConfig) {
      errors.push('题目必须包含环境配置');
    } else {
      if (!question.environmentConfig.uiConfig) {
        errors.push('环境配置必须包含UI配置');
      }
      if (!question.environmentConfig.scoringRules || question.environmentConfig.scoringRules.length === 0) {
        errors.push('环境配置必须包含评分规则');
      }
    }
    
    return {
      pass: errors.length === 0,
      errors
    };
  }

  // 校验整个配置（多张卡片）
  validateConfig(cards) {
    if (!Array.isArray(cards)) {
      return {
        pass: false,
        errors: ['配置数据必须是数组'],
        validCards: [],
        invalidCards: []
      };
    }

    if (cards.length === 0) {
      return {
        pass: false,
        errors: ['至少需要一张卡片'],
        validCards: [],
        invalidCards: []
      };
    }

    // 逐个校验卡片
    const results = cards.map(card => this.validateCard(card));
    
    return {
      pass: results.every(r => r.pass),
      errors: results.flatMap(r => r.errors),
      validCards: results.filter(r => r.pass).map(r => r.card),
      invalidCards: results.filter(r => !r.pass).map(r => r.card)
    };
  }
}

// 核心管理器：按六个模块组织功能
export default class DataManager {
  constructor(storageStrategy) {
    // 长期存储策略
    this.longTermStorage = storageStrategy || new LocalStorageStrategy();
    // 初始化校验器
    this.validator = new DataValidator();
    // 主ID固定为root_admin（用于模式隔离）
    this.rootAdminId = 'root_admin';
    
    // 卡片数据结构模板（遵循八项内容规范）
    this.CARD_DATA_TEMPLATE = {
      title: null,
      options: [
        { name: null, value: null, unit: null } // 确保子项字段完整
      ],
      selectOptions: [],
      syncStatus: {
        title: { hasSync: false, isAuthorized: false },
        options: {
          name: { hasSync: false, isAuthorized: false },
          value: { hasSync: false, isAuthorized: false },
          unit: { hasSync: false, isAuthorized: false }
        },
        selectOptions: { hasSync: true, isAuthorized: false }
      }
    };
    
    // 模块存储键名
    this.storageKeys = {
      questionBank: 'question_bank',
      environmentConfigs: 'environment_configs',
      subModeInstances: 'submode_instances',
      syncHistory: 'sync_history',
      fieldAuthorizations: 'field_authorizations',
      feedbackData: 'feedback_data'
    };
  }

  /**
   * 存储层空值处理：将空字符转为null，确保字段存在
   * @param {any} value - 原始值
   * @returns {any} 处理后的值（空字符→null，保持其他类型）
   */
  normalizeNullValue(value) {
    if (typeof value === 'string' && value.trim() === '') return null;
    return value !== undefined ? value : null;
  }

  /**
   * 递归标准化数据结构，确保符合规范
   * @param {Object} data - 原始数据
   * @param {Object} template - 结构模板
   * @returns {Object} 标准化后的数据
   */
  normalizeDataStructure(data, template) {
    const result = { ...data };

    // 确保所有必要字段存在
    Object.keys(template).forEach(key => {
      if (result[key] === undefined) {
        // 从模板复制默认结构
        result[key] = Array.isArray(template[key]) 
          ? [...template[key]] 
          : typeof template[key] === 'object' 
            ? { ...template[key] } 
            : template[key];
      }

      // 递归处理对象
      if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = this.normalizeDataStructure(result[key], template[key]);
      }

      // 处理数组
      if (Array.isArray(result[key])) {
        result[key] = result[key].map(item => {
          if (typeof item === 'object' && item !== null) {
            const itemTemplate = Array.isArray(template[key]) && template[key][0] 
              ? template[key][0] 
              : {};
            return this.normalizeDataStructure(item, itemTemplate);
          }
          return this.normalizeNullValue(item);
        });
      } else {
        // 处理基本类型
        result[key] = this.normalizeNullValue(result[key]);
      }
    });

    return result;
  }

  /**
   * 将存储层数据转换为展示层格式（null→空字符）
   * @param {Array} dataList - 存储层数据数组
   * @param {string} dataType - 数据类型（config/question）
   * @param {string} typeText - 类型显示文本
   * @returns {Array} 展示层数据
   */
  formatForDisplay(dataList, dataType, typeText) {
    return (dataList || []).map(item => {
      // 展示层转换：null→空字符
      const title = item.title === null ? '' : item.title;
      
      // 生成摘要
      let summary = title || '未命名';
      summary += ` (选项: ${item.options?.length || 0})`;
      
      return {
        ...item,
        dataType,
        typeText,
        summary: summary.length > 50 ? `${summary.substring(0, 50)}...` : summary,
        timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : item.id
      };
    });
  }

  /**
   * 提供外部调用的校验接口
   */
  validateConfig(cards) {
    return this.validator.validateConfig(cards);
  }

  // 1. 主模式运行模块 - 数据处理
  /**
   * 保存主模式配置（不包含临时数据）
   */
  saveRootModeConfig(config) {
    return this.longTermStorage.setItem('root_mode_config', {
      ...config,
      updatedAt: new Date().toISOString()
    });
  }
  
  /**
   * 获取主模式配置
   */
  getRootModeConfig() {
    return this.longTermStorage.getItem('root_mode_config') || {};
  }

  // 2. 题库管理模块 - 数据处理
  /**
   * 加载题库数据
   */
  async loadQuestionBank() {
    return this.longTermStorage.getItem(this.storageKeys.questionBank) || {
      questions: [],
      categories: [],
      lastUpdated: null
    };
  }
  
  /**
   * 保存题库数据
   */
  saveQuestionBank(bankData) {
    return this.longTermStorage.setItem(this.storageKeys.questionBank, {
      ...bankData,
      lastUpdated: new Date().toISOString()
    });
  }
  
  /**
   * 标准化题目格式
   */
  normalizeQuestion(questionData) {
    return {
      id: questionData.id || `q_${Date.now()}`,
      content: questionData.content || '',
      explanation: questionData.explanation || '',
      categories: questionData.categories || [],
      difficulty: questionData.difficulty || 'medium',
      options: questionData.options || [],
      correctAnswer: questionData.correctAnswer || null,
      environmentConfig: questionData.environmentConfig || {
        uiConfig: {},
        scoringRules: [],
        timeLimit: null
      },
      createdAt: questionData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // 3. 环境配置模块 - 数据处理
  /**
   * 加载环境配置
   */
  async loadEnvironmentConfigs() {
    return this.longTermStorage.getItem(this.storageKeys.environmentConfigs) || {
      uiPresets: [],
      scoringRules: [],
      contextTemplates: []
    };
  }
  
  /**
   * 保存环境配置
   */
  saveEnvironmentConfigs(configs) {
    return this.longTermStorage.setItem(this.storageKeys.environmentConfigs, {
      ...configs,
      updatedAt: new Date().toISOString()
    });
  }
  
  /**
   * 创建评分规则
   */
  createScoringRule(ruleData) {
    return {
      id: ruleData.id || `rule_${Date.now()}`,
      name: ruleData.name || '',
      description: ruleData.description || '',
      type: ruleData.type || 'exact_match', // 精确匹配/部分匹配/范围匹配等
      parameters: ruleData.parameters || {},
      score: ruleData.score || 0,
      createdAt: new Date().toISOString()
    };
  }

  // 4. 联动同步模块 - 数据处理
  /**
   * 保存同步历史
   */
  saveSyncHistory(history) {
    return this.longTermStorage.setItem(this.storageKeys.syncHistory, history);
  }
  
  /**
   * 加载同步历史
   */
  loadSyncHistory() {
    return this.longTermStorage.getItem(this.storageKeys.syncHistory) || [];
  }
  
  /**
   * 保存字段授权配置
   */
  saveFieldAuthorizations(authorizations) {
    return this.longTermStorage.setItem(this.storageKeys.fieldAuthorizations, authorizations);
  }
  
  /**
   * 加载字段授权配置
   */
  loadFieldAuthorizations() {
    return this.longTermStorage.getItem(this.storageKeys.fieldAuthorizations) || {};
  }
  
  /**
   * 过滤可同步的字段（根据授权）
   */
  filterSyncFields(sourceData, authorizedFields) {
    const filtered = {};
    
    // 只保留授权的字段
    Object.keys(sourceData).forEach(key => {
      if (authorizedFields.includes(key)) {
        filtered[key] = sourceData[key];
      }
    });
    
    return filtered;
  }

  // 5. 子模式运行模块 - 数据处理
  /**
   * 保存子模式实例
   */
  saveSubModeInstances(instances) {
    return this.longTermStorage.setItem(this.storageKeys.subModeInstances, instances);
  }
  
  /**
   * 加载子模式实例
   */
  loadSubModeInstances() {
    return this.longTermStorage.getItem(this.storageKeys.subModeInstances) || [];
  }
  
  /**
   * 创建子模式数据快照（用于隔离）
   */
  createSubModeSnapshot(sourceData) {
    // 深拷贝确保数据隔离
    return JSON.parse(JSON.stringify(sourceData));
  }

  // 6. 匹配反馈模块 - 数据处理
  /**
   * 保存反馈数据
   */
  saveFeedbackData(feedbackData) {
    return this.longTermStorage.setItem(this.storageKeys.feedbackData, {
      ...feedbackData,
      updatedAt: new Date().toISOString()
    });
  }
  
  /**
   * 加载反馈数据
   */
  loadFeedbackData() {
    return this.longTermStorage.getItem(this.storageKeys.feedbackData) || {
      submissions: [],
      feedbacks: []
    };
  }
  
  /**
   * 将子模式提交的结果与题库匹配
   */
  matchResultsWithQuestionBank(results, questionBank) {
    const feedback = {
      totalScore: 0,
      maxScore: 0,
      questionFeedbacks: [],
      passed: false
    };
    
    // 遍历每个提交的结果
    results.forEach(result => {
      // 查找对应的题目
      const question = questionBank.find(q => q.id === result.questionId);
      
      if (!question) {
        feedback.questionFeedbacks.push({
          questionId: result.questionId,
          found: false,
          message: '题目不存在于题库中'
        });
        return;
      }
      
      // 计算该题得分
      const questionFeedback = this.evaluateQuestionResult(question, result);
      feedback.questionFeedbacks.push(questionFeedback);
      
      // 累计总分
      feedback.totalScore += questionFeedback.score;
      feedback.maxScore += questionFeedback.maxScore;
    });
    
    // 计算通过率（简单实现：60%为通过）
    feedback.passed = feedback.maxScore > 0 
      ? (feedback.totalScore / feedback.maxScore) >= 0.6 
      : false;
    
    return feedback;
  }
  
  /**
   * 评估单个题目的结果
   */
  evaluateQuestionResult(question, result) {
    const feedback = {
      questionId: question.id,
      questionContent: question.content,
      userAnswer: result.answer,
      correctAnswer: question.correctAnswer,
      isCorrect: false,
      score: 0,
      maxScore: 0,
      explanation: '',
      ruleMatches: []
    };
    
    // 计算本题总分
    feedback.maxScore = question.environmentConfig.scoringRules
      .reduce((sum, rule) => sum + (rule.score || 0), 0);
    
    // 如果没有评分规则，使用简单匹配
    if (question.environmentConfig.scoringRules.length === 0) {
      feedback.isCorrect = result.answer === question.correctAnswer;
      feedback.score = feedback.isCorrect ? feedback.maxScore || 10 : 0;
      feedback.explanation = feedback.isCorrect ? '回答正确' : '回答错误';
      return feedback;
    }
    
    // 应用每个评分规则
    question.environmentConfig.scoringRules.forEach(rule => {
      let ruleScore = 0;
      let matched = false;
      
      switch (rule.type) {
        case 'exact_match':
          matched = result.answer === question.correctAnswer;
          ruleScore = matched ? (rule.score || 0) : 0;
          break;
          
        case 'partial_match':
          // 简单实现：检查是否包含正确答案的部分内容
          if (typeof result.answer === 'string' && typeof question.correctAnswer === 'string') {
            matched = result.answer.includes(question.correctAnswer) || 
                      question.correctAnswer.includes(result.answer);
            ruleScore = matched ? (rule.score || 0) * 0.5 : 0; // 部分匹配得一半分
          }
          break;
          
        case 'range_match':
          // 适用于数值型答案
          if (rule.parameters?.min !== undefined && rule.parameters?.max !== undefined) {
            const numericAnswer = parseFloat(result.answer);
            if (!isNaN(numericAnswer)) {
              matched = numericAnswer >= rule.parameters.min && numericAnswer <= rule.parameters.max;
              ruleScore = matched ? (rule.score || 0) : 0;
            }
          }
          break;
          
        default:
          // 默认使用精确匹配
          matched = result.answer === question.correctAnswer;
          ruleScore = matched ? (rule.score || 0) : 0;
      }
      
      feedback.ruleMatches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        score: ruleScore
      });
      
      feedback.score += ruleScore;
    });
    
    // 确定是否正确（达到满分的80%视为正确）
    feedback.isCorrect = feedback.maxScore > 0 
      ? (feedback.score / feedback.maxScore) >= 0.8 
      : false;
    
    feedback.explanation = feedback.isCorrect 
      ? '回答正确' 
      : `回答不符合要求。正确答案：${question.correctAnswer}`;
    
    return feedback;
  }

  // 通用功能：长期存储操作
  /**
   * 保存数据到长期存储（localStorage）
   * @param {string} modeId - 模式ID
   * @param {string} namespace - 数据分类
   * @param {string} dataId - 数据唯一标识
   * @param {object} data - 要存储的数据（会先校验）
   */
  saveToLongTerm(modeId, namespace, dataId, data) {
    // 保存前先校验
    const validation = this.validator.validateConfig([data]);
    if (!validation.pass) {
      console.error('长期存储数据校验失败:', validation.errors);
      throw new Error('数据不符合要求，无法存储');
    }

    const storageKey = `long-term:${modeId}:${namespace}:${dataId}`;
    return this.longTermStorage.setItem(storageKey, {
      ...data,
      modeId,
      namespace,
      storedAt: new Date().toISOString()
    });
  }

  /**
   * 从长期存储读取数据
   * @param {string} modeId - 模式ID
   * @param {string} namespace - 数据分类
   * @param {string} dataId - 数据唯一标识
   */
  getFromLongTerm(modeId, namespace, dataId) {
    const storageKey = `long-term:${modeId}:${namespace}:${dataId}`;
    return this.longTermStorage.getItem(storageKey);
  }

  /**
   * 从长期存储删除数据
   * @param {string} modeId - 模式ID
   * @param {string} namespace - 数据分类
   * @param {string} dataId - 数据唯一标识
   */
  deleteFromLongTerm(modeId, namespace, dataId) {
    const storageKey = `long-term:${modeId}:${namespace}:${dataId}`;
    return this.longTermStorage.removeItem(storageKey);
  }

  /**
   * 清空指定模式的长期存储数据
   * @param {string} modeId - 模式ID
   */
  clearLongTermByMode(modeId) {
    if (modeId === this.rootAdminId) {
      console.warn('禁止清空主模式的长期存储数据');
      return;
    }
    
    // 遍历删除该模式下的所有数据
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`app_long_term_long-term:${modeId}:`)) {
        localStorage.removeItem(key);
      }
    });
  }

  // 导入导出功能
  /**
   * 导出数据为JSON文件
   * @param {string} modeId - 模式ID
   * @param {string} fileName - 导出文件名
   */
  async exportData(modeId = null, fileName = 'data_export.json') {
    // 收集要导出的数据
    const exportData = {
      questionBank: await this.loadQuestionBank(),
      environmentConfigs: await this.loadEnvironmentConfigs(),
      subModeInstances: await this.loadSubModeInstances(),
      syncHistory: this.loadSyncHistory()
    };

    // 如果指定了模式ID，只导出该模式的数据
    if (modeId && modeId !== this.rootAdminId) {
      // 过滤子模式实例
      exportData.subModeInstances = exportData.subModeInstances
        .filter(inst => inst.baseModeId === modeId);
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return exportData;
  }
  
  /**
   * 从JSON文件导入数据
   * @param {File} file - 导入的文件
   */
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('无效的JSON文件'));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 从文件导入并保存到长期存储
   * @param {File} file - 导入的文件
   * @param {string} modeId - 目标模式ID
   * @param {string} namespace - 数据分类
   */
  async importToLongTerm(file, modeId, namespace) {
    try {
      const importedData = await this.importFromFile(file);
      
      // 处理导入的题库数据
      if (importedData.questionBank) {
        const bankData = await this.loadQuestionBank();
        this.saveQuestionBank({
          ...bankData,
          questions: [...bankData.questions, ...importedData.questionBank.questions],
          categories: [...new Set([...bankData.categories, ...importedData.questionBank.categories])]
        });
      }
      
      // 处理导入的环境配置
      if (importedData.environmentConfigs) {
        const envConfigs = await this.loadEnvironmentConfigs();
        this.saveEnvironmentConfigs({
          ...envConfigs,
          uiPresets: [...envConfigs.uiPresets, ...importedData.environmentConfigs.uiPresets],
          scoringRules: [...envConfigs.scoringRules, ...importedData.environmentConfigs.scoringRules],
          contextTemplates: [...envConfigs.contextTemplates, ...importedData.environmentConfigs.contextTemplates]
        });
      }
      
      return { success: true };
    } catch (error) {
      throw new Error(`导入失败: ${error.message}`);
    }
  }

  /**
   * 生成数据项的悬停提示文本
   * @param {Object} item - 数据项
   * @param {boolean} isRootMode - 是否为主模式
   * @returns {string} 提示文本
   */
  generateTooltip(item, isRootMode) {
    const details = [];
    details.push(`ID: ${item.id || '未定义'}`);
    details.push(`类型: ${item.typeText}`);

    // 同步状态信息
    if (item.syncStatus) {
      const titleSync = item.syncStatus.title?.hasSync ? '已同步' : '未同步';
      const titleAuth = item.syncStatus.title?.isAuthorized ? '已授权' : '未授权';
      details.push(`标题: ${titleSync}/${titleAuth}`);
    }

    details.push(`所属模式: ${item.modeId || '全局'}`);
    return details.join(' | ');
  }

  /**
   * 检查同步状态是否匹配筛选条件
   * @param {Object} syncStatus - 同步状态对象
   * @param {string} filter - 筛选条件（synced/unsynced/conflict）
   * @returns {boolean} 是否匹配
   */
  checkSyncStatus(syncStatus, filter) {
    if (filter === 'synced') return syncStatus?.title?.hasSync === true;
    if (filter === 'unsynced') return syncStatus?.title?.hasSync === false;
    if (filter === 'conflict') return syncStatus?.isConflict === true;
    return true;
  }

  /**
   * 转换同步状态为显示文本
   * @param {string} status - 状态标识
   * @returns {string} 显示文本
   */
  getSyncText(status) {
    const syncMap = {
      synced: '已同步',
      unsynced: '未同步',
      conflict: '冲突'
    };
    return syncMap[status] || '未知';
  }
}
    