// src/components/Data/store-parts/serialization.js
// 序列化与反序列化核心功能模块
// 职责：提供独立的数据序列化、反序列化、存储和加载功能
// 供其他模式直接引用使用，同时保持与 envConfigs.js 的兼容性

import {
  ID // 导入 ID 聚合对象，包含所有 ID 相关函数和常量
} from '../services/id.js';

import {
  toNull,
  ensureEnvironmentShape,
  hasAtLeastOneCardAndOptionInSession
} from '../utils/emptiness.js';

// ========== 核心序列化工具函数 ==========

/**
 * 稳定化 JSON 序列化（对象键排序，避免循环引用）
 * @param {any} obj 要序列化的对象
 * @returns {string} 稳定化的 JSON 字符串
 */
export function stableStringify(obj) {
  const seen = new WeakSet();
  const recur = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(recur);
    const keys = Object.keys(v).sort();
    const out = {};
    for (const k of keys) {
      const val = v[k];
      if (val === undefined) continue;
      out[k] = recur(val);
    }
    return out;
  };
  return JSON.stringify(recur(obj));
}

/**
 * 字符串哈希计算
 * @param {string} str 输入字符串
 * @returns {string} 8位十六进制哈希值
 */
export function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h = h | 0;
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

// ========== 存储适配器工具 ==========

/**
 * 检查对象是否为存储接口
 * @param {any} obj 待检查对象
 * @returns {boolean} 是否为存储接口
 */
function isStorage(obj) {
  return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function';
}

/**
 * 从上下文中解析存储对象
 * @param {any} arg 上下文参数
 * @returns {Storage|null} 存储对象或null
 */
function resolveStorage(arg) {
  if (isStorage(arg)) return arg;
  if (arg && isStorage(arg.storage)) return arg.storage;
  // 确保 dataManager 路径正确，并且 longTermStorage 存在
  if (arg?.dataManager?.longTermStorage && isStorage(arg.dataManager.longTermStorage)) {
    return arg.dataManager.longTermStorage;
  }
  // 如需兜底到 window.localStorage，可放开下一行：
  // if (typeof window !== 'undefined' && isStorage(window.localStorage)) return window.localStorage;
  return null;
}

/**
 * 从存储中获取 JSON 数据
 * @param {Storage} storage 存储对象
 * @param {string} key 存储键
 * @returns {any} 解析后的数据或null
 */
function getJSON(storage, key) {
  if (!storage) return null;
  const val = storage.getItem(key);
  // 兼容可能存在的"自带 JSON 序列化"的适配器（通过存在 prefix 字段粗略判断）
  if (storage.prefix) return val || null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val || null;
}

/**
 * 向存储中保存 JSON 数据
 * @param {Storage} storage 存储对象
 * @param {string} key 存储键
 * @param {any} value 要保存的数据
 * @returns {boolean} 是否保存成功
 */
function setJSON(storage, key, value) {
  if (!storage) return false;
  // 兼容可能存在的"自带 JSON 序列化"的适配器
  if (storage.prefix) return storage.setItem(key, value);
  console.log('[序列化] 保存的数据:', value);
  return storage.setItem(key, JSON.stringify(value));
}

// ========== 五段Key生成工具 ==========

/**
 * 从上下文获取版本信息
 * @param {any} ctx 上下文对象
 * @returns {string} 规范化的版本号
 */
function getVersionFromCtx(ctx) {
  return ID.normalizeVersionLabel(
    ctx?.currentVersion || ctx?.version || ctx?.versionLabel || 'GLOBAL'
  );
}

/**
 * 从上下文获取模式ID
 * @param {any} ctx 上下文对象
 * @returns {string} 规范化的模式ID
 */
function getModeIdFromCtx(ctx) {
  return ID.normalizeModeId(ctx?.currentModeId || ID.ROOT_ADMIN_MODE_ID);
}

