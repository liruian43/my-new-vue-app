// src/components/Data/services/id.js
// 职责：全局唯一的 ID/Key 规则中心
// 规则：Key = {系统前缀}:{模式ID}:{版号}:{类型}:{ExcelID}
// - 系统前缀：区分 localStorage 命名空间（默认 'APP'）
// - 模式ID：多模式下区分具体模式的唯一标识（如 'root_admin', '张三', '李四'）
// - 版号：任意非空字符串（外部保证不重复，如 'V1'、'抓娃娃' 等）
// - 类型：四类 —— 题库(questionBank)、全量区(envFull)、回答(answers)、元数据(@meta)
// - ExcelID：卡片级（A, B..Z, AA..）或选项级（字母+数字，如 A6、AB12）
//
// 说明：你可以分散独立使用其中任意部分（比如只用卡片ID或选项ID），
// 在需要落盘/定位时，再用 buildKey 统一组合成固定五段的 Key。

// -----------------------------
// 系统前缀（本地存储命名空间）
// -----------------------------
let SYSTEM_PREFIX = 'APP'

export function setSystemPrefix(prefix) {
  const p = String(prefix || '').trim()
  if (!p) throw new Error('SYSTEM_PREFIX 不能为空')
  SYSTEM_PREFIX = p
}
export function getSystemPrefix() {
  return SYSTEM_PREFIX
}

// -----------------------------
// 模式 ID 规范化与校验
// -----------------------------
export const ROOT_ADMIN_MODE_ID = 'root_admin';

export function normalizeModeId(modeId) {
  return String(modeId || '').trim();
}

export function isValidModeId(modeId) {
  const mid = normalizeModeId(modeId);
  // 模式ID不能为空
  if (mid.length === 0) return false;
  // 模式ID不能包含 ':'，因为它是 Key 的分隔符
  if (mid.includes(':')) return false;
  // 其他特殊字符限制可以根据需要添加，目前仅限制 ':'
  return true;
}

export function isValidNewSubModeId(modeId) {
  const mid = normalizeModeId(modeId);
  // 模式ID不能为空
  if (mid.length === 0) return false;
  // 模式ID不能包含 ':'
  if (mid.includes(':')) return false;
  // 新建的子模式ID不能是 root_admin
  if (mid === ROOT_ADMIN_MODE_ID) return false;
  // 未来可能添加的重名检查，但目前重名检查在 modes 模块实现
  return true;
}

// -----------------------------
// 版本号（任意非空字符串，外部保证唯一）
// -----------------------------
export function normalizeVersionLabel(label) {
  return String(label ?? '').trim()
}
export function isValidVersionLabel(label) {
  return normalizeVersionLabel(label).length > 0
}

// -----------------------------
// 类型（题库/全量区）规范化与校验
// 统一输出：questionBank / envFull
// 支持多种别名（含中文/QB/ENV等）输入
// -----------------------------
export const TYPES = Object.freeze({
  QUESTION_BANK: 'questionBank',
  ENV_FULL: 'envFull',
  ANSWERS: 'answers', // 新增：子模式回答类型
  META: '@meta' // 元数据类型
})

const TYPE_ALIASES = Object.freeze({
  // 题库
  questionBank: TYPES.QUESTION_BANK,
  qb: TYPES.QUESTION_BANK,
  QB: TYPES.QUESTION_BANK,
  '题库': TYPES.QUESTION_BANK,

  // 全量区
  envFull: TYPES.ENV_FULL,
  env: TYPES.ENV_FULL,
  ENV: TYPES.ENV_FULL,
  ENV_FULL: TYPES.ENV_FULL,
  full: TYPES.ENV_FULL,
  FULL: TYPES.ENV_FULL,
  '全量区': TYPES.ENV_FULL,

  // 回答（子模式专用）
  answers: TYPES.ANSWERS,
  answer: TYPES.ANSWERS,
  ANSWERS: TYPES.ANSWERS,
  ANSWER: TYPES.ANSWERS,
  '回答': TYPES.ANSWERS,
  '答案': TYPES.ANSWERS
})

