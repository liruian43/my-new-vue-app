import { generateModePage as routingGenerate, deleteModePage as routingDelete } from './routing';
import { loadSubModeInstances } from './subModes';

// 常量定义
const CURRENT_MODE_KEY = 'current_mode';
const ROOT_MODE_CONFIG_KEY = 'root_mode_config';
const ROOT_ADMIN_ID = 'root_admin';

/**
 * 获取模式信息（整合两个版本的实现）
 * @param {Object} store - 状态存储对象
 * @param {Object} storage - 存储对象（如localStorage）
 * @param {string} modeId - 模式ID
 * @returns {Object|null} 模式信息
 */
export function getMode(store, storage, modeId) {
  if (modeId === ROOT_ADMIN_ID) {
    // 整合根模式信息，同时保留store中的根模式数据
    return {
      id: ROOT_ADMIN_ID,
      name: '主模式',
      description: '系统主模式，包含所有源数据',
      isRoot: true,
      permissions: {
        card: { editOptions: true },
        data: { save: true }
      },
      ...store.rootMode // 合并第一个版本中store的rootMode数据
    };
  }
  
  // 优先从store获取，没有则从storage加载
  const storeMode = store.modes.find(mode => mode.id === modeId);
  if (storeMode) return storeMode;
  
  const storageModes = loadSubModeInstances(storage);
  return storageModes.find(m => m.id === modeId) || null;
}

/**
 * 添加新模式
 * @param {Object} store - 状态存储对象
 * @param {Object} modeData - 模式数据
 * @returns {Object|null} 新创建的模式
 */
export function addMode(store, modeData) {
  if (modeData.id === ROOT_ADMIN_ID || modeData.name === '根模式（源数据区）' || modeData.name === '主模式') {
    store.error = '不能创建与主模式同名或同ID的模式';
    return null;
  }
  
  const newMode = {
    id: modeData.id || `mode-${crypto.randomUUID?.() || Date.now()}`,
    ...modeData,
    level: 2,
    isUserMode: true,
    syncInfo: {
      lastSyncTime: null,
      syncFields: [],
      authFields: [],
      syncedCardIds: []
    }
  };
  
  store.modes.push(newMode);
  routingGenerate(store, newMode);
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes));
  return newMode;
}

/**
 * 删除模式
 * @param {Object} store - 状态存储对象
 * @param {Array<string>} modeIds - 要删除的模式ID列表
 */
export function deleteModes(store, modeIds) {
  const filteredIds = modeIds.filter(id => id !== ROOT_ADMIN_ID);
  if (filteredIds.length === 0) return;

  filteredIds.forEach(modeId => {
    routingDelete(store, modeId);
  });

  store.modes = store.modes.filter(mode => !filteredIds.includes(mode.id));

  filteredIds.forEach(modeId => {
    if (store.modeRoutes[modeId]) {
      delete store.modeRoutes[modeId];
    }
  });

  localStorage.setItem('app_user_modes', JSON.stringify(store.modes));

  // 使用setCurrentModeId更新当前模式ID
  if (filteredIds.includes(store.currentModeId)) {
    setCurrentModeId(localStorage, ROOT_ADMIN_ID);
    store.currentModeId = ROOT_ADMIN_ID;
  }
}

/**
 * 获取当前模式ID
 * @param {Object} storage - 存储对象
 * @returns {string} 当前模式ID
 */
export function getCurrentModeId(storage) {
  return storage.getItem(CURRENT_MODE_KEY) || ROOT_ADMIN_ID;
}

/**
 * 设置当前模式ID
 * @param {Object} storage - 存储对象
 * @param {string} modeId - 要设置的模式ID
 */
export function setCurrentModeId(storage, modeId) {
  return storage.setItem(CURRENT_MODE_KEY, modeId);
}

/**
 * 保存模式到存储（整合两个版本的保存逻辑）
 * @param {Object} store - 状态存储对象
 * @param {Object} storage - 存储对象
 */
export function saveModesToStorage(store, storage) {
  // 保存用户模式
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes));
  
  // 保存根模式配置（包含第二个版本的时间戳）
  const rootConfig = {
    cardData: store.rootMode.cardData,
    dataStandards: store.rootMode.dataStandards,
    updatedAt: new Date().toISOString() // 新增时间戳
  };
  storage.setItem(ROOT_MODE_CONFIG_KEY, JSON.stringify(rootConfig));
}

/**
 * 获取根模式配置
 * @param {Object} storage - 存储对象
 * @returns {Object} 根模式配置
 */
export function getRootModeConfig(storage) {
  const config = storage.getItem(ROOT_MODE_CONFIG_KEY);
  return config ? JSON.parse(config) : {};
}
