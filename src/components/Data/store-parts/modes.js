// 常量定义
const CURRENT_MODE_KEY = 'current_mode';
const ROOT_MODE_CONFIG_KEY = 'root_mode_config';
const ROOT_ADMIN_ID = 'root_admin';

/**
 * 获取模式信息（只支持主模式）
 * @param {Object} store - 状态存储对象
 * @param {Object} storage - 存储对象
 * @param {string} modeId - 模式ID（只处理root_admin）
 * @returns {Object} 主模式信息
 */
export function getMode(store, storage, modeId) {
  // 无论传入什么ID，都只返回主模式信息
  return {
    id: ROOT_ADMIN_ID,
    name: '主模式',
    description: '系统主模式，包含所有源数据',
    isRoot: true,
    permissions: {
      card: { editOptions: true },
      data: { save: true }
    },
    ...store.rootMode
  };
}

/**
 * 获取当前模式ID（固定返回root_admin）
 * @param {Object} storage - 存储对象
 * @returns {string} 始终返回root_admin
 */
export function getCurrentModeId(storage) {
  return ROOT_ADMIN_ID;
}

/**
 * 设置当前模式ID（固定为root_admin）
 * @param {Object} storage - 存储对象
 * @param {string} modeId - 忽略传入值，强制设置为root_admin
 */
export function setCurrentModeId(storage, modeId) {
  return storage.setItem(CURRENT_MODE_KEY, ROOT_ADMIN_ID);
}

/**
 * 保存模式到存储（只保存主模式配置）
 * @param {Object} store - 状态存储对象
 * @param {Object} storage - 存储对象
 */
export function saveModesToStorage(store, storage) {
  // 只保存根模式配置
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
    