export function normalizeType(type) {
  const t = String(type || '').trim()
  return TYPE_ALIASES[t] || t
}
export function isValidType(type) {
  const t = normalizeType(type)
  return t === TYPES.QUESTION_BANK || t === TYPES.ENV_FULL || t === TYPES.ANSWERS || t === TYPES.META
}

// -----------------------------
// Excel 风格 ID（卡片/选项）
// - 卡片ID：纯大写字母（A..Z, AA..）
// - 选项ID：纯数字（1..N）
// - 选项级 ExcelID：字母+数字（如 A6）= 卡片ID + 选项ID
// -----------------------------
export function isValidCardId(id) {
  return /^[A-Z]+$/.test(String(id || ''))
}
export function normalizeCardId(id) {
  const s = String(id || '').trim().toUpperCase()
  if (!isValidCardId(s)) throw new Error(`无效卡片ID: ${id}`)
  return s
}

// 比较卡片ID：先按长度，后按字典序（Excel 列序）
export function compareCardIds(id1, id2) {
  const a = String(id1 || '')
  const b = String(id2 || '')
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b)
}

// 从已用ID集合/数组生成下一个卡片ID（A → B → ... → Z → AA → AB ...）
export function generateNextCardId(used) {
  const set = used instanceof Set ? used : new Set(used || [])
  let currentMax = ''
  for (const x of set.values()) {
    const id = String(x || '')
    if (isValidCardId(id) && compareCardIds(id, currentMax) > 0) currentMax = id
  }
  if (!currentMax) return 'A'

  const chars = currentMax.split('')
  let i = chars.length - 1
  while (i >= 0 && chars[i] === 'Z') { chars[i] = 'A'; i-- }
  if (i < 0) chars.unshift('A')
  else chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
  return chars.join('')
}

export function isValidOptionId(id) {
  return /^\d+$/.test(String(id || ''))
}
export function normalizeOptionId(id) {
  const s = String(id || '').trim()
  if (!isValidOptionId(s)) throw new Error(`无效选项ID: ${id}`)
  return s
}

