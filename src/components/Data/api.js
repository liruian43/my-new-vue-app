// src/components/Data/api.js
import axios from 'axios';

// 创建API实例
const apiClient = axios.create({
  baseURL: '/api', // 替换为实际API地址
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证头
    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('响应错误:', error);
    const message = error.response?.data?.message || '网络错误，请重试';
    return Promise.reject(new Error(message));
  }
);

// 卡片API
export const cardApi = {
  fetchCards() {
    return apiClient.get('/cards');
  },
  
  saveCards(cards) {
    return apiClient.post('/cards', cards);
  },
  
  exportCards() {
    return apiClient.get('/cards/export', { responseType: 'blob' });
  },
  
  importCards(file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/cards/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};