// src/components/Data/store-parts/sync/history.js
import { buildKey, getSystemPrefix } from '../../services/id.js';

// 使用 id.js 构建存储键，遵循四段式规则
const STORAGE_KEY = buildKey({
  version: 'sync',
  type: 'envFull',
  excelId: 'history'
});

// 确保使用正确的存储对象（这里直接使用 localStorage）
function ensureStorage(storage) {
  if (storage && storage.prefix && typeof storage.getItem === 'function') {
    return storage;
  }
  
  // 创建基础的 localStorage 包装器，使用系统前缀
  return {
    prefix: getSystemPrefix(),
    getItem: (key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    setItem: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };
}

export function saveSyncHistory(storage, history) {
  const s = ensureStorage(storage);
  return s.setItem(STORAGE_KEY, history);
}

export function loadSyncHistory(storage) {
  const s = ensureStorage(storage);
  return s.getItem(STORAGE_KEY) || [];
}

export function createSyncHistoryEntry(syncData) {
  return {
    id: `sync_${Date.now()}`,
    sourceModeId: syncData.sourceModeId,
    targetModeId: syncData.targetModeId,
    cardIds: syncData.cardIds || [],
    ruleId: syncData.ruleId || null,
    fields: syncData.fields || [],
    timestamp: new Date().toISOString(),
    status: syncData.status || 'completed',
    conflictDetected: syncData.conflictDetected || false
  };
}