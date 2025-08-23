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