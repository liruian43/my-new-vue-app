// src/components/Data/services/longTerm.js
import { LocalStorageStrategy } from '../storage/LocalStorageStrategy';

function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : new LocalStorageStrategy();
}

export function buildKey(modeId, namespace, dataId) {
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
  return s.setItem(key, {
    ...data,
    modeId,
    namespace,
    storedAt: new Date().toISOString()
  });
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
  const prefix = s.prefix || 'app_long_term_';
  const startsWith = `${prefix}long-term:${modeId}:`;

  Object.keys(localStorage).forEach(k => {
    if (k.startsWith(startsWith)) {
      localStorage.removeItem(k);
    }
  });
}