// src/utils/modeCoordinator.js
import { useModeStore } from '../components/Mode/store'; // 假设模式的核心状态在这里

// 校验跨模式同步权限
export const checkSyncPermission = (sourceModeId, targetModeId) => {
  const modeStore = useModeStore();
  const sourceMode = modeStore.getMode(sourceModeId);
  const targetMode = modeStore.getMode(targetModeId);
  
  // 金字塔规则：只能高层同步到低层
  return sourceMode.level > targetMode.level 
    && sourceMode.permissions.canSyncDown 
    && targetMode.permissions.canReceiveSync;
};

// 执行数据同步（从源模式到目标模式）
export const syncDataBetweenModes = (sourceModeId, targetModeId, data) => {
  // 先校验权限
  if (!checkSyncPermission(sourceModeId, targetModeId)) {
    throw new Error('跨模式同步权限不足');
  }
  
  // 过滤数据：只同步源模式有权限同步的字段
  const filteredData = filterSyncableData(data, sourceModeId);
  
  return filteredData; // 交给 store 处理实际的更新
};

// 辅助函数：过滤可同步的字段
const filterSyncableData = (data, sourceModeId) => {
  const modeStore = useModeStore();
  const syncableFields = modeStore.getMode(sourceModeId).permissions.syncableFields;
  
  return Object.keys(data).reduce((result, key) => {
    if (syncableFields.includes(key)) {
      result[key] = data[key];
    }
    return result;
  }, {});
};