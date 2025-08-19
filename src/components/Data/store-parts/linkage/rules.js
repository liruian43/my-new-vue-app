// src/components/Data/store-parts/linkage/rules.js
import { LocalStorageStrategy } from '../../storage/LocalStorageStrategy';

const STORAGE_KEY = 'linkage_rules';

function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : new LocalStorageStrategy();
}

export function loadLinkageRules(storage) {
  const s = ensureStorage(storage);
  return s.getItem(STORAGE_KEY) || [];
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

  s.setItem(STORAGE_KEY, valid);
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
  s.setItem(STORAGE_KEY, next);
  return true;
}