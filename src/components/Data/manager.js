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
    // 主ID专属数据区前缀（独立于普通模式）
    this.mainDataPrefix = 'main-data:'; // root_admin的数据用这个前缀
    // 普通模式数据区前缀
    this.modeDataPrefix = 'mode-data:';
    // 主ID固定为root_admin（核心！主数据区的唯一标识）
    this.rootAdminId = 'root_admin';
    // 单向流数据源（默认为主ID）
    this.sourceModeId = options.sourceModeId || this.rootAdminId;
    // 修复：将WeakSet改为Set，因为WeakSet没有clear()方法
    this.circularReferences = new Set();
    // 记录所有模式ID（用于全量操作，不含主ID）
    this.modeIndexKey = 'mode-index';
  }

  // ================= 主ID数据区专属方法（新增）=================
  /**
   * 保存主ID(root_admin)的数据（独立数据区）
   * @param {string} namespace - 数据分类（如'cards'、'config'）
   * @param {string} dataId - 数据唯一标识
   * @param {any} data - 要保存的数据
   */
  saveMainData(namespace, dataId, data) {
    const storageKey = `${this.mainDataPrefix}${namespace}:${dataId}`;
    this.save(storageKey, data);
  }

  /**
   * 加载主ID(root_admin)的数据
   * @param {string} namespace - 数据分类
   * @param {string} dataId - 数据唯一标识
   * @returns 对应的数据
   */
  loadMainData(namespace, dataId) {
    const storageKey = `${this.mainDataPrefix}${namespace}:${dataId}`;
    return this.load(storageKey);
  }

  /**
   * 清空主ID的某个命名空间数据
   * @param {string} namespace - 数据分类
   */
  clearMainNamespaceData(namespace) {
    const mainPrefix = `${this.mainDataPrefix}${namespace}:`;
    const allKeys = this.getAllKeys();
    allKeys.forEach(key => {
      if (key.startsWith(mainPrefix)) {
        this.storage.removeItem(key);
      }
    });
  }

  // ================= 模式生命周期管理（兼容主ID隔离）=================
  /**
   * 注册新模式（创建模式时调用，跳过主ID）
   * @param {string} modeId - 模式ID
   */
  registerMode(modeId) {
    // 主ID不需要注册到普通模式列表
    if (modeId === this.rootAdminId) return;
    
    const existingModes = this.load(this.modeIndexKey) || [];
    if (!existingModes.includes(modeId)) {
      this.save(this.modeIndexKey, [...existingModes, modeId]);
    }
  }

  /**
   * 删除模式（自动清理所有关联数据，禁止删除主ID）
   * @param {string} modeId - 要删除的模式ID
   */
  deleteMode(modeId) {
    // 禁止删除主ID
    if (modeId === this.rootAdminId) {
      console.warn('禁止删除主模式(root_admin)');
      return;
    }

    if (!modeId) return;

    // 1. 清理该模式的所有数据
    this.clearModeAllData(modeId);

    // 2. 从模式索引中移除
    const existingModes = this.load(this.modeIndexKey) || [];
    this.save(this.modeIndexKey, existingModes.filter(id => id !== modeId));

    console.log(`模式(${modeId})已删除，所有关联数据已清理`);
  }

  /**
   * 获取所有已注册的模式ID（不含主ID）
   */
  getAllModeIds() {
    return this.load(this.modeIndexKey) || [];
  }

  // ================= 普通模式数据操作（与主ID数据区严格分离）=================
  /**
   * 保存普通模式的数据（与主ID数据区隔离）
   * @param {string} modeId - 模式ID
   * @param {string} namespace - 数据分类
   * @param {string} dataId - 数据唯一标识
   * @param {any} data - 要保存的数据
   * @param {boolean} isFromSource - 是否来自数据源（用于单向流控制）
   */
  saveModeData(modeId, namespace, dataId, data, isFromSource = false) {
    // 主ID的数据不通过此方法处理，强制使用主ID专属方法
    if (modeId === this.rootAdminId) {
      console.warn('请使用saveMainData()保存主模式数据');
      return;
    }

    // 单向流控制：非数据源模式禁止直接写入
    if (this.sourceModeId && modeId !== this.sourceModeId && !isFromSource) {
      console.warn(`禁止直接修改非数据源模式(${modeId})的数据，请通过数据源同步`);
      return;
    }

    const storageKey = `${this.modeDataPrefix}${modeId}:${namespace}:${dataId}`;
    this.save(storageKey, data);
  }

  /**
   * 加载普通模式的数据
   * @param {string} modeId - 模式ID
   * @param {string} namespace - 数据分类
   * @param {string} dataId - 数据唯一标识
   * @returns 对应的数据
   */
  loadModeData(modeId, namespace, dataId) {
    // 主ID的数据不通过此方法处理
    if (modeId === this.rootAdminId) {
      console.warn('请使用loadMainData()加载主模式数据');
      return null;
    }

    const storageKey = `${this.modeDataPrefix}${modeId}:${namespace}:${dataId}`;
    return this.load(storageKey);
  }

  // 从数据源同步数据到目标模式（支持主ID作为数据源）
  syncFromSource(targetModeId, namespace = null) {
    // 禁止同步到主ID（主ID是源头，不接受其他模式的数据）
    if (targetModeId === this.rootAdminId) {
      console.warn('主模式(root_admin)不接受其他模式的同步数据');
      return;
    }

    if (!this.sourceModeId) {
      console.error('未设置数据源模式，请初始化时指定sourceModeId');
      return;
    }
    if (targetModeId === this.sourceModeId) return;

    // 区分数据源是主ID还是普通模式
    let sourceData;
    if (this.sourceModeId === this.rootAdminId) {
      // 从主ID数据区加载
      sourceData = namespace 
        ? this.listMainNamespaceData(namespace)
        : this.getAllMainData();
    } else {
      // 从普通模式数据区加载
      sourceData = namespace 
        ? this.listModeNamespaceData(this.sourceModeId, namespace)
        : this.getAllModeData(this.sourceModeId);
    }

    // 同步数据到目标模式（标记为来自数据源，绕过限制）
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

  // ================= 主ID数据区辅助方法（新增）=================
  /**
   * 列出主ID某个命名空间下的所有数据
   * @param {string} namespace - 数据分类
   * @returns 该命名空间下的所有数据（{dataId: data, ...}）
   */
  listMainNamespaceData(namespace) {
    const namespacePrefix = `${this.mainDataPrefix}${namespace}:`;
    const allKeys = this.getAllKeys();
    const result = {};

    allKeys.forEach(key => {
      if (key.startsWith(namespacePrefix)) {
        const dataId = key.replace(namespacePrefix, '');
        result[dataId] = this.load(key);
      }
    });

    return result;
  }

  /**
   * 获取主ID的所有数据
   * @returns 所有数据（{namespace: {dataId: data, ...}, ...}）
   */
  getAllMainData() {
    const mainPrefix = this.mainDataPrefix;
    const allKeys = this.getAllKeys();
    const result = {};

    allKeys.forEach(key => {
      if (key.startsWith(mainPrefix)) {
        const [, namespace, dataId] = key.replace(mainPrefix, '').split(':');
        if (!result[namespace]) result[namespace] = {};
        result[namespace][dataId || ''] = this.load(key);
      }
    });

    return result;
  }

  // ================= 普通模式数据区辅助方法（保持不变）=================
  listModeNamespaceData(modeId, namespace) {
    // 过滤主ID
    if (modeId === this.rootAdminId) return {};

    const namespacePrefix = `${this.modeDataPrefix}${modeId}:${namespace}:`;
    const allKeys = this.getAllKeys();
    const result = {};

    allKeys.forEach(key => {
      if (key.startsWith(namespacePrefix)) {
        const dataId = key.replace(namespacePrefix, '');
        result[dataId] = this.load(key);
      }
    });

    return result;
  }

  getAllModeData(modeId) {
    // 过滤主ID
    if (modeId === this.rootAdminId) return {};

    const modePrefix = `${this.modeDataPrefix}${modeId}:`;
    const allKeys = this.getAllKeys();
    const result = {};

    allKeys.forEach(key => {
      if (key.startsWith(modePrefix)) {
        const [, namespace, dataId] = key.replace(modePrefix, '').split(':');
        if (!result[namespace]) result[namespace] = {};
        result[namespace][dataId || ''] = this.load(key);
      }
    });

    return result;
  }

  queryModeData(modeId, namespace, predicate) {
    // 过滤主ID
    if (modeId === this.rootAdminId) return {};

    const namespaceData = this.listModeNamespaceData(modeId, namespace);
    const result = {};

    Object.entries(namespaceData).forEach(([dataId, data]) => {
      if (predicate(data, dataId)) {
        result[dataId] = data;
      }
    });

    return result;
  }

  // ================= 数据清理方法（增强主ID保护）=================
  /**
   * 清空指定普通模式的所有数据（不影响主ID）
   * @param {string} modeId - 模式ID
   */
  clearModeAllData(modeId) {
    // 保护主ID数据不被清理
    if (modeId === this.rootAdminId) {
      console.warn('禁止清理主模式(root_admin)的数据');
      return;
    }

    const modePrefix = `${this.modeDataPrefix}${modeId}:`;
    const allKeys = this.getAllKeys();
    
    allKeys.forEach(key => {
      if (key.startsWith(modePrefix)) {
        this.storage.removeItem(key);
      }
    });
  }

  deleteModeData(modeId, namespace, dataId) {
    // 保护主ID数据
    if (modeId === this.rootAdminId) {
      console.warn('请使用主模式专属方法操作主数据');
      return;
    }

    const storageKey = `${this.modeDataPrefix}${modeId}:${namespace}:${dataId}`;
    this.storage.removeItem(storageKey);
  }

  // ================= 内部工具方法（保持不变）=================
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

  // ================= 导入导出功能（兼容主ID数据）=================
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
    