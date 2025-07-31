// 保留原有存储策略
export class LocalStorageStrategy {
  getItem(key) { return localStorage.getItem(key); }
  setItem(key, value) { localStorage.setItem(key, value); }
  removeItem(key) { localStorage.removeItem(key); }
}

export class SessionStorageStrategy {
  getItem(key) { return sessionStorage.getItem(key); }
  setItem(key, value) { sessionStorage.setItem(key, value); }
  removeItem(key) { sessionStorage.removeItem(key); }
}

export class MemoryStorageStrategy {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key); }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}

// 核心管理器：保持数据隔离+单向流+模式删除自动清理
export default class DataManager {
  constructor(storageStrategy, options = {}) {
    this.storage = storageStrategy;
    this.modeDataPrefix = 'mode-data:';
    this.sourceModeId = options.sourceModeId || null; // 单向流数据源
    this.circularReferences = new WeakSet();
    // 新增：记录所有模式ID（用于全量操作）
    this.modeIndexKey = 'mode-index';
  }

  // ================= 模式生命周期管理（新增核心）=================
  /**
   * 注册新模式（创建模式时调用）
   * @param {string} modeId - 模式ID
   */
  registerMode(modeId) {
    const existingModes = this.load(this.modeIndexKey) || [];
    if (!existingModes.includes(modeId)) {
      this.save(this.modeIndexKey, [...existingModes, modeId]);
    }
  }

  /**
   * 删除模式（自动清理所有关联数据）
   * @param {string} modeId - 要删除的模式ID
   */
  deleteMode(modeId) {
    if (!modeId) return;

    // 1. 清理该模式的所有数据（核心）
    this.clearModeAllData(modeId);

    // 2. 从模式索引中移除
    const existingModes = this.load(this.modeIndexKey) || [];
    this.save(this.modeIndexKey, existingModes.filter(id => id !== modeId));

    console.log(`模式(${modeId})已删除，所有关联数据已清理`);
  }

  /**
   * 获取所有已注册的模式ID
   */
  getAllModeIds() {
    return this.load(this.modeIndexKey) || [];
  }

  // ================= 数据操作（保持隔离与单向流）=================
  saveModeData(modeId, namespace, dataId, data, isFromSource = false) {
    // 单向流控制：非数据源模式禁止直接写入
    if (this.sourceModeId && modeId !== this.sourceModeId && !isFromSource) {
      console.warn(`禁止直接修改非数据源模式(${modeId})的数据，请通过数据源同步`);
      return;
    }

    const storageKey = this.buildModeKey(modeId, namespace, dataId);
    this.save(storageKey, data);
  }

  loadModeData(modeId, namespace, dataId) {
    const storageKey = this.buildModeKey(modeId, namespace, dataId);
    return this.load(storageKey);
  }

  // 从数据源同步数据到目标模式（单向流）
  syncFromSource(targetModeId, namespace = null) {
    if (!this.sourceModeId) {
      console.error('未设置数据源模式，请初始化时指定sourceModeId');
      return;
    }
    if (targetModeId === this.sourceModeId) return;

    const sourceData = namespace 
      ? this.listModeNamespaceData(this.sourceModeId, namespace)
      : this.getAllModeData(this.sourceModeId);

    // 同步数据（标记为来自数据源，绕过限制）
    if (namespace) {
      Object.entries(sourceData).forEach(([dataId, data]) => {
        this.saveModeData(targetModeId, namespace, dataId, data, true);
      });
    } else {
      Object.entries(sourceData).forEach(([ns, dataMap]) => {
        Object.entries(dataMap).forEach(([dataId, data]) => {
          this.saveModeData(targetModeId, ns, dataId, data, true);
        });
      });
    }
  }

  // ================= 数据清理方法（增强）=================
  /**
   * 清空指定模式的所有数据（删除模式时内部调用）
   * @param {string} modeId - 模式ID
   */
  clearModeAllData(modeId) {
    const modePrefix = `${this.modeDataPrefix}${modeId}:`;
    const allKeys = this.getAllKeys();
    
    // 遍历并删除该模式的所有数据键
    allKeys.forEach(key => {
      if (key.startsWith(modePrefix)) {
        this.storage.removeItem(key);
      }
    });
  }

  deleteModeData(modeId, namespace, dataId) {
    const storageKey = this.buildModeKey(modeId, namespace, dataId);
    this.storage.removeItem(storageKey);
  }

  // ================= 其他辅助方法=================
  listModeNamespaceData(modeId, namespace) {
    const namespacePrefix = this.buildModeKey(modeId, namespace);
    const allKeys = this.getAllKeys();
    const result = {};

    allKeys.forEach(key => {
      if (key.startsWith(namespacePrefix)) {
        const dataId = key.replace(`${namespacePrefix}:`, '');
        result[dataId] = this.load(key);
      }
    });

    return result;
  }

  getAllModeData(modeId) {
    const modePrefix = `${this.modeDataPrefix}${modeId}:`;
    const allKeys = this.getAllKeys();
    const result = {};

    allKeys.forEach(key => {
      if (key.startsWith(modePrefix)) {
        const [, ns, dataId] = key.replace(modePrefix, '').split(':');
        if (!result[ns]) result[ns] = {};
        result[ns][dataId || ''] = this.load(key);
      }
    });

    return result;
  }

  queryModeData(modeId, namespace, predicate) {
    const namespaceData = this.listModeNamespaceData(modeId, namespace);
    const result = {};

    Object.entries(namespaceData).forEach(([dataId, data]) => {
      if (predicate(data, dataId)) {
        result[dataId] = data;
      }
    });

    return result;
  }

  // ================= 内部工具方法=================
  buildModeKey(modeId, namespace, dataId) {
    let key = `${this.modeDataPrefix}${modeId}:${namespace}`;
    if (dataId) key += `:${dataId}`;
    return key;
  }

  getAllKeys() {
    if (this.storage instanceof MemoryStorageStrategy) {
      return Array.from(this.storage.data.keys());
    } else if (this.storage instanceof LocalStorageStrategy || this.storage instanceof SessionStorageStrategy) {
      const keys = [];
      const storage = this.storage instanceof LocalStorageStrategy ? localStorage : sessionStorage;
      for (let i = 0; i < storage.length; i++) {
        keys.push(storage.key(i));
      }
      return keys;
    }
    return [];
  }

  save(key, data) {
    try {
      const stringified = JSON.stringify(data, (k, v) => {
        if (v instanceof Object && v !== null) {
          if (this.circularReferences.has(v)) return '[Circular Reference]';
          this.circularReferences.add(v);
        }
        return v;
      });
      this.circularReferences.clear();
      this.storage.setItem(key, stringified);
    } catch (error) {
      console.error('保存数据失败:', error);
      throw error;
    }
  }

  load(key) {
    try {
      const data = this.storage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('加载数据失败:', error);
      return null;
    }
  }

  // ================= 导入导出功能=================
  exportToFile(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
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
}
    