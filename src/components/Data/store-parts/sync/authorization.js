// src/components/Data/store-parts/sync/authorization.js
import { buildMetaKey, getSystemPrefix } from '../../services/id.js'; // 替换buildKey为buildMetaKey

// 使用id.js的元数据方法构建存储键（修复核心）
const STORAGE_KEY = buildMetaKey({
  version: 'sync',
  name: 'field_authorizations' // 用name参数存储自定义标识，支持任意格式
});

// 确保使用正确的本地存储实现
function ensureStorage(storage) {
  // 如果提供了有效的存储对象则使用它，否则使用默认的localStorage
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }
  
  // 默认使用localStorage，并添加前缀支持
  return {
    prefix: getSystemPrefix(),
    getItem: (key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    setItem: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    }
  };
}

export function saveFieldAuthorizations(storage, authorizations) {
  const s = ensureStorage(storage);
  return s.setItem(STORAGE_KEY, authorizations);
}

export function loadFieldAuthorizations(storage) {
  const s = ensureStorage(storage);
  return s.getItem(STORAGE_KEY) || {};
}

export function filterSyncFields(sourceData, authorizedFields) {
  const filtered = {};
  Object.keys(sourceData || {}).forEach(key => {
    if ((authorizedFields || []).includes(key)) {
      filtered[key] = sourceData[key];
    }
  });
  return filtered;
}
