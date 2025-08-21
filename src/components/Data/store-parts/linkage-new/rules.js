// src/components/Data/store-parts/linkage-new/rules.js
import { buildKey, getSystemPrefix } from '../../services/id.js';

// 使用系统前缀构建存储键
const STORAGE_KEY = buildKey({
  version: 'linkage',
  type: 'envFull',
  excelId: 'rules'
});

// 确保使用有效的存储对象，默认为localStorage
function ensureStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : localStorage;
}

export function loadLinkageRules(storage) {
  const s = ensureStorage(storage);
  try {
    const data = s.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载联动规则失败:', error);
    return [];
  }
}

export function saveLinkageRules(storage, rules, validator /* 可选 */) {
  const s = ensureStorage(storage);
  const valid = [];
  const invalid = [];

  const list = Array.isArray(rules) ? rules : [];
  list.forEach(rule => {
    let pass = true;
    let errors = [];

    if (validator?.validateLinkageRule) {
      const res = validator.validateLinkageRule(rule);
      pass = !!res.pass;
      errors = res.errors || [];
    }

    if (pass) {
      valid.push({
        ...rule,
        updatedAt: new Date().toISOString()
      });
    } else {
      invalid.push({ ...rule, validationErrors: errors });
    }
  });

  if (invalid.length > 0) {
    console.warn('部分联动规则无效，已跳过保存:', invalid);
  }

  try {
    s.setItem(STORAGE_KEY, JSON.stringify(valid));
  } catch (error) {
    console.error('保存联动规则失败:', error);
  }
  return valid;
}

export function createLinkageRule(ruleData = {}, rootAdminId = 'root_admin') {
  const defaultFieldMapping = {
    sourceField: '',
    targetField: '',
    transform: null,
    isEnabled: true
  };

  const defaultCardMapping = {
    sourceCardId: '',
    targetCardId: '',
    fieldMappings: [defaultFieldMapping],
    isEnabled: true
  };

  const normalizedCardMappings =
    Array.isArray(ruleData.cardMappings) && ruleData.cardMappings.length > 0
      ? ruleData.cardMappings.map(cm => ({
          ...defaultCardMapping,
          ...cm,
          fieldMappings:
            Array.isArray(cm.fieldMappings) && cm.fieldMappings.length > 0
              ? cm.fieldMappings.map(fm => ({ ...defaultFieldMapping, ...fm }))
              : [defaultFieldMapping]
        }))
      : [defaultCardMapping];

  return {
    id: ruleData.id || `linkage_${Date.now()}`,
    name: ruleData.name ?? '未命名联动规则',
    description: ruleData.description ?? null,
    sourceModeId: ruleData.sourceModeId || rootAdminId,
    targetModeId: ruleData.targetModeId || '',
    cardMappings: normalizedCardMappings,
    isEnabled: ruleData.isEnabled !== undefined ? !!ruleData.isEnabled : true,
    syncDirection: ruleData.syncDirection || 'one_way',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function getLinkageRule(storage, ruleId) {
  const s = ensureStorage(storage);
  const rules = loadLinkageRules(s);
  return rules.find(r => r.id === ruleId) || null;
}

export function deleteLinkageRule(storage, ruleId) {
  const s = ensureStorage(storage);
  const rules = loadLinkageRules(s);
  const next = rules.filter(r => r.id !== ruleId);
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('删除联动规则失败:', error);
    return false;
  }
  return true;
}
