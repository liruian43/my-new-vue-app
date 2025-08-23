// 常量定义
const CURRENT_MODE_KEY = 'current_mode';
const ROOT_MODE_CONFIG_KEY = 'root_mode_config';
const ROOT_ADMIN_ID = 'root_admin';

/**
 * 获取模式信息（仅保留基础实现）
 * @param {Object} store - 状态存储对象
 * @param {Object} storage - 存储对象（如localStorage）
 * @param {string} modeId - 模式ID
 * @returns {Object|null} 模式信息
 */
export function getMode(store, storage, modeId) {
  if (modeId === ROOT_ADMIN_ID) {
    // 仅保留主模式基础信息
    return {
      id: ROOT_ADMIN_ID,
      name: '主模式',
      description: '系统主模式，包含所有源数据',
      isRoot: true,
      permissions: {
        card: { editOptions: true },
        data: { save: true }
      },
      ...store.rootMode // 保留主模式数据
    };
  }
  
  // 仅从store获取模式信息（删除subModes相关逻辑）
  return store.modes.find(mode => mode.id === modeId) || null;
}

/**
 * 添加新模式（移除路由相关逻辑）
 * @param {Object} store - 状态存储对象
 * @param {Object} modeData - 模式数据
 * @returns {Object|null} 新创建的模式
 */
export function addMode(store, modeData) {
  // 防止创建与主模式冲突的模式
  if (modeData.id === ROOT_ADMIN_ID || modeData.name === '根模式（源数据区）' || modeData.name === '主模式') {
    store.error = '不能创建与主模式同名或同ID的模式';
    return null;
  }
  
  const newMode = {
    id: modeData.id || `mode-${crypto.randomUUID?.() || Date.now()}`,
    ...modeData,
    level: 2,
    isUserMode: true,
    // 简化同步信息（仅保留必要字段）
    syncInfo: {
      lastSyncTime: null
    }
  };
  
  store.modes.push(newMode);
  // 仅保留本地存储逻辑（删除路由生成相关代码）
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes));
  return newMode;
}

/**
 * 删除模式（移除路由相关逻辑）
 * @param {Object} store - 状态存储对象
 * @param {Array<string>} modeIds - 要删除的模式ID列表
 */
export function deleteModes(store, modeIds) {
  // 不允许删除主模式
  const filteredIds = modeIds.filter(id => id !== ROOT_ADMIN_ID);
  if (filteredIds.length === 0) return;

  // 删除模式（移除路由删除相关代码）
  store.modes = store.modes.filter(mode => !filteredIds.includes(mode.id));

  // 清除模式路由配置（如果存在）
  filteredIds.forEach(modeId => {
    if (store.modeRoutes?.[modeId]) {
      delete store.modeRoutes[modeId];
    }
  });

  // 更新本地存储
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes));

  // 处理当前模式被删除的情况
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
 * 保存模式到存储（简化版）
 * @param {Object} store - 状态存储对象
 * @param {Object} storage - 存储对象
 */
export function saveModesToStorage(store, storage) {
  // 保存用户模式
  localStorage.setItem('app_user_modes', JSON.stringify(store.modes));
  
  // 保存根模式配置
  const rootConfig = {
    cardData: store.rootMode.cardData,
    dataStandards: store.rootMode.dataStandards,
    updatedAt: new Date().toISOString()
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