// 接受 ['1','2'] 或 [{id:'1'}, {id:'2'}]
export function generateNextOptionId(existing) {
  const list = Array.isArray(existing) ? existing : []
  let max = 0
  for (const it of list) {
    const v = typeof it === 'object' && it !== null ? it.id : it
    const n = parseInt(String(v), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return String(max + 1)
}

// 组合/解析 选项级 ExcelID：如 A6
export function buildFullOptionId(cardId, optionId) {
  const c = normalizeCardId(cardId)
  const o = normalizeOptionId(optionId)
  return `${c}${o}`
}
export function parseFullOptionId(fullId) {
  const m = String(fullId || '').toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return { cardId: null, optionId: null, valid: false }
  return { cardId: m[1], optionId: m[2], valid: true }
}
export function compareFullOptionIds(a, b) {
  const A = parseFullOptionId(a)
  const B = parseFullOptionId(b)
  if (!A.valid && !B.valid) return 0
  if (!A.valid) return -1
  if (!B.valid) return 1
  const c = compareCardIds(A.cardId, B.cardId)
  return c !== 0 ? c : (parseInt(A.optionId, 10) - parseInt(B.optionId, 10))
}

// ExcelID 判别/归一化/拆分（支持 'a'/'a6' -> 'A'/'A6'）
export function isCardExcelId(excelId) {
  return isValidCardId(String(excelId || '').toUpperCase())
}
export function isOptionExcelId(excelId) {
  return /^([A-Z]+)(\d+)$/.test(String(excelId || '').toUpperCase())
}
export function isValidExcelId(excelId) {
  const s = String(excelId || '').toUpperCase()
  return isCardExcelId(s) || isOptionExcelId(s)
}
export function excelIdKind(excelId) {
  const s = String(excelId || '').toUpperCase()
  if (isCardExcelId(s)) return 'card'
  if (isOptionExcelId(s)) return 'option'
  return null
}
export function normalizeExcelId(excelId) {
  const s = String(excelId || '').trim().toUpperCase()
  if (isCardExcelId(s)) return s
  const m = s.match(/^([A-Z]+)(\d+)$/)
  if (m) return `${m[1]}${m[2]}`
  // 保持与旧规范一致的错误 throw
  throw new Error(`无效 ExcelID: ${excelId}（应为卡片ID如 A 或选项ID如 A6）`)
}
// 语义更直观的别名（等价于 buildFullOptionId）
export function buildExcelId(cardId, optionId) {
  return buildFullOptionId(cardId, optionId)
}
export function splitExcelId(excelId) {
  const s = normalizeExcelId(excelId)
  if (isCardExcelId(s)) return { kind: 'card', cardId: s, optionId: null }
  const { cardId, optionId, valid } = parseFullOptionId(s)
  if (!valid) throw new Error(`无法解析 ExcelID: ${excelId}`)
  return { kind: 'option', cardId, optionId }
}

// -----------------------------
// Key 组合/解析（固定五段）
// Key = prefix:modeId:version:type:excelId
// 各段做 URL 安全编码，避免中文/特殊字符导致的存储键问题。
// -----------------------------
function enc(x) { return encodeURIComponent(String(x ?? '')) }
function dec(x) { try { return decodeURIComponent(String(x ?? '')) } catch { return String(x ?? '') } }

// 辅助函数，用于在 Key 校验失败时提供详细信息
function debugValidate(param, checker, value, errorMsg) {
  if (!checker(value)) {
    throw new Error(`buildKey 校验失败 - 参数: ${param}, 值: '${value}', 错误: ${errorMsg}`);
  }
}

export function buildKey({ modeId, version, type, excelId, prefix }) {
  const p = String(prefix || SYSTEM_PREFIX).trim();
  debugValidate('prefix', (val) => val.length > 0, p, '系统前缀不能为空');

  const m = normalizeModeId(modeId);
  debugValidate('modeId', isValidModeId, m, '模式ID不能为空或包含特殊字符 (:)');

  const v = normalizeVersionLabel(version);
  debugValidate('version', isValidVersionLabel, v, '版本号不能为空');

  const t = normalizeType(type);
  debugValidate('type', isValidType, t, '类型无效（应为 questionBank / envFull / answers / @meta，或其别名/中文）');

  // 关键修改：@meta 跳过 ExcelID 校验，允许任意非空 name
  let e;
  if (t === TYPES.META) {
    e = normalizeMetaName(excelId);
  } else {
    e = normalizeExcelId(excelId);
  }

  return `${enc(p)}:${enc(m)}:${enc(v)}:${enc(t)}:${enc(e)}`;
}

export function parseKey(key) {
  const s = String(key || '');
  const parts = s.split(':');
  if (parts.length !== 5) return { valid: false, error: 'Key 格式错误：分段数量不匹配' };

  const [p, m, v, t, e] = parts;
  const prefix = dec(p);
  const modeId = dec(m);
  const version = dec(v);
  const typeRaw = dec(t);
  const type = normalizeType(typeRaw);
  const excelId = dec(e);

  const baseValid =
    !!prefix &&
    isValidModeId(modeId) &&
    isValidVersionLabel(version) &&
    isValidType(type);

  if (type === TYPES.META) {
    // 关键修改：@meta 不做 ExcelID 校验，只要求 name 非空
    const metaNameValid = String(excelId ?? '').trim().length > 0;

    if (!(baseValid && metaNameValid)) {
      return {
        valid: false,
        error: 'Key 内容校验失败',
        debug: {
          prefixValid: !!prefix,
          modeIdValid: isValidModeId(modeId),
          versionValid: isValidVersionLabel(version),
          typeValid: isValidType(type),
          metaNameValid
        },
        rawParts: { p_raw: p, m_raw: m, v_raw: v, t_raw: t, e_raw: e },
        parsed: { prefix, modeId, version, type, excelId, kind: 'meta' }
      };
    }

    return {
      valid: true,
      prefix,
      modeId,
      version,
      type,
      excelId,
      excelIdKind: 'meta'
    };
  }

  // 非 @meta 仍按 ExcelID 校验
  const kind = excelIdKind(excelId);
  const valid =
    baseValid &&
    !!kind &&
    isValidExcelId(excelId);

  if (!valid) {
    return {
      valid: false,
      error: 'Key 内容校验失败',
      debug: {
        prefixValid: !!prefix,
        modeIdValid: isValidModeId(modeId),
        versionValid: isValidVersionLabel(version),
        typeValid: isValidType(type),
        excelIdKindValid: !!kind,
        excelIdContentValid: isValidExcelId(excelId),
      },
      rawParts: { p_raw: p, m_raw: m, v_raw: v, t_raw: t, e_raw: e },
      parsed: { prefix, modeId, version, type, excelId, kind }
    };
  }

  return {
    valid: true,
    prefix,
    modeId,
    version,
    type,
    excelId,
    excelIdKind: kind
  };
}

// -----------------------------
// Meta Key（非卡片/选项级数据，如 submode_instances 等）
// 形态：prefix:modeId:version:@meta:name
// 说明：不走 type(questionBank/envFull) 与 excelId 校验，避免与卡片数据冲突。
// -----------------------------
export function normalizeMetaName(name) {
  const s = String(name ?? '').trim()
  if (!s) throw new Error('meta name 不能为空')
  return s
}

export function buildMetaKey({ modeId, version, name, prefix }) {
  const n = normalizeMetaName(name);
  return buildKey({
    prefix,
    modeId,
    version,
    type: TYPES.META,
    excelId: n
  });
}

export function parseMetaKey(key) {
  const parsed = parseKey(key);
  if (!parsed.valid || parsed.type !== '@meta') {
    return {
      valid: false,
      error: '无效的元数据Key',
      parsed
    };
  }
  return {
    valid: true,
    prefix: parsed.prefix,
    modeId: parsed.modeId,
    version: parsed.version,
    name: parsed.excelId
  };
}

// -----------------------------
// 批量Key处理工具（通用五段Key字段提取器）
// -----------------------------

/**
 * 从LocalStorage中批量提取五段Key的指定字段
 * @param {string|string[]} fields 要提取的字段名（'prefix'|'modeId'|'version'|'type'|'excelId'）
 * @param {object} filters 过滤条件 { prefix?, modeId?, version?, type?, excelId? }
 * @param {Storage} storage 存储对象（默认localStorage）
 * @param {boolean} unique 是否去重（默认true）
 * @returns {Array} 提取结果数组
 */
export function extractKeysFields(fields, filters = {}, storage = localStorage, unique = true) {
  const fieldsArray = Array.isArray(fields) ? fields : [fields];
  const validFields = ['prefix', 'modeId', 'version', 'type', 'excelId'];
  
  // 验证字段名
  for (const field of fieldsArray) {
    if (!validFields.includes(field)) {
      throw new Error(`无效的字段名: ${field}，支持的字段: ${validFields.join(', ')}`);
    }
  }
  
  const results = [];
  const seenSet = unique ? new Set() : null;
  
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      
      const parsed = parseKey(key);
      if (!parsed.valid) continue;
      
      // 应用过滤条件
      let matchFilters = true;
      for (const [filterField, filterValue] of Object.entries(filters)) {
        if (filterValue && parsed[filterField] !== filterValue) {
          matchFilters = false;
          break;
        }
      }
      if (!matchFilters) continue;
      
      // 提取指定字段
      if (fieldsArray.length === 1) {
        // 单字段提取
        const value = parsed[fieldsArray[0]];
        if (unique) {
          if (!seenSet.has(value)) {
            seenSet.add(value);
            results.push(value);
          }
        } else {
          results.push(value);
        }
      } else {
        // 多字段提取
        const result = {};
        for (const field of fieldsArray) {
          result[field] = parsed[field];
        }
        
        if (unique) {
          const resultKey = JSON.stringify(result);
          if (!seenSet.has(resultKey)) {
            seenSet.add(resultKey);
            results.push(result);
          }
        } else {
          results.push(result);
        }
      }
    }
  } catch (error) {
    console.warn('[ID] 提取Key字段时出错:', error);
  }
  
  return results;
}

