// src/components/Data/services/longTerm.js
// 这个模块是专职负责**导入和导出**本地 JSON 数据的工具。
// 它不负责与 localStorage 交互，也不涉及 ID 的构建和解析。
// 职责：处理 JSON 字符串化与解析，以及“空值”保障。

/**
 * 将数据对象转化为 JSON 字符串。
 * 导出时使用。
 * @param {object} data 要导出的原始数据对象（例如包含 questions 和 categories 的整个题库对象）。
 * @returns {string} 数据的 JSON 字符串表示。
 */
export function stringifyToJson(data) {
  // 如果传入的数据为 null 或 undefined，则返回 null 的字符串表示，以维持架构存在。
  // 否则，正常进行 JSON 序列化。
  if (data === null || typeof data === 'undefined') {
    return 'null'; // 明确字符串 'null'，而不是一个空字符串或抛出错误
  }
  try {
    return JSON.stringify(data, null, 2); // beautify output for readability
  } catch (error) {
    console.error("Error stringifying JSON data:", error);
    // 遇到错误时，仍返回一个有效的 JSON 字符串，例如表示错误的结构或 null
    return '{"error": "Failed to stringify data"}';
  }
}

/**
 * 将 JSON 字符串解析为数据对象。
 * 导入时使用。
 * @param {string} jsonString 包含 JSON 数据的字符串。
 * @returns {object | null} 解析后的数据对象，如果无效则为 null。
 */
export function parseFromJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    console.warn("Attempted to parse empty or non-string JSON data.");
    return null; // 根据“空值问题”，返回 null 以保持架构存在
  }
  
  // 如果字符串就是 'null'，也按照“空值问题”返回 null 对象
  if (jsonString.trim().toLowerCase() === 'null') {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString);
    // 即使解析成功，如果结果是 null 或非对象，也可能表示数据不符合预期
    if (parsed === null || typeof parsed !== 'object') {
       console.warn("Parsed JSON data is null or not an object:", parsed);
       return null;
    }
    return parsed;
  } catch (error) {
    console.error("Error parsing JSON string:", error);
    return null; // 解析失败时，返回 null 以保持架构存在
  }
}

// 添加缺失的导出函数以消除编译警告
// 这些函数应该与 localStorage 相关，但由于架构原因，这里提供简单的兼容实现

/**
 * 保存数据到长期存储
 * @param {string} key 存储键
 * @param {any} data 要保存的数据
 * @returns {boolean} 是否保存成功
 */
export function saveToLongTerm(key, data) {
  try {
    const jsonString = stringifyToJson(data);
    localStorage.setItem(key, jsonString);
    return true;
  } catch (error) {
    console.error('保存到长期存储失败:', error);
    return false;
  }
}

/**
 * 从长期存储获取数据
 * @param {string} key 存储键
 * @returns {any} 获取的数据，失败时返回 null
 */
export function getFromLongTerm(key) {
  try {
    const jsonString = localStorage.getItem(key);
    return parseFromJson(jsonString);
  } catch (error) {
    console.error('从长期存储获取数据失败:', error);
    return null;
  }
}

/**
 * 从长期存储删除数据
 * @param {string} key 存储键
 * @returns {boolean} 是否删除成功
 */
export function deleteFromLongTerm(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('从长期存储删除数据失败:', error);
    return false;
  }
}

/**
 * 按模式清理长期存储数据
 * @param {string} modeId 模式ID
 * @returns {number} 清理的条目数量
 */
export function clearLongTermByMode(modeId) {
  try {
    let count = 0;
    const keysToRemove = [];
    
    // 遍历所有存储的键，找到匹配模式的键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(`:${modeId}:`)) {
        keysToRemove.push(key);
      }
    }
    
    // 删除匹配的键
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      count++;
    });
    
    console.log(`清理模式 ${modeId} 的数据，共删除 ${count} 个条目`);
    return count;
  } catch (error) {
    console.error('按模式清理长期存储失败:', error);
    return 0;
  }
}