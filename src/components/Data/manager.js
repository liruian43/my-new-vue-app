// src/components/Data/manager.js
import { reactive, ref, watch, toRaw } from 'vue';

/**
 * 数据类型枚举
 */
export const DATA_TYPES = {
  VALUE: 'value',      // 基础数值类型
  ARRAY: 'array',      // 数组类型
  OBJECT: 'object',    // 对象类型
  MODEL: 'model',      // 模式模板类型
  COLLECTION: 'collection' // 集合类型
};

/**
 * 存储策略接口
 */
export class StorageStrategy {
  constructor(config) {
    this.config = config;
  }
  
  async save(key, data) {
    throw new Error('save方法必须由子类实现');
  }
  
  async load(key) {
    throw new Error('load方法必须由子类实现');
  }
  
  async remove(key) {
    throw new Error('remove方法必须由子类实现');
  }
}

/**
 * 内存存储策略
 */
export class MemoryStorage extends StorageStrategy {
  constructor() {
    super();
    this.storage = new Map();
  }
  
  async save(key, data) {
    this.storage.set(key, JSON.parse(JSON.stringify(data)));
  }
  
  async load(key) {
    return this.storage.get(key);
  }
  
  async remove(key) {
    this.storage.delete(key);
  }
}

/**
 * LocalStorage存储策略
 */
export class LocalStorageStrategy extends StorageStrategy {
  async save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  
  async load(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
  
  async remove(key) {
    localStorage.removeItem(key);
  }
}

/**
 * SessionStorage存储策略
 */
export class SessionStorageStrategy extends StorageStrategy {
  async save(key, data) {
    sessionStorage.setItem(key, JSON.stringify(data));
  }
  
  async load(key) {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
  
  async remove(key) {
    sessionStorage.removeItem(key);
  }
}

/**
 * 数据管理器 - 核心类
 */
export class DataManager {
  constructor(storageStrategy = new MemoryStorage()) {
    this.storage = storageStrategy;
    this.dataStore = reactive({});
    this.dataTypes = new Map();
    this.observers = new Map();
  }
  
  /**
   * 注册数据
   */
  registerData(key, initialValue, type = DATA_TYPES.VALUE, options = {}) {
    if (this.dataStore[key] !== undefined) {
      console.warn(`数据键 ${key} 已存在，将覆盖现有数据`);
    }
    
    // 根据数据类型初始化
    let data;
    switch (type) {
      case DATA_TYPES.VALUE:
        data = ref(initialValue);
        break;
      case DATA_TYPES.ARRAY:
        data = reactive([...initialValue]);
        break;
      case DATA_TYPES.OBJECT:
        data = reactive({...initialValue});
        break;
      case DATA_TYPES.MODEL:
        data = this.createModel(initialValue, options.schema);
        break;
      case DATA_TYPES.COLLECTION:
        data = this.createCollection(initialValue, options.modelSchema);
        break;
      default:
        throw new Error(`未知数据类型: ${type}`);
    }
    
    this.dataStore[key] = data;
    this.dataTypes.set(key, type);
    
    // 自动保存选项
    if (options.autoSave) {
      this.enableAutoSave(key);
    }
    
    return data;
  }
  
  /**
   * 创建模式模板数据
   */
  createModel(initialValue, schema) {
    const model = reactive({...initialValue});
    
    // 这里可以添加模式验证逻辑
    if (schema) {
      this.applySchemaValidation(model, schema);
    }
    
    return model;
  }
  
  /**
   * 创建集合数据
   */
  createCollection(initialItems = [], modelSchema) {
    const collection = reactive([]);
    
    // 初始化集合
    initialItems.forEach(item => {
      const model = this.createModel(item, modelSchema);
      collection.push(model);
    });
    
    // 添加集合操作方法
    collection.add = (item) => {
      const model = this.createModel(item, modelSchema);
      collection.push(model);
      return model;
    };
    
    collection.remove = (index) => {
      collection.splice(index, 1);
    };
    
    return collection;
  }
  