/**
 * 生成环境配置的存储键
 * @param {any} ctx 上下文对象
 * @returns {string} 五段式存储键
 */
function storageKeyForEnv(ctx) {
  const modeId = getModeIdFromCtx(ctx);
  const version = getVersionFromCtx(ctx);
  return ID.buildKey({
    modeId,
    version,
    type: ID.TYPES.ENV_FULL,
    excelId: 'A0' // 合法且不会与真实业务冲突（选项 0 不会被生成）
  });
}

// ========== 数据规范化函数 ==========

const _arr = (x) => Array.isArray(x) ? x : [];

/**
 * 规范化卡片数据
 * @param {any} store 存储上下文
 * @param {Array} cards 卡片数组
 * @returns {Object} 规范化后的卡片对象
 */
export function normalizeCards(store, cards) {
  const out = {};
  for (const c of _arr(cards)) {
    const id = String(c?.id || '').trim();
    if (!id) continue;
    out[id] = {
      id,
      title: toNull(c?.title),
      // dropdown 永远是 string[]（空项允许为空串）
      dropdown: _arr(c?.dropdown || c?.selectOptions).map(opt => String(opt?.label ?? opt ?? ''))
    };
  }
  return out;
}

/**
 * 规范化选项数据
 * @param {any} store 存储上下文
 * @param {Array} options 选项数组
 * @returns {Object} 规范化后的选项对象
 */
export function normalizeOptions(store, options) {
  const out = {};
  for (const o of _arr(options)) {
    const rawCard = String(o?.cardId || o?.card || '').trim();
    const rawOpt = String(o?.id || o?.optionId || '').trim();
    const rawFull = String(o?.fullId || '').trim();

    let cardId = null;
    let optionId = null;
    let fullId = null;

    // 优先信任 fullId（若有效）
    if (rawFull) {
      const parsed = ID.parseFullOptionId(String(rawFull).toUpperCase());
      if (parsed.valid) {
        cardId = parsed.cardId;
        optionId = parsed.optionId;
        fullId = ID.buildFullOptionId(cardId, optionId);
      }
    }

    // 其次用 cardId + optionId 组合
    if (!fullId && rawCard && rawOpt) {
      try {
        const c = ID.normalizeCardId(rawCard);
        const o2 = ID.normalizeOptionId(rawOpt);
        cardId = c;
        optionId = o2;
        fullId = ID.buildFullOptionId(c, o2);
      } catch {
        // 无效则跳过
      }
    }

    if (!fullId || !cardId || !optionId) continue;

    out[fullId] = {
      name: toNull(o?.name),
      value: toNull(o?.value),
      unit: toNull(o?.unit)
    };
  }
  return out;
}

/**
 * 从会话数据构建环境配置
 * @param {any} store 存储上下文
 * @returns {Object} 构建的环境配置对象
 */
export function buildEnvironmentFromSession(store) {
  const env = { cards: {}, options: {} };
  const cards = _arr(store.sessionCards)
    .slice()
    .sort((a, b) => ID.compareCardIds(String(a.id), String(b.id)));

  for (const card of cards) {
    const rawId = String(card.id);
    if (!ID.isValidCardId(rawId)) continue;
    const cardId = ID.normalizeCardId(rawId);

    env.cards[cardId] = {
      id: cardId,
      title: toNull(card?.data?.title),
      // dropdown 按 string[] 存储，UI 的 selectOptions -> label
      dropdown: _arr(card?.data?.selectOptions).map(opt => String(opt?.label ?? ''))
    };

    const opts = _arr(card?.data?.options);
    opts.forEach((opt, idx) => {
      // 运行态使用 1..N 连续编号入 env；存储时不因内容为空而过滤
      const optionId = ID.normalizeOptionId(String(idx + 1));
      const combinedId = ID.buildFullOptionId(cardId, optionId);
      env.options[combinedId] = {
        name: toNull(opt?.name),
        value: toNull(opt?.value),
        unit: toNull(opt?.unit)
      };
    });
  }
  // 使用工具函数确保最终结构合规
  return ensureEnvironmentShape(env);
}

