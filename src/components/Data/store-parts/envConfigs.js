// src/components/Data/store-parts/envConfigs.js
// 合并版：支持 manager（传 storage）与 store（传 store）
// 采用五段 Key 落盘 + 保存前硬校验（结构存在性）
// 空值与结构统一交由 utils/emptiness.js 负责
// 现在引用独立的序列化模块，保持接口兼容

import {
  ID // 导入 ID 聚合对象，包含所有 ID 相关函数和常量
} from '../services/id.js';

// 导入独立的序列化/反序列化模块
import {
  Serialization,
  stableStringify,
  hashString,
  normalizeCards,
  normalizeOptions,
  buildEnvironmentFromSession,
  buildFullConfigs,
  loadEnvironmentConfigs,
  saveEnvironmentConfigs,
  saveEnvFullSnapshot,
  applyEnvFullSnapshot,
  listEnvFullSnapshots,
  getAllOptionsByCardId
} from './serialization.js';

// 导入空值处理工具
import {
  toNull,
  ensureEnvironmentShape,
  hasAtLeastOneCardAndOptionInSession
} from '../utils/emptiness.js';

// ========== 序列化功能重新导出（保持兼容性） ==========
// 所有序列化相关功能现在从独立模块导入并重新导出
// 这样主模式可以继续通过envConfigs.js使用这些功能，保持原有调用方式

// 重新导出序列化工具函数
export { stableStringify, hashString };

// 重新导出数据规范化函数 
export { normalizeCards, normalizeOptions, buildEnvironmentFromSession, buildFullConfigs };

// 重新导出核心序列化/反序列化功能
export { 
  loadEnvironmentConfigs, 
  saveEnvironmentConfigs, 
  saveEnvFullSnapshot, 
  applyEnvFullSnapshot, 
  listEnvFullSnapshots 
};

// 重新导出辅助工具
export { getAllOptionsByCardId };

// 访问内部工具的便捷方式
const storageKeyForEnv = Serialization._internal.storageKeyForEnv;

// ========== 小工具 ==========
const _arr = (x) => Array.isArray(x) ? x : [];

// 存储工具函数现在从序列化模块获取
const { resolveStorage, getJSON, setJSON, maybeMigrateLegacyEnv } = Serialization._internal;

// ========== 扩展功能（envConfigs.js 特有） ==========
// 这些是 envConfigs.js 特有的扩展功能，不在序列化模块中

// 问题上下文相关功能
export async function saveQuestionContext(store, questionId, contextData) {
  const qid = String(questionId || '').trim();
  if (!qid) return false;
  const currentConfigs = await loadEnvironmentConfigs(store);
  const list = _arr(currentConfigs.contextTemplates);
  const idx = list.findIndex(x => x?.questionId === qid);
  const record = {
    questionId: qid,
    content: contextData?.content ?? '',
    createdAt: new Date().toISOString()
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...record };
  else list.push(record);
  return saveEnvironmentConfigs(store, { ...currentConfigs, contextTemplates: list });
}

export async function getQuestionContext(store, questionId) {
  const qid = String(questionId || '').trim();
  const currentConfigs = await loadEnvironmentConfigs(store);
  const list = _arr(currentConfigs.contextTemplates);
  return list.find(x => x?.questionId === qid) || null;
}

export function notifyEnvConfigChanged(/* store */) {
  return true;
}

// ========== 创建规则相关功能 ==========
export function createScoringRule(ruleData) {
  return {
    id: ruleData.id || `rule_${Date.now()}`,
    name: toNull(ruleData.name),
    description: toNull(ruleData.description),
    type: ruleData.type || 'exact_match',
    parameters: ruleData.parameters || {},
    score: ruleData.score || 0,
    createdAt: new Date().toISOString()
  };
}