import { getSystemPrefix } from './id.js';

// 确保存储对象有效
function ensureStorage(storage) {
  // 如果提供了有效的存储对象则使用它
  if (storage && typeof storage.getItem === 'function' && 
      typeof storage.setItem === 'function' && 
      typeof storage.removeItem === 'function') {
    return storage;
  }
  
  // 否则返回默认的localStorage封装
  return {
    prefix: getSystemPrefix(),
    getItem: (key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    setItem: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    }
  };
}

export function buildKey(modeId, namespace, dataId) {
  // 可以考虑使用id.js中的buildKey方法进行更规范的键生成
  // 这里保持原有格式以兼容现有逻辑
  return `long-term:${modeId}:${namespace}:${dataId}`;
}

export function saveToLongTerm(storage, modeId, namespace, dataId, data, validator /* 可选 */) {
  const s = ensureStorage(storage);

  // [可能需要删除] 统一在上层校验
  if (validator?.validateConfig) {
    const res = validator.validateConfig([data]);
    if (!res.pass) {
      console.error('长期存储数据校验失败:', res.errors);
      throw new Error('数据不符合要求，无法存储');
    }
  }

  const key = buildKey(modeId, namespace, dataId);
  const itemToStore = {
    ...data,
    modeId,
    namespace,
    storedAt: new Date().toISOString()
  };
  
  return s.setItem(key, itemToStore);
}

export function getFromLongTerm(storage, modeId, namespace, dataId) {
  const s = ensureStorage(storage);
  const key = buildKey(modeId, namespace, dataId);
  return s.getItem(key);
}

export function deleteFromLongTerm(storage, modeId, namespace, dataId) {
  const s = ensureStorage(storage);
  const key = buildKey(modeId, namespace, dataId);
  return s.removeItem(key);
}

export function clearLongTermByMode(storage, modeId, rootAdminId = 'root_admin') {
  const s = ensureStorage(storage);
  if (modeId === rootAdminId) {
    console.warn('禁止清空主模式的长期存储数据');
    return;
  }
  
  const prefix = s.prefix || getSystemPrefix();
  const startsWith = `${prefix}long-term:${modeId}:`;

  // 遍历localStorage删除匹配的键
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith(startsWith)) {
      localStorage.removeItem(k);
    }
  });
}
