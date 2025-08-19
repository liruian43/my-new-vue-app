// src/components/Data/store-parts/envConfigs.js
// 合并版：同时支持 manager 调用（传 storage）与 store 调用（传 store）
// 兼容你原先 A/B 两版以及快照逻辑

import { LocalStorageStrategy } from '../storage/LocalStorageStrategy';

const STORAGE_KEY = 'environment_configs';

// 小工具
const _arr = (x) => Array.isArray(x) ? x : [];

function stableStringify(obj) {
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

function hashString(str) {
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
  if (arg?.dataManager?.longTermStorage) return arg.dataManager.longTermStorage;
  return null;
}
function getJSON(storage, key) {
  if (!storage) return null;
  const val = storage.getItem(key);
  if (storage.prefix) return val || null; // LocalStorageStrategy 已 JSON.parse
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val || null;
}
function setJSON(storage, key, value) {
  if (!storage) return false;
  if (storage.prefix) return storage.setItem(key, value); // LocalStorageStrategy 会 JSON.stringify
  return storage.setItem(key, JSON.stringify(value));
}

// ========== 环境配置加载与保存（整合新版storage和老版dataManager/store） ==========

/**
 * 加载环境配置
 * - 参数既可以是 storage（供 manager 调用），也可以是 store（你现有的调用）
 */
export async function loadEnvironmentConfigs(ctx) {
  // 优先：若传入的是 storage（manager 使用）
  const s = resolveStorage(ctx);
  if (s) {
    const stored = getJSON(s, STORAGE_KEY);
    return {
      cards: {},
      options: {},
      uiPresets: [],
      scoringRules: [],
      contextTemplates: [],
      linkageSettings: {
        autoSync: false,
        syncInterval: 300000,
        conflictResolution: 'source_wins'
      },
      ...(stored || {})
    };
  }

  // 兼容：如果是老版 dataManager（store）
  if (typeof ctx?.dataManager?.loadEnvironmentConfigs === 'function') {
    const data = await ctx.dataManager.loadEnvironmentConfigs();
    if (data && typeof data === 'object') {
      return {
        cards: data.cards || {},
        options: data.options || {},
        uiPresets: _arr(data.uiPresets),
        scoringRules: _arr(data.scoringRules),
        contextTemplates: _arr(data.contextTemplates),
        linkageSettings: data.linkageSettings || {
          autoSync: false,
          syncInterval: 300000,
          conflictResolution: 'source_wins'
        }
      };
    }
  }

  // 兜底默认值
  return {
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
  };
}

/**
 * 保存环境配置
 * - 参数既可以是 storage（manager 调用），也可以是 store（你现有的调用）
 */
export async function saveEnvironmentConfigs(ctx, configs = {}) {
  const current = await loadEnvironmentConfigs(ctx);
  const finalConfigs = {
    ...current,
    ...configs,
    updatedAt: new Date().toISOString()
  };

  // storage 直写
  const s = resolveStorage(ctx);
  if (s) {
    return setJSON(s, STORAGE_KEY, finalConfigs);
  }

  // 兼容 dataManager 保存
  if (typeof ctx?.dataManager?.saveEnvironmentConfigs === 'function') {
    return ctx.dataManager.saveEnvironmentConfigs(finalConfigs);
  }

  return false;
}

// ========== 老版核心功能保留（保持你的原逻辑与签名） ==========

export function normalizeCards(store, cards) {
  const out = {};
  for (const c of _arr(cards)) {
    const id = String(c?.id || '').trim();
    if (!id) continue;
    out[id] = {
      id,
      title: c?.title ?? null,
      dropdown: _arr(c?.dropdown || c?.selectOptions).map(opt => (opt?.label ?? opt ?? null))
    };
  }
  return out;
}

export function normalizeOptions(store, options) {
  const out = {};
  for (const o of _arr(options)) {
    const cardId = String(o?.cardId || o?.card || '').trim();
    const optId = String(o?.id || o?.optionId || '').trim();
    const fullId = String(o?.fullId || (cardId && optId ? `${cardId}${optId}` : '')).trim();
    if (!/^[A-Z]+$/.test(cardId) || !/^\d+$/.test(optId) || !/^[A-Z]+\d+$/.test(fullId)) continue;
    out[fullId] = {
      name: o?.name ?? null,
      value: o?.value ?? null,
      unit: o?.unit ?? null
    };
  }
  return out;
}

export function getAllOptionsByCardId(store, cardId) {
  const res = [];
  const map = store.environmentConfigs?.options || {};
  const cid = String(cardId || '').trim();
  if (!cid) return res;
  Object.entries(map).forEach(([fullId, opt]) => {
    if (fullId.startsWith(cid)) {
      res.push({
        id: fullId.replace(cid, ''),
        fullId,
        ...opt
      });
    }
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

// ========== 全量快照（保留你的老版实现） ==========

function buildEnvironmentFromSession(store) {
  const env = { cards: {}, options: {} };
  const cards = _arr(store.sessionCards)
    .slice()
    .sort((a, b) => {
      if (typeof store.compareCardIds === 'function') return store.compareCardIds(a.id, b.id);
      return String(a.id).localeCompare(String(b.id));
    });

  for (const card of cards) {
    const cardId = String(card.id);
    if (!/^[A-Z]+$/.test(cardId)) continue;

    env.cards[cardId] = {
      id: cardId,
      title: card?.data?.title ?? null,
      dropdown: _arr(card?.data?.selectOptions).map(opt => (opt?.label ?? null))
    };

    const opts = _arr(card?.data?.options);
    opts.forEach((opt, idx) => {
      const optionId = String(idx + 1);
      const combinedId = `${cardId}${optionId}`;
      env.options[combinedId] = {
        name: opt?.name ?? null,
        value: opt?.value ?? null,
        unit: opt?.unit ?? null
      };
    });
  }
  return env;
}

function buildFullConfigs(env) {
  const full = {};
  const cards = env.cards || {};
  const options = env.options || {};

  Object.keys(options).forEach(combinedId => {
    const m = combinedId.match(/^([A-Z]+)(\d+)$/);
    if (!m) return;
    const cardId = m[1];
    const optionId = m[2];
    const c = cards[cardId] || {};
    const o = options[combinedId] || {};

    full[combinedId] = {
      combinedId,
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
  const cardIds = Object.keys(env.cards || {}).sort((a, b) => {
    if (typeof store.compareCardIds === 'function') return store.compareCardIds(a, b);
    return String(a).localeCompare(String(b));
  });

  const incomingCards = cardIds.map(cardId => {
    const c = env.cards[cardId] || {};
    const selectOptions = Array.isArray(c.dropdown)
      ? c.dropdown.map((label, idx) => ({ id: idx + 1, label }))
      : [];

    const optionEntries = Object.entries(env.options || {})
      .filter(([fullId]) => fullId.startsWith(cardId))
      .map(([fullId, o]) => {
        const m = fullId.match(/\d+$/);
        const numId = m ? parseInt(m[0], 10) : null;
        return { numId, name: o?.name ?? null, value: o?.value ?? null, unit: o?.unit ?? null };
      })
      .filter(o => o.numId !== null)
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
        title: c.title ?? null,
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
        .filter(([fullId]) => fullId.startsWith(cardId))
        .map(([fullId, o]) => {
          const m = fullId.match(/\d+$/);
          const numId = m ? parseInt(m[0], 10) : null;
          return { numId, name: o?.name ?? null, value: o?.value ?? null, unit: o?.unit ?? null };
        })
        .filter(o => o.numId !== null)
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
          title: c.title ?? null,
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
    name: ruleData.name ?? null,
    description: ruleData.description ?? null,
    type: ruleData.type || 'exact_match',
    parameters: ruleData.parameters || {},
    score: ruleData.score || 0,
    createdAt: new Date().toISOString()
  };
}