import { getLinkageRule } from './rules';
import { applyTransform } from './transforms';
import { getNestedValue, setNestedValue } from '../../utils/objectPath';
import * as Sync from '../sync';
import * as LongTerm from '../../services/longTerm';
// 导入id.js中的方法替代LocalStorageStrategy
import { buildKey, getSystemPrefix } from '../../services/id.js';

// 实现基础的localStorage操作，使用id.js生成键名
const storageOperations = {
  // 获取系统前缀作为存储命名空间
  getPrefix: () => getSystemPrefix(),
  
  // 使用id.js的buildKey生成规范的存储键
  getItem: (keyConfig) => {
    try {
      const key = buildKey(keyConfig);
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('获取存储数据失败:', error);
      return null;
    }
  },
  
  // 存储数据
  setItem: (keyConfig, value) => {
    try {
      const key = buildKey(keyConfig);
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('存储数据失败:', error);
      return false;
    }
  },
  
  // 删除数据
  removeItem: (keyConfig) => {
    try {
      const key = buildKey(keyConfig);
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('删除存储数据失败:', error);
      return false;
    }
  }
};

// 确保存储对象有效
function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : storageOperations;
}

function createEmptyCard(targetCardId, targetModeId) {
  return {
    id: targetCardId,
    modeId: targetModeId,
    data: {
      title: null,
      options: [{ name: null, value: null, unit: null }],
      selectOptions: []
    },
    syncStatus: {
      title: { hasSync: false, isAuthorized: false },
      options: {
        name: { hasSync: false, isAuthorized: false },
        value: { hasSync: false, isAuthorized: false },
        unit: { hasSync: false, isAuthorized: false }
      },
      selectOptions: { hasSync: true, isAuthorized: false }
    }
  };
}

async function executeRule(ctx, rule) {
  const storage = ensureStorage(ctx?.storage);
  const syncedCardIds = [];
  let conflictDetected = false;

  for (const cardMapping of rule.cardMappings || []) {
    if (!cardMapping?.isEnabled) continue;

    const sourceCard = LongTerm.getFromLongTerm(storage, rule.sourceModeId, 'cards', cardMapping.sourceCardId);
    if (!sourceCard) {
      console.warn(`源卡片 ${cardMapping.sourceCardId} 不存在，跳过同步`);
      continue;
    }

    let targetCard = LongTerm.getFromLongTerm(storage, rule.targetModeId, 'cards', cardMapping.targetCardId);
    if (!targetCard) {
      targetCard = createEmptyCard(cardMapping.targetCardId, rule.targetModeId);
    }

    for (const mapping of cardMapping.fieldMappings || []) {
      if (!mapping?.isEnabled) continue;
      const sourceValue = getNestedValue(sourceCard.data, mapping.sourceField);
      if (sourceValue === undefined) continue;

      const transformedValue = applyTransform(sourceValue, mapping.transform, { sourceCard, targetCard });
      setNestedValue(targetCard.data, mapping.targetField, transformedValue);
      targetCard = Sync.updateCardSyncStatus(targetCard, mapping.targetField);
    }

    LongTerm.saveToLongTerm(storage, rule.targetModeId, 'cards', cardMapping.targetCardId, targetCard);
    syncedCardIds.push(cardMapping.targetCardId);
  }

  const entry = Sync.createSyncHistoryEntry({
    sourceModeId: rule.sourceModeId,
    targetModeId: rule.targetModeId,
    cardIds: syncedCardIds,
    ruleId: rule.id || null,
    status: conflictDetected ? 'completed_with_conflicts' : 'completed',
    conflictDetected
  });
  const history = Sync.loadSyncHistory(storage);
  history.push(entry);
  Sync.saveSyncHistory(storage, history);

  return {
    success: true,
    syncedCards: syncedCardIds.length,
    conflictDetected,
    historyId: entry.id
  };
}

export async function executeLinkage(ctx, ruleId) {
  const storage = ensureStorage(ctx?.storage);
  const rule = getLinkageRule(storage, ruleId);
  if (!rule || !rule.isEnabled) throw new Error('联动规则不存在或未启用');
  return executeRule({ storage }, rule);
}

export async function executeReverseLinkage(ctx, rule) {
  const storage = ensureStorage(ctx?.storage);
  const reversed = {
    ...rule,
    id: `rev_${rule.id || 'temp'}`,
    sourceModeId: rule.targetModeId,
    targetModeId: rule.sourceModeId,
    cardMappings: (rule.cardMappings || []).map(m => ({
      ...m,
      sourceCardId: m.targetCardId,
      targetCardId: m.sourceCardId
    }))
  };
  return executeRule({ storage }, reversed);
}
