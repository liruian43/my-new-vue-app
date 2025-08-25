// src/components/Data/store-parts/envConfigs.js
// 合并版：支持 manager（传 storage）与 store（传 store）
// 采用五段 Key 落盘 + 保存前硬校验（结构存在性）
// 空值与结构统一交由 utils/emptiness.js 负责

import {
  // 原有的直接导入将改为从 ID 对象中获取
  // buildKey, TYPES, normalizeVersionLabel 等
  ID // 导入 ID 聚合对象，包含所有 ID 相关函数和常量
} from '../services/id.js';

// 导入空值处理工具
import {
  toNull,
  ensureEnvironmentShape,
  hasAtLeastOneCardAndOptionInSession
} from '../utils/emptiness.js';

// ========== 五段 Key 生成 ==========
// 版本来源：优先取 ctx.currentVersion / ctx.version / ctx.versionLabel，兜底 'GLOBAL'
function getVersionFromCtx(ctx) {
  // 使用 ID.normalizeVersionLabel
  return ID.normalizeVersionLabel(
    ctx?.currentVersion || ctx?.version || ctx?.versionLabel || 'GLOBAL'
  );
}

// 新增：识别 Mode ID
// ctx 预期是 store 实例，其中应该有 currentModeId
function getModeIdFromCtx(ctx) {
  // 使用 ID.normalizeModeId，并提供一个安全的默认值 ROOT_ADMIN_MODE_ID
  return ID.normalizeModeId(ctx?.currentModeId || ID.ROOT_ADMIN_MODE_ID);
}

// env 整包配置的存储键：prefix:modeId:version:envFull:A0
function storageKeyForEnv(ctx) {
  const modeId = getModeIdFromCtx(ctx); // 获取 modeId
  const version = getVersionFromCtx(ctx);
  // 使用 ID.buildKey 并传入 modeId
  return ID.buildKey({
    modeId,
    version,
    type: ID.TYPES.ENV_FULL,
    excelId: 'A0' // 合法且不会与真实业务冲突（选项 0 不会被生成）
  });
}

// ========== 小工具 ==========
const _arr = (x) => Array.isArray(x) ? x : [];

// 导出 stableStringify
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

// 导出 hashString
export function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h = h | 0;
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

function isStorage(obj) {
  return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function';
}
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
function getJSON(storage, key) {
  if (!storage) return null;
  const val = storage.getItem(key);
  // 兼容可能存在的“自带 JSON 序列化”的适配器（通过存在 prefix 字段粗略判断）
  if (storage.prefix) return val || null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val || null;
}
function setJSON(storage, key, value) {
  if (!storage) return false;
  // 兼容可能存在的“自带 JSON 序列化”的适配器
  if (storage.prefix) return storage.setItem(key, value);
  console.log('保存的数据:', value); // 保存时添加
  return storage.setItem(key, JSON.stringify(value));
}

// 旧键迁移：把 legacy 键搬到新四段 Key（只在新键不存在时迁一次）
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
      console.log('恢复的数据:', obj); // 恢复时添加
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

// ========== 环境配置加载与保存（整合新/老 storage 和 dataManager/store） ==========

/**
 * 加载环境配置
 * - 参数既可以是 storage（供 manager 调用），也可以是 store（你现有的调用）
 * - 使用五段 Key（prefix:modeId:version:envFull:A0）
 * - 首次加载时尝试从 legacy 键迁移
 * - 返回时对 cards/options 进行 shape 补齐（空值与结构由 emptiness.js 统一）
 */
