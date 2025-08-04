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

// 新增：数据校验类
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

// 核心管理器：localStorage长期存储 + 数据校验 + 导入导出
export default class DataManager {
  constructor() {
    // 保留localStorage长期存储
    this.longTermStorage = new LocalStorageStrategy();
    // 初始化校验器
    this.validator = new DataValidator();
    // 主ID固定为root_admin（用于模式隔离）
    this.rootAdminId = 'root_admin';
  }

  // 提供外部调用的校验接口
  validateConfig(cards) {
    return this.validator.validateConfig(cards);
  }

  // ================= localStorage长期存储操作 =================
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

  // ================= 导入导出功能（保留）=================
  /**
   * 导出数据为JSON文件
   * @param {string} modeId - 模式ID
   * @param {string} fileName - 导出文件名
   */
  async exportData(modeId = null, fileName = 'data_export.json') {
    // 收集要导出的数据（仅示例逻辑，可根据实际调整）
    const exportData = [];
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('app_long_term_long-term:')) {
        if (!modeId || key.includes(`:${modeId}:`)) {
          exportData.push(JSON.parse(localStorage.getItem(key)));
        }
      }
    });

    // 导出前校验并补充默认值
    const safeData = exportData.map(item => {
      const validation = this.validator.validateConfig([item]);
      return validation.validCards[0] || item;
    });

    const blob = new Blob([JSON.stringify(safeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return safeData;
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
          // 导入后自动校验并补充默认值
          const safeData = Array.isArray(data)
            ? data.map(item => {
                const validation = this.validator.validateConfig([item]);
                return validation.validCards[0] || item;
              })
            : data;
          resolve(safeData);
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
      if (!Array.isArray(importedData)) {
        throw new Error('导入数据必须是数组格式');
      }

      const results = { success: [], failed: [] };
      for (const [index, item] of importedData.entries()) {
        try {
          const dataId = item.id || `imported_${Date.now()}_${index}`;
          await this.saveToLongTerm(modeId, namespace, dataId, item);
          results.success.push(dataId);
        } catch (error) {
          results.failed.push({ index, reason: error.message });
        }
      }
      return results;
    } catch (error) {
      throw new Error(`导入失败: ${error.message}`);
    }
  }
}
