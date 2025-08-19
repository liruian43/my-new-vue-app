// src/components/Data/utils/objectPath.js
// 安全获取/设置嵌套字段值（a.b.c）

export function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split('.');
  return parts.reduce((cur, part) => (cur && Object.prototype.hasOwnProperty.call(cur, part) ? cur[part] : undefined), obj);
}

export function setNestedValue(obj, path, value) {
  if (!obj || !path) return;
  const parts = String(path).split('.');
  const last = parts.pop();
  const parent = parts.reduce((cur, part) => {
    if (cur[part] === undefined || cur[part] === null || typeof cur[part] !== 'object') {
      cur[part] = {};
    }
    return cur[part];
  }, obj);
  parent[last] = value;
}