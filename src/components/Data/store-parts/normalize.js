// src/components/Data/store-parts/normalize.js
export function normalizeNullValue(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value !== undefined ? value : null;
}

export function normalizeDataStructure(data, template) {
  const result = { ...data };
  Object.keys(template).forEach(key => {
    if (result[key] === undefined) {
      result[key] = Array.isArray(template[key])
        ? [...template[key]]
        : typeof template[key] === 'object'
          ? { ...template[key] }
          : template[key];
    }
    if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = normalizeDataStructure(result[key], template[key]);
    }
    if (Array.isArray(result[key])) {
      const itemTemplate = Array.isArray(template[key]) && template[key][0] ? template[key][0] : {};
      result[key] = result[key].map(item => {
        if (typeof item === 'object' && item !== null) {
          return normalizeDataStructure(item, itemTemplate);
        }
        return normalizeNullValue(item);
      });
    } else {
      result[key] = normalizeNullValue(result[key]);
    }
  });
  return result;
}