/**
 * 获取五段Key的完整分析报告
 * @param {object} filters 过滤条件
 * @param {Storage} storage 存储对象（默认localStorage）
 * @returns {object} 分析报告 { summary, byPrefix, byModeId, byVersion, byType, byExcelId }
 */
export function analyzeKeysDistribution(filters = {}, storage = localStorage) {
  const analysis = {
    totalKeys: 0,
    validKeys: 0,
    invalidKeys: 0,
    byPrefix: {},
    byModeId: {},
    byVersion: {},
    byType: {},
    byExcelId: {},
    combinations: []
  };
  
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      
      analysis.totalKeys++;
      
      const parsed = parseKey(key);
      if (!parsed.valid) {
        analysis.invalidKeys++;
        continue;
      }
      
      // 应用过滤条件
      let matchFilters = true;
      for (const [filterField, filterValue] of Object.entries(filters)) {
        if (filterValue && parsed[filterField] !== filterValue) {
          matchFilters = false;
          break;
        }
      }
      if (!matchFilters) continue;
      
      analysis.validKeys++;
      
      // 统计各字段分布
      const fields = ['prefix', 'modeId', 'version', 'type', 'excelId'];
      fields.forEach(field => {
        const value = parsed[field];
        const byField = analysis[`by${field.charAt(0).toUpperCase() + field.slice(1)}`];
        byField[value] = (byField[value] || 0) + 1;
      });
      
      // 记录完整组合
      analysis.combinations.push({
        key,
        prefix: parsed.prefix,
        modeId: parsed.modeId,
        version: parsed.version,
        type: parsed.type,
        excelId: parsed.excelId
      });
    }
  } catch (error) {
    console.warn('[ID] 分析Key分布时出错:', error);
  }
  
  return analysis;
}

