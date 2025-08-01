// src/utils/modeCoordinator.js
// 注意：这里假设你的模式数据和卡片数据都在同一个store里
// 如果不是，就改成正确的store导入路径（比如单独的modeStore.js）
import { useCardStore } from '../components/Data/store'; 

// 校验跨模式同步权限
export const checkSyncPermission = (sourceModeId, targetModeId) => {
  const cardStore = useCardStore(); // 用同一个store获取模式数据
  const sourceMode = cardStore.getMode(sourceModeId);
  const targetMode = cardStore.getMode(targetModeId);
  
  // 加个判断，避免模式不存在时报错
  if (!sourceMode || !targetMode) {
    console.warn('源模式或目标模式不存在');
    return false;
  }
  
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
  const cardStore = useCardStore();
  const syncableFields = cardStore.getMode(sourceModeId)?.permissions?.syncableFields || [];
  
  return Object.keys(data).reduce((result, key) => {
    if (syncableFields.includes(key)) {
      result[key] = data[key];
    }
    return result;
  }, {});
};

// 联动核心函数
export const coordinateMode = (linkageConfig) => {
  const { targetMode, targetModeIds, sync, auth } = linkageConfig;
  const cardStore = useCardStore(); // 统一用cardStore获取数据
  
  // 获取当前激活的模式作为数据源
  const sourceModeId = cardStore.activeModeId; // 假设当前激活模式存在这里
  
  if (!sourceModeId) {
    throw new Error('请先选择一个源模式');
  }
  
  // 同步到所有模式
  if (targetMode === '所有模式' && targetModeIds.length) {
    targetModeIds.forEach(targetId => {
      syncToTargetMode(sourceModeId, targetId, sync, auth);
    });
  } 
  // 同步到单个模式
  else if (targetModeIds[0]) {
    syncToTargetMode(sourceModeId, targetModeIds[0], sync, auth);
  }
};

// 辅助函数：实际执行同步到目标模式的逻辑
function syncToTargetMode(sourceId, targetId, syncFields, authFields) {
  // 1. 检查权限
  if (!checkSyncPermission(sourceId, targetId)) {
    console.warn(`无法同步到模式${targetId}：权限不足`);
    return;
  }
  
  // 2. 获取源模式的卡片数据
  const cardStore = useCardStore();
  const sourceCards = cardStore.getCardsByMode(sourceId);
  
  // 3. 同步每个卡片的数据
  sourceCards.forEach(card => {
    // 过滤出需要同步的字段
    const dataToSync = syncFields.reduce((data, field) => {
      if (card[field] !== undefined) {
        data[field] = card[field];
      }
      return data;
    }, {});
    
    // 4. 执行同步（通过store更新目标模式的卡片）
    cardStore.syncCardToMode(card.id, targetId, dataToSync, authFields);
  });
  
  console.log(`已成功同步数据从模式${sourceId}到模式${targetId}`);
}
