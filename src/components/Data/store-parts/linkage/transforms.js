// src/components/Data/store-parts/linkage/transforms.js
// 字段转换函数注册与应用

const registry = new Map();

// 默认内置转换
const defaultTransforms = {
  // 数值转换：乘以100
  percentage: v => (typeof v === 'number' ? v * 100 : v),
  // 字符串：大写
  uppercase: v => (typeof v === 'string' ? v.toUpperCase() : v),
  // 日期：转 ISO 字符串
  toIsoDate: v => (v instanceof Date ? v.toISOString() : v),
  // 差值：与目标卡片当前第一个选项的 value 做差
  difference: (v, { targetCard }) => {
    const targetValue = targetCard?.data?.options?.[0]?.value ?? 0;
    return typeof v === 'number' && typeof targetValue === 'number' ? v - targetValue : v;
  }
};

// 注册默认
Object.entries(defaultTransforms).forEach(([name, fn]) => registry.set(name, fn));

// 外部扩展：注册新转换
export function registerTransform(name, fn) {
  if (typeof fn !== 'function') throw new Error('Transform must be a function');
  registry.set(name, fn);
}

// 获取转换函数
export function getTransform(name) {
  return registry.get(name);
}

// 应用转换
export function applyTransform(value, transformName, { sourceCard, targetCard } = {}) {
  if (!transformName) return value;
  const fn = registry.get(transformName);
  if (!fn) return value;
  return fn(value, { sourceCard, targetCard });
}