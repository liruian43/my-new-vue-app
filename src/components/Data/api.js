// src/components/Data/api.js

// ======================
// 1. 定义本地模拟数据（完全替代真实 API 数据）
// ======================
const mockCards = []; // 模拟卡片数据（初始为空数组，可根据需求填充）
const mockModes = [   // 模拟模式数据（供 ModeLinkageControl.vue 使用）
  { id: 1, name: '模式A' },
  { id: 2, name: '模式B' },
  { id: 3, name: '模式C' },
];

// ======================
// 2. 定义统一的 API 方法（直接返回 Promise + 模拟数据）
// ======================
export const cardApi = {
  // 获取卡片列表（模拟异步请求）
  fetchCards() {
    return Promise.resolve(mockCards); // 直接返回本地模拟数据
  },

  // 保存卡片（模拟异步请求）
  saveCards(cards) {
    console.log('离线模式：模拟保存卡片', cards); // 可选：打印日志
    mockCards.push(...cards); // 可选：将数据存入本地 mockCards（模拟持久化）
    return Promise.resolve({ success: true }); // 模拟成功响应
  },

  // 导出卡片（模拟返回文件 Blob）
  exportCards() {
    const blob = new Blob(['离线模式：模拟导出的卡片数据'], { type: 'text/plain' }); // 模拟文件内容
    return Promise.resolve(blob); // 返回一个模拟的 Blob 文件
  },

  // 导入卡片（模拟处理文件上传）
  importCards(file) {
    console.log('离线模式：模拟导入文件', file.name); // 可选：打印日志
    // 模拟解析文件内容（这里简单返回成功）
    return Promise.resolve({ success: true, importedCount: 1 }); // 模拟导入成功
  },
};

// ======================
// 3. 其他可能的 API 方法（按需扩展）
// ======================
// 示例：如果需要获取模式列表（供 ModeLinkageControl.vue 使用）
export const modeApi = {
  fetchModes() {
    return Promise.resolve(mockModes); // 直接返回本地模拟模式数据
  },
};