  /**
   * 应用模式验证
   */
  applySchemaValidation(model, schema) {
    // 实际项目中可以集成ajv等验证库
    // 这里简化处理，只做示例
    const validate = (key, value) => {
      if (schema[key]) {
        // 简单类型验证
        if (schema[key].type && typeof value !== schema[key].type) {
          console.warn(`属性 ${key} 类型不匹配，期望 ${schema[key].type}`);
          return false;
        }
        
        // 其他验证规则...
      }
      return true;
    };
    
    // 监听属性变化进行验证
    Object.keys(model).forEach(key => {
      let val = model[key];
      Object.defineProperty(model, key, {
        get() { return val; },
        set(newVal) {
          if (validate(key, newVal)) {
            val = newVal;
          }
        }
      });
    });
  }
  
  /**
   * 获取数据
   */
  getData(key) {
    return this.dataStore[key];
  }
  
  /**
   * 更新数据
   */
  updateData(key, newValue) {
    const data = this.dataStore[key];
    if (data === undefined) {
      console.error(`数据键 ${key} 不存在`);
      return;
    }
    
    const type = this.dataTypes.get(key);
    
    switch (type) {
      case DATA_TYPES.VALUE:
        data.value = newValue;
        break;
      case DATA_TYPES.ARRAY:
        // 替换数组内容
        data.splice(0, data.length, ...newValue);
        break;
      case DATA_TYPES.OBJECT:
        // 替换对象属性
        Object.assign(data, newValue);
        break;
      case DATA_TYPES.MODEL:
        Object.assign(data, newValue);
        break;
      case DATA_TYPES.COLLECTION:
        // 清空并添加新项
        data.splice(0, data.length);
        newValue.forEach(item => data.add(item));
        break;
    }
    
    // 触发观察者
    this.notifyObservers(key);
  }
  
  /**
   * 删除数据
   */
  deleteData(key) {
    delete this.dataStore[key];
    this.dataTypes.delete(key);
    this.observers.delete(key);
    this.storage.remove(key);
  }
  
  /**
   * 保存数据到存储
   */
  async saveData(key) {
    const data = this.dataStore[key];
    if (data === undefined) {
      console.error(`数据键 ${key} 不存在`);
      return;
    }
    
    try {
      // 转换为原始数据
      const rawData = toRaw(data);
      await this.storage.save(key, rawData);
      return true;
    } catch (error) {
      console.error(`保存数据失败: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 从存储加载数据
   */
  async loadData(key, type = DATA_TYPES.VALUE, options = {}) {
    try {
      const data = await this.storage.load(key);
      
      if (data === null) {
        // 数据不存在，使用初始值
        return this.registerData(key, options.initialValue || null, type, options);
      }
      
      // 注册并返回数据
      return this.registerData(key, data, type, options);
    } catch (error) {
      console.error(`加载数据失败: ${error.message}`);
      // 返回默认值
      return this.registerData(key, options.initialValue || null, type, options);
    }
  }
  
  /**
   * 启用自动保存
   */
  enableAutoSave(key) {
    const data = this.dataStore[key];
    if (!data) return;
    
    // 创建观察器
    watch(data, async () => {
      await this.saveData(key);
    }, { deep: true });
  }
  
  /**
   * 导入数据
   */
  async importData(key, file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      this.updateData(key, data);
      return true;
    } catch (error) {
      console.error(`导入数据失败: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 导出数据
   */
  async exportData(key, fileName = `${key}.json`) {
    const data = this.dataStore[key];
    if (!data) return;
    
    const rawData = toRaw(data);
    const jsonString = JSON.stringify(rawData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
  
  /**
   * 注册观察者
   */
  observe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }
    
    this.observers.get(key).add(callback);
    
    // 返回取消观察函数
    return () => {
      const observers = this.observers.get(key);
      if (observers) {
        observers.delete(callback);
      }
    };
  }
  
  /**
   * 通知观察者
   */
  notifyObservers(key) {
    const observers = this.observers.get(key);
    if (observers) {
      observers.forEach(callback => callback(this.dataStore[key]));
    }
  }
}

// 默认导出单例数据管理器
const defaultStorage = new LocalStorageStrategy();
export default new DataManager(defaultStorage);