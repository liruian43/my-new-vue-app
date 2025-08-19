// src/components/Data/store-parts/subModes.js
// 合并版：兼容 A 版（store.dataManager）与 B 版（storage），并处理原生 localStorage 与 LocalStorageStrategy 的差异

import { LocalStorageStrategy } from '../storage/LocalStorageStrategy';

const STORAGE_KEY = 'submode_instances';

// 工具：检测与读写JSON
function isStorage(obj) {
  return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function';
}
function resolveStorage(storageOrStore) {
  if (isStorage(storageOrStore)) return storageOrStore;
  if (storageOrStore && isStorage(storageOrStore.storage)) return storageOrStore.storage;
  if (storageOrStore?.dataManager?.longTermStorage) return storageOrStore.dataManager.longTermStorage;
  return null;
}
function getJSON(storage, key) {
  if (!storage) return null;
  const val = storage.getItem(key);
  // LocalStorageStrategy.getItem 已经做了 JSON.parse
  if (storage.prefix) return val || null;
  // 原生 localStorage 的字符串
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val || null;
}
function setJSON(storage, key, value) {
  if (!storage) return false;
  if (storage.prefix) {
    // LocalStorageStrategy 会 JSON.stringify
    return storage.setItem(key, value);
  }
  // 原生 localStorage 需要手动 stringify
  return storage.setItem(key, JSON.stringify(value));
}

/**
 * 保存子模式实例到存储
 * @param {Object|Storage} storageOrStore - 存储对象或 store
 * @param {Array} instances - 子模式实例数组
 * @returns {void}
 */
export function saveSubModeInstances(storageOrStore, instances) {
  const s = resolveStorage(storageOrStore) || new LocalStorageStrategy();
  return setJSON(s, STORAGE_KEY, instances);
}

/**
 * 从存储加载子模式实例（兼容A版和B版）
 * @param {Object|Storage} storageOrStore - 存储对象或 store
 * @param {Object} [store] - 状态存储对象（A版兼容，保持原有第二参数）
 * @returns {Promise<Array>} 子模式实例数组
 */
export async function loadSubModeInstances(storageOrStore, store) {
  // A版：如果提供了store且存在 dataManager，使用 dataManager 加载
  if (store && store.dataManager && typeof store.dataManager.loadSubModeInstances === 'function') {
    const instances = await store.dataManager.loadSubModeInstances();
    store.subModes.instances = instances || [];
    // 如果 store 上存在 parseSubModeData 方法，按你原有逻辑调用
    if (typeof store.parseSubModeData === 'function') {
      store.subModes.instances.forEach(inst => store.parseSubModeData(inst.id));
    }
    return instances || [];
  }

  // 兼容：如果第一个参数就是 store（带 dataManager），也走 A 版
  if (storageOrStore && storageOrStore.dataManager && typeof storageOrStore.dataManager.loadSubModeInstances === 'function') {
    const instances = await storageOrStore.dataManager.loadSubModeInstances();
    storageOrStore.subModes.instances = instances || [];
    if (typeof storageOrStore.parseSubModeData === 'function') {
      storageOrStore.subModes.instances.forEach(inst => storageOrStore.parseSubModeData(inst.id));
    }
    return instances || [];
  }

  // B版：使用存储直读
  const s = resolveStorage(storageOrStore) || new LocalStorageStrategy();
  return getJSON(s, STORAGE_KEY) || [];
}

/**
 * 解析子模式数据（保留你原先签名）
 * @param {Object} store - 状态存储对象
 * @param {string} instanceId - 实例ID
 * @returns {Object|null} 解析后的数据
 */
export function parseSubModeData(store, instanceId) {
  const instance = store.subModes.instances.find(inst => inst.id === instanceId);
  if (!instance) return null;

  const parsedCards = Object.values(store.environmentConfigs.cards).map(card => ({
    ...card,
    displayName: card.name || `卡片 ${card.id}`,
    isEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.CARD_TITLE)
  }));

  const parsedOptions = Object.entries(store.environmentConfigs.options).map(([fullId, option]) => {
    const cardId = fullId.replace(/\d+$/, '');
    const optionId = fullId.replace(cardId, '');
    return {
      fullId,
      cardId,
      optionId,
      ...option,
      displayValue: option.value !== null ? `${option.value}${option.unit || ''}` : '',
      isNameEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.OPTION_NAME),
      isValueEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.OPTION_VALUE),
      isUnitEditable: store.getFieldAuthorization('root_admin', instanceId, store.FIELD_IDS.OPTION_UNIT)
    };
  });

  store.subModes.parsedData[instanceId] = {
    cards: parsedCards,
    options: parsedOptions,
    parsedAt: new Date().toISOString()
  };
  return store.subModes.parsedData[instanceId];
}

/**
 * 创建子模式快照
 * @param {Object} sourceData - 源数据
 * @returns {Object} 快照数据
 */
export function createSubModeSnapshot(sourceData) {
  return JSON.parse(JSON.stringify(sourceData));
}