// src/components/Data/store-parts/subModes.js
// 新版：使用id.js处理存储键，直接操作原生localStorage

import { buildMetaKey } from '../services/id.js';

// 使用id.js构建元数据存储键
const STORAGE_KEY = buildMetaKey({
  version: 'V1',
  name: 'submode_instances'
});

// 工具：检测与读写JSON
function isStorage(obj) {
  return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function';
}

function resolveStorage(storageOrStore) {
  if (isStorage(storageOrStore)) return storageOrStore;
  if (storageOrStore && isStorage(storageOrStore.storage)) return storageOrStore.storage;
  if (storageOrStore?.dataManager?.longTermStorage) return storageOrStore.dataManager.longTermStorage;
  // 默认为localStorage
  return window.localStorage;
}

// 处理原生localStorage的JSON读写
function getJSON(storage, key) {
  if (!storage) return null;
  const val = storage.getItem(key);
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val || null;
}

function setJSON(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Failed to set JSON in storage:', e);
    return false;
  }
}

/**
 * 保存子模式实例到存储
 * @param {Object|Storage} storageOrStore - 存储对象或 store
 * @param {Array} instances - 子模式实例数组
 * @returns {void}
 */
export function saveSubModeInstances(storageOrStore, instances) {
  const storage = resolveStorage(storageOrStore);
  return setJSON(storage, STORAGE_KEY, instances);
}

/**
 * 从存储加载子模式实例
 * @param {Object|Storage} storageOrStore - 存储对象或 store
 * @param {Object} [store] - 状态存储对象
 * @returns {Promise<Array>} 子模式实例数组
 */
export async function loadSubModeInstances(storageOrStore, store) {
  // A版兼容逻辑保留
  if (store && store.dataManager && typeof store.dataManager.loadSubModeInstances === 'function') {
    const instances = await store.dataManager.loadSubModeInstances();
    store.subModes.instances = instances || [];
    if (typeof store.parseSubModeData === 'function') {
      store.subModes.instances.forEach(inst => store.parseSubModeData(inst.id));
    }
    return instances || [];
  }

  // 兼容：如果第一个参数就是带dataManager的store
  if (storageOrStore && storageOrStore.dataManager && typeof storageOrStore.dataManager.loadSubModeInstances === 'function') {
    const instances = await storageOrStore.dataManager.loadSubModeInstances();
    storageOrStore.subModes.instances = instances || [];
    if (typeof storageOrStore.parseSubModeData === 'function') {
      storageOrStore.subModes.instances.forEach(inst => storageOrStore.parseSubModeData(inst.id));
    }
    return instances || [];
  }

  // 新版：使用存储直读
  const storage = resolveStorage(storageOrStore);
  return getJSON(storage, STORAGE_KEY) || [];
}

/**
 * 解析子模式数据
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
