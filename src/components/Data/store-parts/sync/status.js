import { getSystemPrefix } from '../../services/id.js';
import { loadSyncHistory } from './history';
import { CARD_DATA_TEMPLATE } from '../cards';

// 确保存储对象有效，使用浏览器本地存储
function ensureStorage(storage) {
  // 检查传入的storage是否有效，无效则使用默认localStorage
  if (storage && storage.prefix && typeof storage.getItem === 'function') {
    return storage;
  }
  
  // 创建基于localStorage的默认存储对象
  const prefix = getSystemPrefix();
  return {
    prefix,
    getItem: (key) => {
      const fullKey = `${prefix}:${key}`;
      return localStorage.getItem(fullKey);
    },
    setItem: (key, value) => {
      const fullKey = `${prefix}:${key}`;
      return localStorage.setItem(fullKey, value);
    },
    removeItem: (key) => {
      const fullKey = `${prefix}:${key}`;
      return localStorage.removeItem(fullKey);
    }
  };
}

export function getSyncStatus(storage, itemId) {
  const s = ensureStorage(storage);
  const syncHistory = loadSyncHistory(s);
  const latestSync = syncHistory
    .filter(entry => (entry.cardIds || []).includes(itemId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  if (!latestSync) {
    return { hasSync: false, hasConflict: false };
  }
  return {
    hasSync: true,
    hasConflict: latestSync.conflictDetected || false,
    lastSync: latestSync.timestamp
  };
}

export function updateCardSyncStatus(card, field) {
  if (!card.syncStatus) {
    card.syncStatus = { ...CARD_DATA_TEMPLATE.syncStatus };
  }
  if (field.startsWith('title')) {
    card.syncStatus.title = { hasSync: true, isAuthorized: true };
  } else if (field.startsWith('options.name')) {
    card.syncStatus.options.name = { hasSync: true, isAuthorized: true };
  } else if (field.startsWith('options.value')) {
    card.syncStatus.options.value = { hasSync: true, isAuthorized: true };
  } else if (field.startsWith('options.unit')) {
    card.syncStatus.options.unit = { hasSync: true, isAuthorized: true };
  }
  return card;
}