/**
 * 批量操作Key的工具函数
 * @param {string} operation 操作类型 'list'|'count'|'delete'|'export'
 * @param {object} criteria 条件 { prefix?, modeId?, version?, type?, excelId? }
 * @param {Storage} storage 存储对象（默认localStorage）
 * @returns {Array|number|boolean} 根据操作类型返回不同结果
 */
export function batchKeyOperation(operation, criteria = {}, storage = localStorage) {
  const matchingKeys = [];
  
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      
      const parsed = parseKey(key);
      if (!parsed.valid) continue;
      
      // 检查是否匹配条件
      let matches = true;
      for (const [field, value] of Object.entries(criteria)) {
        if (value && parsed[field] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        matchingKeys.push({ key, parsed, data: storage.getItem(key) });
      }
    }
    
    switch (operation) {
      case 'list':
        return matchingKeys.map(item => item.key);
      
      case 'count':
        return matchingKeys.length;
      
      case 'delete':
        matchingKeys.forEach(item => storage.removeItem(item.key));
        return matchingKeys.length;
      
      case 'export':
        return matchingKeys.map(item => ({
          key: item.key,
          fields: item.parsed,
          data: item.data
        }));
      
      default:
        throw new Error(`不支持的操作类型: ${operation}`);
    }
  } catch (error) {
    console.warn(`[ID] 批量操作Key时出错 (${operation}):`, error);
    return operation === 'count' ? 0 : [];
  }
}

// -----------------------------
// 导出聚合对象（可选，便于“一个对象全用”）
// 你也可以只按需导入上面的任意函数。
// -----------------------------
export const ID = Object.freeze({
  // 系统前缀/版本/类型
  setSystemPrefix,
  getSystemPrefix,

  ROOT_ADMIN_MODE_ID, // 导出常量
  normalizeModeId,    // 新增
  isValidModeId,      // 新增
  isValidNewSubModeId, // 新增

  normalizeVersionLabel,
  isValidVersionLabel,
  TYPES,
  normalizeType,
  isValidType,

  // ExcelID（卡片/选项）
  isValidCardId,
  normalizeCardId,
  compareCardIds,
  generateNextCardId,
  isValidOptionId,
  normalizeOptionId,
  generateNextOptionId,
  buildFullOptionId,
  parseFullOptionId,
  compareFullOptionIds,

  // ExcelID 高层工具
  isCardExcelId,
  isOptionExcelId,
  isValidExcelId,
  excelIdKind,
  normalizeExcelId,
  buildExcelId,
  splitExcelId,

  // Key（固定五段）
  buildKey,
  parseKey,

  // Meta Key
  buildMetaKey,
  parseMetaKey,
  normalizeMetaName,
  
  // 批量Key处理工具
  extractKeysFields,
  analyzeKeysDistribution,
  batchKeyOperation
});
