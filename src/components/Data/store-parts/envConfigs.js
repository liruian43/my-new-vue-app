// src/components/Data/store-parts/envConfigs.js
// 合并版：支持 manager（传 storage）与 store（传 store）
// 采用四段 Key 落盘 + 保存前硬校验（结构存在性）
// 空值与结构统一交由 utils/emptiness.js 负责

import {
  isValidCardId,
  normalizeCardId,
  normalizeOptionId,
  buildFullOptionId,
  parseFullOptionId,
  compareCardIds,
  buildKey,
  TYPES,
  normalizeVersionLabel
} from '../services/id.js';

// 导入空值处理工具
import {
  toNull,
  ensureEnvironmentShape,
  hasAtLeastOneCardAndOptionInSession
} from '../utils/emptiness.js';

// ========== 四段 Key 生成 ==========
// 版本来源：优先取 ctx.currentVersion / ctx.version / ctx.versionLabel，兜底 'GLOBAL'
function getVersionFromCtx(ctx) {
  return normalizeVersionLabel(
    ctx?.currentVersion || ctx?.version || ctx?.versionLabel || 'GLOBAL'
  );
}

// env 整包配置的存储键：prefix:version:envFull:A0
function storageKeyForEnv(ctx) {
  const version = getVersionFromCtx(ctx);
  return buildKey({
    version,
    type: TYPES.ENV_FULL,
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
 * - 使用四段 Key（prefix:version:envFull:A0）
 * - 首次加载时尝试从 legacy 键迁移
 * - 返回时对 cards/options 进行 shape 补齐（空值与结构由 emptiness.js 统一）
 */
export async function loadEnvironmentConfigs(ctx) {
  // 若传入的是 storage 或可解析到 storage
  const s = resolveStorage(ctx);
  if (s) {
    const key = storageKeyForEnv(ctx);
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
  if (typeof ctx?.dataManager?.loadEnvironmentConfigs === 'function') {
    const data = await ctx.dataManager.loadEnvironmentConfigs();
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
  const current = await loadEnvironmentConfigs(ctx);

  // 仅当调用方显式传入 cards/options 时，才用 shape 覆盖
  const next = { ...current, ...configs };
  if ('cards' in configs || 'options' in configs) {
    const shaped = ensureEnvironmentShape({
      cards: configs.cards,
      options: configs.options
    });
    next.cards = shaped.cards;
    next.options = shaped.options;
  }
  next.updatedAt = new Date().toISOString();

  // storage 直写（四段 Key）
  const s = resolveStorage(ctx);
  if (s) {
    const key = storageKeyForEnv(ctx);
    console.log('保存的数据:', next); // 保存时添加
    return setJSON(s, key, next);
  }

  // 兼容 dataManager 保存
  if (typeof ctx?.dataManager?.saveEnvironmentConfigs === 'function') {
    console.log('保存的数据:', next); // 保存时添加
    return ctx.dataManager.saveEnvironmentConfigs(next);
  }

  return false;
}

// ========== 老版核心功能保留（最小改动，空值委托 emptiness.js） ==========

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
      const parsed = parseFullOptionId(String(rawFull).toUpperCase());
      if (parsed.valid) {
        cardId = parsed.cardId;
        optionId = parsed.optionId;
        fullId = buildFullOptionId(cardId, optionId);
      }
    }

    // 其次用 cardId + optionId 组合
    if (!fullId && rawCard && rawOpt) {
      try {
        const c = normalizeCardId(rawCard);
        const o2 = normalizeOptionId(rawOpt);
        cardId = c;
        optionId = o2;
        fullId = buildFullOptionId(c, o2);
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
    normalizedCardId = normalizeCardId(cid);
  } catch {
    return res;
  }

  Object.entries(map).forEach(([fullId, opt]) => {
    const parsed = parseFullOptionId(String(fullId).toUpperCase());
    if (!parsed.valid) return;
    if (parsed.cardId !== normalizedCardId) return;
    res.push({
      id: parsed.optionId,
      fullId: buildFullOptionId(parsed.cardId, parsed.optionId),
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
    .sort((a, b) => compareCardIds(String(a.id), String(b.id)));

  for (const card of cards) {
    const rawId = String(card.id);
    if (!isValidCardId(rawId)) continue;
    const cardId = normalizeCardId(rawId);

    env.cards[cardId] = {
      id: cardId,
      title: toNull(card?.data?.title),
      // dropdown 按 string[] 存储，UI 的 selectOptions -> label
      dropdown: _arr(card?.data?.selectOptions).map(opt => String(opt?.label ?? ''))
    };

    const opts = _arr(card?.data?.options);
    opts.forEach((opt, idx) => {
      // 运行态使用 1..N 连续编号入 env；存储时不因内容为空而过滤
      const optionId = normalizeOptionId(String(idx + 1));
      const combinedId = buildFullOptionId(cardId, optionId);
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
    const parsed = parseFullOptionId(String(combinedId).toUpperCase());
    if (!parsed.valid) return;
    const cardId = parsed.cardId;
    const optionId = parsed.optionId;
    const c = cards[cardId] || {};
    const o = options[combinedId] || {};

    full[combinedId] = {
      combinedId: buildFullOptionId(cardId, optionId),
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
  const snaps = await store.dataManager?.loadEnvFullSnapshots?.() || [];
  return (Array.isArray(snaps) ? snaps : []).map(s => ({
    version: s.version,
    timestamp: s.timestamp,
    hash: s.hash
  }));
}

export async function saveEnvFullSnapshot(store, versionLabel) {
  const version = String(versionLabel || '').trim();
  if (!version) {
    store.error = '版本号不能为空';
    return false;
  }

  const snaps = await store.dataManager?.loadEnvFullSnapshots?.() || [];
  const arr = Array.isArray(snaps) ? snaps : [];

  if (arr.some(s => s.version === version)) {
    store.error = `版本号已存在：${version}`;
    return false;
  }

  // 硬校验：台面上必须至少有“1 张卡 + 至少 1 条选项（结构）”
  if (!hasAtLeastOneCardAndOptionInSession(store)) {
    store.error = '无效信息：至少需要一张卡片和一条选项，才能保存全量配置';
    return false;
  }

  // 现在这些函数都已导出，可以从 store.js 正确调用了
  const environment = buildEnvironmentFromSession(store);
  const fullConfigs = buildFullConfigs(environment);
  const hash = hashString(stableStringify(fullConfigs));

  const snap = {
    version,
    timestamp: Date.now(),
    hash,
    environment,
    fullConfigs
  };

  arr.push(snap);
  await store.dataManager?.saveEnvFullSnapshots?.(arr);
  return true;
}

export async function applyEnvFullSnapshot(store, versionLabel) {
  const version = String(versionLabel || '').trim();
  if (!version) return false;

  const snaps = await store.dataManager?.loadEnvFullSnapshots?.() || [];
  const arr = Array.isArray(snaps) ? snaps : [];
  const snap = arr.find(s => s.version === version);
  if (!snap) {
    store.error = `未找到版本：${version}`;
    return false;
  }

  const env = snap.environment || { cards: {}, options: {} };
  const cardIds = Object.keys(env.cards || {}).sort((a, b) => compareCardIds(String(a), String(b)));

  const incomingCards = cardIds.map(cardId => {
    const c = env.cards[cardId] || {};
    const selectOptions = Array.isArray(c.dropdown)
      ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
      : [];

    const optionEntries = Object.entries(env.options || {})
      .map(([fullId, o]) => {
        const parsed = parseFullOptionId(String(fullId).toUpperCase());
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
    const sessionCards = [];
    for (const cardId of cardIds) {
      const c = env.cards[cardId] || {};
      const selectOptions = Array.isArray(c.dropdown)
        ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
        : [];
      const optionEntries = Object.entries(env.options || {})
        .map(([fullId, o]) => {
          const parsed = parseFullOptionId(String(fullId).toUpperCase());
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
        modeId: store.currentModeId || 'root_admin',
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

  store.error = null;
  return true;
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