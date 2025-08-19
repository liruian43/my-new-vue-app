// src/components/Data/services/id.js
// 专职 ID/Key 生成与校验（卡片ID Excel风格 + 选项ID）

export function compareCardIds(id1, id2) {
  if (id1.length !== id2.length) return id1.length - id2.length;
  return id1.localeCompare(id2);
}

export function isValidCardId(id) {
  return /^[A-Z]+$/.test(id);
}

export function generateNextCardId(usedIds) {
  // usedIds: Set<string> 或数组
  const set = usedIds instanceof Set ? usedIds : new Set(usedIds || []);
  let currentMax = '';
  if (set.size > 0) {
    for (const id of set.values()) {
      if (isValidCardId(id) && compareCardIds(id, currentMax) > 0) {
        currentMax = id;
      }
    }
  }
  if (!currentMax) return 'A';

  const chars = currentMax.split('');
  let i = chars.length - 1;
  while (i >= 0 && chars[i] === 'Z') {
    chars[i] = 'A';
    i--;
  }
  if (i < 0) {
    chars.unshift('A');
  } else {
    chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
  }
  return chars.join('');
}

export function generateNextOptionId(existingOptions) {
  if (!existingOptions || existingOptions.length === 0) return '1';
  const maxId = existingOptions.reduce((max, id) => {
    const num = parseInt(id, 10);
    return Number.isFinite(num) && num > max ? num : max;
  }, 0);
  return String(maxId + 1);
}