/**
 * 构建完整配置对象
 * @param {Object} env 环境配置对象
 * @returns {Object} 完整配置对象
 */
export function buildFullConfigs(env) {
  const full = {};
  const cards = env.cards || {};
  const options = env.options || {};

  Object.keys(options).forEach(combinedId => {
    const parsed = ID.parseFullOptionId(String(combinedId).toUpperCase());
    if (!parsed.valid) return;
    const cardId = parsed.cardId;
    const optionId = parsed.optionId;
    const c = cards[cardId] || {};
    const o = options[combinedId] || {};

    full[combinedId] = {
      combinedId: ID.buildFullOptionId(cardId, optionId),
      cardId,
      optionId,
      configTitle: c.title ?? null,
      optionName: o.name ?? null,
      optionValue: o.value ?? null,
      optionUnit: o.unit ?? null,
      dropdownFlag: false
    };
  });

  return full;
}

// ========== 核心序列化/反序列化功能 ==========

/**
 * 加载环境配置（反序列化）
 * @param {any} ctx 上下文对象，可以是 storage 或 store
 * @returns {Promise<Object>} 加载的环境配置
 */
export async function loadEnvironmentConfigs(ctx) {
  // 若传入的是 storage 或可解析到 storage
  const s = resolveStorage(ctx);
  if (s) {
    const key = storageKeyForEnv(ctx);
    maybeMigrateLegacyEnv(s, key);
    const stored = getJSON(s, key);
    console.log('[反序列化] 恢复的数据:', stored);

    const shaped = ensureEnvironmentShape(stored || { cards: {}, options: {} });
    return {
      ...shaped,
      uiPresets: _arr(stored?.uiPresets),
      scoringRules: _arr(stored?.scoringRules),
      contextTemplates: _arr(stored?.contextTemplates),
      linkageSettings: stored?.linkageSettings || {
        autoSync: false,
        syncInterval: 300000,
        conflictResolution: 'source_wins'
      }
    };
  }

  // 兼容：如果是老版 dataManager（store）
  if (typeof ctx?.dataManager?.loadEnvironmentConfigs === 'function') {
    const data = await ctx.dataManager.loadEnvironmentConfigs(getModeIdFromCtx(ctx));
    console.log('[反序列化] 恢复的数据:', data);
    const shaped = ensureEnvironmentShape(data || { cards: {}, options: {} });
    return {
      ...shaped,
      uiPresets: _arr(data?.uiPresets),
      scoringRules: _arr(data?.scoringRules),
      contextTemplates: _arr(data?.contextTemplates),
      linkageSettings: data?.linkageSettings || {
        autoSync: false,
        syncInterval: 300000,
        conflictResolution: 'source_wins'
      }
    };
  }

  // 兜底默认值（shape）
  const defaultData = ensureEnvironmentShape({
    cards: {},
    options: {},
    uiPresets: [],
    scoringRules: [],
    contextTemplates: [],
    linkageSettings: {
      autoSync: false,
      syncInterval: 300000,
      conflictResolution: 'source_wins'
    }
  });
  console.log('[反序列化] 恢复的数据:', defaultData);
  return defaultData;
}

/**
 * 保存环境配置（序列化）
 * @param {any} ctx 上下文对象，可以是 storage 或 store
 * @param {Object} configs 要保存的配置
 * @returns {Promise<boolean>} 是否保存成功
 */
