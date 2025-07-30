// src/components/Data/manager.js
export class LocalStorageStrategy {
  getItem(key) {
    return localStorage.getItem(key);
  }
  
  setItem(key, value) {
    localStorage.setItem(key, value);
  }
  
  removeItem(key) {
    localStorage.removeItem(key);
  }
}

export class SessionStorageStrategy {
  getItem(key) {
    return sessionStorage.getItem(key);
  }
  
  setItem(key, value) {
    sessionStorage.setItem(key, value);
  }
  
  removeItem(key) {
    sessionStorage.removeItem(key);
  }
}

export class MemoryStorageStrategy {
  constructor() {
    this.data = new Map();
  }
  
  getItem(key) {
    return this.data.get(key);
  }
  
  setItem(key, value) {
    this.data.set(key, value);
  }
  
  removeItem(key) {
    this.data.delete(key);
  }
}

export default class DataManager {
  constructor(storageStrategy) {
    this.storage = storageStrategy;
  }
  
  save(key, data) {
    try {
      this.storage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('保存数据失败:', error);
      throw error;
    }
  }
  
  load(key) {
    try {
      const data = this.storage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('加载数据失败:', error);
      return null;
    }
  }
  
  delete(key) {
    this.storage.removeItem(key);
  }
  
  exportToFile(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('无效的JSON文件'));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }
}