export async function loadEnvironmentConfigs(ctx) {
  // 若传入的是 storage 或可解析到 storage
  const s = resolveStorage(ctx);
  if (s) {
    const key = storageKeyForEnv(ctx); // 调用新的 storageKeyForEnv
    maybeMigrateLegacyEnv(s, key);
    const stored = getJSON(s, key);
    console.log('恢复的数据:', stored); // 恢复时添加

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
  // 这里的 loadEnvironmentConfigs 可能需要调整 dataManager 的接口或确保 ctx 带有 modeId
  if (typeof ctx?.dataManager?.loadEnvironmentConfigs === 'function') {
    // 假设 dataManager 的 loadEnvironmentConfigs 能够处理 modeId 或自行解决
    // TODO: 考虑 dataManager 接口是否需要根据 modeId 加载
    const data = await ctx.dataManager.loadEnvironmentConfigs(getModeIdFromCtx(ctx)); // 尝试传入 modeId
    console.log('恢复的数据:', data); // 恢复时添加
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
  console.log('恢复的数据:', defaultData); // 恢复时添加
  return defaultData;
}

/**
 * 保存环境配置（整包）
 * - 参数既可以是 storage（manager 调用），也可以是 store（你现有的调用）
 * - 注意：这里不做“卡+选项”的硬校验，交由“全量快照保存”时校验；
 *   因为此处也可能用于保存非卡片数据（如 uiPresets/contextTemplates）。
 * - 若调用方传入 cards/options，则仅对这两者做 shape 规范化后再落盘，避免误清空。
 */
export async function saveEnvironmentConfigs(ctx, configs = {}) {
  const current = await loadEnvironmentConfigs(ctx); // 先加载当前配置，确保 key 一致
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
    const key = storageKeyForEnv(ctx); // 调用新的 storageKeyForEnv
    console.log('保存的数据:', next); // 保存时添加
    return setJSON(s, key, next);
  }

  // 兼容 dataManager 保存
  // 这里的 saveEnvironmentConfigs 可能需要调整 dataManager 的接口
  if (typeof ctx?.dataManager?.saveEnvironmentConfigs === 'function') {
    console.log('保存的数据:', next); // 保存时添加
    return ctx.dataManager.saveEnvironmentConfigs(next, getModeIdFromCtx(ctx)); // 尝试传入 modeId
  }

  return false;
}

// ========== 老版核心功能保留（最小改动，空值委托 emptiness.js） ==========

// 统一替换所有 ID.xxx 调用
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
      const parsed = ID.parseFullOptionId(String(rawFull).toUpperCase()); // 使用 ID.parseFullOptionId
      if (parsed.valid) {
        cardId = parsed.cardId;
        optionId = parsed.optionId;
        fullId = ID.buildFullOptionId(cardId, optionId); // 使用 ID.buildFullOptionId
      }
    }

    // 其次用 cardId + optionId 组合
    if (!fullId && rawCard && rawOpt) {
      try {
        const c = ID.normalizeCardId(rawCard); // 使用 ID.normalizeCardId
        const o2 = ID.normalizeOptionId(rawOpt); // 使用 ID.normalizeOptionId
        cardId = c;
        optionId = o2;
        fullId = ID.buildFullOptionId(c, o2); // 使用 ID.buildFullOptionId
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

export function getAllOptionsByCardId(store, cardIdInput) {
  const res = [];
  const map = store.environmentConfigs?.options || {};
  const cid = String(cardIdInput || '').trim();
  if (!cid) return res;

  let normalizedCardId;
  try {
    normalizedCardId = ID.normalizeCardId(cid); // 使用 ID.normalizeCardId
  } catch {
    return res;
  }

  Object.entries(map).forEach(([fullId, opt]) => {
    const parsed = ID.parseFullOptionId(String(fullId).toUpperCase()); // 使用 ID.parseFullOptionId
    if (!parsed.valid) return;
    if (parsed.cardId !== normalizedCardId) return;
    res.push({
      id: parsed.optionId,
      fullId: ID.buildFullOptionId(parsed.cardId, parsed.optionId), // 使用 ID.buildFullOptionId
      ...opt
    });
  });
  return res;
}

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

// ========== 全量快照（保存前硬校验，仅检查“结构存在性”） ==========

// 导出 buildEnvironmentFromSession
export function buildEnvironmentFromSession(store) {
  const env = { cards: {}, options: {} };
  const cards = _arr(store.sessionCards)
    .slice()
    .sort((a, b) => ID.compareCardIds(String(a.id), String(b.id))); // 使用 ID.compareCardIds

  for (const card of cards) {
    const rawId = String(card.id);
    if (!ID.isValidCardId(rawId)) continue; // 使用 ID.isValidCardId
    const cardId = ID.normalizeCardId(rawId); // 使用 ID.normalizeCardId

    env.cards[cardId] = {
      id: cardId,
      title: toNull(card?.data?.title),
      // dropdown 按 string[] 存储，UI 的 selectOptions -> label
      dropdown: _arr(card?.data?.selectOptions).map(opt => String(opt?.label ?? ''))
    };

    const opts = _arr(card?.data?.options);
    opts.forEach((opt, idx) => {
      // 运行态使用 1..N 连续编号入 env；存储时不因内容为空而过滤
      const optionId = ID.normalizeOptionId(String(idx + 1)); // 使用 ID.normalizeOptionId
      const combinedId = ID.buildFullOptionId(cardId, optionId); // 使用 ID.buildFullOptionId
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

// 导出 buildFullConfigs
export function buildFullConfigs(env) {
  const full = {};
  const cards = env.cards || {};
  const options = env.options || {};

  Object.keys(options).forEach(combinedId => {
    const parsed = ID.parseFullOptionId(String(combinedId).toUpperCase()); // 使用 ID.parseFullOptionId
    if (!parsed.valid) return;
    const cardId = parsed.cardId;
    const optionId = parsed.optionId;
    const c = cards[cardId] || {};
    const o = options[combinedId] || {};

    full[combinedId] = {
      combinedId: ID.buildFullOptionId(cardId, optionId), // 使用 ID.buildFullOptionId
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

export async function listEnvFullSnapshots(store) {
  try {
    // 使用新的id.js批量提取工具获取版本列表
    const versions = ID.extractKeysFields('version', {
      modeId: store.currentModeId || ID.ROOT_ADMIN_MODE_ID,
      type: ID.TYPES.ENV_FULL
    });
    
    console.log('[listEnvFullSnapshots] 提取到的版本:', versions);
    
    if (!versions || versions.length === 0) {
      console.log('[listEnvFullSnapshots] 没有找到任何版本数据');
      return [];
    }
    
    // 为每个版本获取详细信息（时间戳和hash）
    const snapshots = [];
    for (const version of versions) {
      try {
        // 使用与 saveEnvFullSnapshot 相同的key构建逻辑
        // 根据现有代码，全量快照应该使用 A0 作为 excelId
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
          console.warn(`[listEnvFullSnapshots] 版本 ${version} 没有有效的时间戳数据`);
          // 有版本记录但没有完整数据，可能是损坏的记录
          snapshots.push({
            version: ID.normalizeVersionLabel(version),
            timestamp: Date.now(),
            hash: ''
          });
        }
      } catch (error) {
        console.warn(`[listEnvFullSnapshots] 加载版本 ${version} 失败:`, error);
        // 即使单个版本失败，也要显示在列表中
        snapshots.push({
          version: ID.normalizeVersionLabel(version),
          timestamp: Date.now(),
          hash: ''
        });
      }
    }
    
    console.log('[listEnvFullSnapshots] 最终快照列表:', snapshots);
    // 按时间戳倒序排列
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[listEnvFullSnapshots] 函数执行失败:', error);
    return [];
  }
}
export async function saveEnvFullSnapshot(store, versionLabel) {
  const version = ID.normalizeVersionLabel(versionLabel || '');
  if (!ID.isValidVersionLabel(version)) {
    store.error = '版本号不能为空';
    return false;
  }

  console.log('[saveEnvFullSnapshot] 保存版本:', version);

  // 确保dataManager已设置versionLabel
  if (store.dataManager && typeof store.dataManager.setVersionLabel === 'function') {
    store.dataManager.setVersionLabel(version);
  }

  // 检查是否已存在该版本
  const existingSnapshots = await listEnvFullSnapshots(store);
  if (existingSnapshots.some(s => s.version === version)) {
    store.error = `版本号已存在：${version}`;
    return false;
  }

  // 硬校验：台面上必须至少有“1 张卡 + 至少 1 条选项（结构）”
  if (!hasAtLeastOneCardAndOptionInSession(store)) {
    store.error = '无效信息：至少需要一张卡片和一条选项，才能保存全量配置';
    return false;
  }

  // 从会话中构建环境数据
  const environment = buildEnvironmentFromSession(store);
  const fullConfigs = buildFullConfigs(environment);
  const hash = hashString(stableStringify(fullConfigs));

  console.log('[saveEnvFullSnapshot] 构建的环境数据:', environment);
  console.log('[saveEnvFullSnapshot] 生成的hash:', hash);

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
    
    console.log('[saveEnvFullSnapshot] 使用的存储Key:', key);
    
    const success = setJSON(storage, key, snapData);
    if (success) {
      console.log('[saveEnvFullSnapshot] 保存成功');
      store.error = null;
      return true;
    } else {
      store.error = '保存失败';
      return false;
    }
  } catch (error) {
    console.error('[saveEnvFullSnapshot] 保存失败:', error);
    store.error = `保存失败: ${error.message}`;
    return false;
  }
}

export async function applyEnvFullSnapshot(store, versionLabel) {
  const version = ID.normalizeVersionLabel(versionLabel || '');
  if (!ID.isValidVersionLabel(version)) {
    store.error = '版本号不能为空';
    return false;
  }

  console.log('[applyEnvFullSnapshot] 应用版本:', version);

  try {
    // 使用正确的五段Key加载快照数据
    const storage = resolveStorage(store);
    const key = storageKeyForEnv({ ...store, currentVersion: version, versionLabel: version });
    
    console.log('[applyEnvFullSnapshot] 使用的存储Key:', key);
    
    const snapData = getJSON(storage, key);
    if (!snapData) {
      store.error = `未找到版本：${version}`;
      return false;
    }

    console.log('[applyEnvFullSnapshot] 加载的快照数据:', snapData);

    const env = snapData.environment || { cards: {}, options: {} };
    const cardIds = Object.keys(env.cards || {}).sort((a, b) => ID.compareCardIds(String(a), String(b)));

    console.log('[applyEnvFullSnapshot] 卡片ID列表:', cardIds);

  const incomingCards = cardIds.map(cardId => {
    const c = env.cards[cardId] || {};
    const selectOptions = Array.isArray(c.dropdown)
      ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
      : [];

    const optionEntries = Object.entries(env.options || {})
      .map(([fullId, o]) => {
        const parsed = ID.parseFullOptionId(String(fullId).toUpperCase()); // 使用 ID.parseFullOptionId
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

  if (typeof store.replaceSessionWithCards === 'function') {
    store.replaceSessionWithCards(incomingCards, { editMode: 'none' });
  } else {
    // 这部分是你的兜底逻辑，也需要更新 ID.xxx 的使用
    const sessionCards = [];
    for (const cardId of cardIds) {
      const c = env.cards[cardId] || {};
      const selectOptions = Array.isArray(c.dropdown)
        ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
        : [];
      const optionEntries = Object.entries(env.options || {})
        .map(([fullId, o]) => {
          const parsed = ID.parseFullOptionId(String(fullId).toUpperCase()); // 使用 ID.parseFullOptionId
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

      sessionCards.push({
        id: cardId,
        modeId: store.currentModeId || ID.ROOT_ADMIN_MODE_ID, // 使用 ID.ROOT_ADMIN_MODE_ID
        data: {
          title: toNull(c.title),
          options: optionEntries,
          selectOptions,
          selectedValue: null
        },
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
      });
    }
    store.tempCards = [];
    store.sessionCards = sessionCards;
    store.selectedCardId = sessionCards[0]?.id || null;
  }

    console.log('[applyEnvFullSnapshot] 应用成功');
    store.error = null;
    return true;
  } catch (error) {
    console.error('[applyEnvFullSnapshot] 应用失败:', error);
    store.error = `应用版本失败: ${error.message}`;
    return false;
  }
}

// ========== 新版新增功能（保持你原有实现） ==========
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