export async function saveEnvironmentConfigs(ctx, configs = {}) {
  const current = await loadEnvironmentConfigs(ctx);
  const next = { ...current, ...configs };

  // 仅当调用方显式传入 cards/options 时，才用 shape 覆盖
  if ('cards' in configs || 'options' in configs) {
    const shaped = ensureEnvironmentShape({
      cards: configs.cards,
      options: configs.options
    });
    next.cards = shaped.cards;
    next.options = shaped.options;
  }
  next.updatedAt = new Date().toISOString();

  // storage 直写（五段 Key）
  const s = resolveStorage(ctx);
  if (s) {
    const key = storageKeyForEnv(ctx);
    console.log('[序列化] 保存的数据:', next);
    return setJSON(s, key, next);
  }

  // 兼容 dataManager 保存
  if (typeof ctx?.dataManager?.saveEnvironmentConfigs === 'function') {
    console.log('[序列化] 保存的数据:', next);
    return ctx.dataManager.saveEnvironmentConfigs(next, getModeIdFromCtx(ctx));
  }

  return false;
}

/**
 * 保存全量环境快照
 * @param {any} store 存储上下文
 * @param {string} versionLabel 版本标签
 * @returns {Promise<boolean>} 是否保存成功
 */
export async function saveEnvFullSnapshot(store, versionLabel) {
  const version = ID.normalizeVersionLabel(versionLabel || '');
  if (!ID.isValidVersionLabel(version)) {
    if (store.error !== undefined) store.error = '版本号不能为空';
    return false;
  }

  console.log('[序列化] 保存版本:', version);

  // 确保dataManager已设置versionLabel
  if (store.dataManager && typeof store.dataManager.setVersionLabel === 'function') {
    store.dataManager.setVersionLabel(version);
  }

  // 检查是否已存在该版本
  const existingSnapshots = await listEnvFullSnapshots(store);
  if (existingSnapshots.some(s => s.version === version)) {
    if (store.error !== undefined) store.error = `版本号已存在：${version}`;
    return false;
  }

  // 硬校验：台面上必须至少有"1 张卡 + 至少 1 条选项（结构）"
  if (!hasAtLeastOneCardAndOptionInSession(store)) {
    if (store.error !== undefined) store.error = '无效信息：至少需要一张卡片和一条选项，才能保存全量配置';
    return false;
  }

  // 从会话中构建环境数据
  const environment = buildEnvironmentFromSession(store);
  const fullConfigs = buildFullConfigs(environment);
  const hash = hashString(stableStringify(fullConfigs));

  console.log('[序列化] 构建的环境数据:', environment);
  console.log('[序列化] 生成的hash:', hash);

  // 使用正确的五段Key保存快照数据
  const snapData = {
    version,
    timestamp: Date.now(),
    hash,
    environment,
    fullConfigs
  };

  try {
    // 使用 storageKeyForEnv 构建正确的存储Key
    const storage = resolveStorage(store);
    const key = storageKeyForEnv({ ...store, currentVersion: version, versionLabel: version });
    
    console.log('[序列化] 使用的存储Key:', key);
    
    const success = setJSON(storage, key, snapData);
    if (success) {
      console.log('[序列化] 保存成功');
      if (store.error !== undefined) store.error = null;
      return true;
    } else {
      if (store.error !== undefined) store.error = '保存失败';
      return false;
    }
  } catch (error) {
    console.error('[序列化] 保存失败:', error);
    if (store.error !== undefined) store.error = `保存失败: ${error.message}`;
    return false;
  }
}

/**
 * 应用全量环境快照（反序列化并恢复）
 * @param {any} store 存储上下文
 * @param {string} versionLabel 版本标签
 * @returns {Promise<boolean>} 是否应用成功
 */
export async function applyEnvFullSnapshot(store, versionLabel) {
  const version = ID.normalizeVersionLabel(versionLabel || '');
  if (!ID.isValidVersionLabel(version)) {
    if (store.error !== undefined) store.error = '版本号不能为空';
    return false;
  }

  console.log('[反序列化] 应用版本:', version);

  try {
    // 使用正确的五段Key加载快照数据
    const storage = resolveStorage(store);
    const key = storageKeyForEnv({ ...store, currentVersion: version, versionLabel: version });
    
    console.log('[反序列化] 使用的存储Key:', key);
    
    const snapData = getJSON(storage, key);
    if (!snapData) {
      if (store.error !== undefined) store.error = `未找到版本：${version}`;
      return false;
    }

    console.log('[反序列化] 加载的快照数据:', snapData);

    const env = snapData.environment || { cards: {}, options: {} };
    const cardIds = Object.keys(env.cards || {}).sort((a, b) => ID.compareCardIds(String(a), String(b)));

    console.log('[反序列化] 卡片ID列表:', cardIds);

    const incomingCards = cardIds.map(cardId => {
      const c = env.cards[cardId] || {};
      const selectOptions = Array.isArray(c.dropdown)
        ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
        : [];

      const optionEntries = Object.entries(env.options || {})
        .map(([fullId, o]) => {
          const parsed = ID.parseFullOptionId(String(fullId).toUpperCase());
          if (!parsed.valid) return null;
          if (parsed.cardId !== cardId) return null;
          return {
            numId: parseInt(parsed.optionId, 10),
            name: toNull(o?.name),
            value: toNull(o?.value),
            unit: toNull(o?.unit)
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.numId - b.numId)
        .map((o, idx) => ({
          id: idx + 1,
          name: o.name,
          value: o.value,
          unit: o.unit,
          checked: false
        }));

      return {
        id: cardId,
        data: {
          title: toNull(c.title),
          options: optionEntries,
          selectOptions,
          selectedValue: null
        }
      };
    });

    // 优先使用 store 的 replaceSessionWithCards 方法
    if (typeof store.replaceSessionWithCards === 'function') {
      store.replaceSessionWithCards(incomingCards, { editMode: 'none' });
    } else {
      // 兜底逻辑：直接设置 sessionCards
      const sessionCards = incomingCards.map(card => ({
        ...card,
        modeId: store.currentModeId || ID.ROOT_ADMIN_MODE_ID,
        editableFields: {
          optionName: false,
          optionValue: false,
          optionUnit: false,
          optionCheckbox: false,
          optionActions: false,
          select: false
        },
        showDropdown: false,
        isTitleEditing: false,
        isOptionsEditing: false,
        isSelectEditing: false,
        isPresetEditing: false
      }));
      
      if (store.tempCards !== undefined) store.tempCards = [];
      if (store.sessionCards !== undefined) store.sessionCards = sessionCards;
      if (store.selectedCardId !== undefined) store.selectedCardId = sessionCards[0]?.id || null;
    }

    console.log('[反序列化] 应用成功');
    if (store.error !== undefined) store.error = null;
    return true;
  } catch (error) {
    console.error('[反序列化] 应用失败:', error);
    if (store.error !== undefined) store.error = `应用版本失败: ${error.message}`;
    return false;
  }
}

/**
 * 列出所有环境全量快照
 * @param {any} store 存储上下文
 * @returns {Promise<Array>} 快照列表
 */
export async function listEnvFullSnapshots(store) {
  try {
    // 使用新的id.js批量提取工具获取版本列表
    const versions = ID.extractKeysFields('version', {
      modeId: store.currentModeId || ID.ROOT_ADMIN_MODE_ID,
      type: ID.TYPES.ENV_FULL
    });
    
    console.log('[反序列化] 提取到的版本:', versions);
    
    if (!versions || versions.length === 0) {
      console.log('[反序列化] 没有找到任何版本数据');
      return [];
    }
    
    // 为每个版本获取详细信息（时间戳和hash）
    const snapshots = [];
    for (const version of versions) {
      try {
        // 使用与 saveEnvFullSnapshot 相同的key构建逻辑
        const key = ID.buildKey({
          modeId: store.currentModeId || ID.ROOT_ADMIN_MODE_ID,
          version: version,
          type: ID.TYPES.ENV_FULL,
          excelId: 'A0' // 与 storageKeyForEnv 保持一致
        });
        
        const storage = resolveStorage(store);
        const data = getJSON(storage, key);
        
        if (data && data.timestamp) {
          snapshots.push({
            version: ID.normalizeVersionLabel(version),
            timestamp: data.timestamp,
            hash: data.hash || ''
          });
        } else {
          console.warn(`[反序列化] 版本 ${version} 没有有效的时间戳数据`);
          snapshots.push({
            version: ID.normalizeVersionLabel(version),
            timestamp: Date.now(),
            hash: ''
          });
        }
      } catch (error) {
        console.warn(`[反序列化] 加载版本 ${version} 失败:`, error);
        snapshots.push({
          version: ID.normalizeVersionLabel(version),
          timestamp: Date.now(),
          hash: ''
        });
      }
    }
    
    console.log('[反序列化] 最终快照列表:', snapshots);
    // 按时间戳倒序排列
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[反序列化] 函数执行失败:', error);
    return [];
  }
}

// ========== 辅助工具函数 ==========

/**
 * 旧键迁移：把 legacy 键搬到新五段 Key（只在新键不存在时迁一次）
 * @param {Storage} storage 存储对象
 * @param {string} newKey 新的存储键
 */
function maybeMigrateLegacyEnv(storage, newKey) {
  if (!storage) return;
  if (storage.getItem(newKey)) return;

  const legacyKeys = [
    'app_long_term_environment_configs', // 旧 LocalStorageStrategy 前缀版本
    'environment_configs'                // 旧纯键名版本
  ];
  for (const oldKey of legacyKeys) {
    const raw = storage.getItem(oldKey);
    if (raw) {
      // 尝试识别是否为 JSON 字符串
      let obj = null;
      try { obj = JSON.parse(raw); } catch { obj = raw; }
      console.log('[迁移] 恢复的数据:', obj);
      setJSON(storage, newKey, obj);
      try {
        storage.removeItem(oldKey);
      } catch (e) {
        // ignore legacy key removal
      }
      break;
    }
  }
}

/**
 * 根据卡片ID获取所有选项
 * @param {any} store 存储上下文
 * @param {string} cardIdInput 卡片ID
 * @returns {Array} 选项数组
 */
export function getAllOptionsByCardId(store, cardIdInput) {
  const res = [];
  const map = store.environmentConfigs?.options || {};
  const cid = String(cardIdInput || '').trim();
  if (!cid) return res;

  let normalizedCardId;
  try {
    normalizedCardId = ID.normalizeCardId(cid);
  } catch {
    return res;
  }

  Object.entries(map).forEach(([fullId, opt]) => {
    const parsed = ID.parseFullOptionId(String(fullId).toUpperCase());
    if (!parsed.valid) return;
    if (parsed.cardId !== normalizedCardId) return;
    res.push({
      id: parsed.optionId,
      fullId: ID.buildFullOptionId(parsed.cardId, parsed.optionId),
      ...opt
    });
  });
  return res;
}

// ========== 导出聚合对象 ==========

/**
 * 序列化/反序列化功能聚合对象
 * 提供所有核心序列化相关的功能
 */
export const Serialization = Object.freeze({
  // 核心序列化工具
  stableStringify,
  hashString,
  
  // 数据规范化
  normalizeCards,
  normalizeOptions,
  buildEnvironmentFromSession,
  buildFullConfigs,
  
  // 核心序列化/反序列化功能
  loadEnvironmentConfigs,
  saveEnvironmentConfigs,
  saveEnvFullSnapshot,
  applyEnvFullSnapshot,
  listEnvFullSnapshots,
  
  // 辅助工具
  getAllOptionsByCardId,
  
  // 内部工具（供高级用户使用）
  _internal: {
    resolveStorage,
    getJSON,
    setJSON,
    storageKeyForEnv,
    getVersionFromCtx,
    getModeIdFromCtx,
    maybeMigrateLegacyEnv
  }
});