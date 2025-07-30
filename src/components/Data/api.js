// src/components/Data/api.js
class LocalStorageAPI {
  constructor(resourceName) {
    this.resourceName = resourceName;
    this.storageKey = `app_data_${resourceName}`;
  }

  // 获取所有数据
  async getAll() {
    return this.getData();
  }

  // 根据ID获取数据
  async getById(id) {
    const data = this.getData();
    return data.find(item => item.id === id);
  }

  // 创建新数据
  async create(data) {
    const id = this.generateId();
    const newItem = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
    const items = this.getData();
    items.push(newItem);
    this.saveData(items);
    return newItem;
  }

  // 更新数据
  async update(id, data) {
    const items = this.getData();
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }
    
    const updatedItem = { 
      ...items[index], 
      ...data, 
      updatedAt: new Date() 
    };
    
    items[index] = updatedItem;
    this.saveData(items);
    return updatedItem;
  }

  // 删除数据
  async delete(id) {
    const items = this.getData();
    const filteredItems = items.filter(item => item.id !== id);
    this.saveData(filteredItems);
  }

  // 生成唯一ID
  generateId() {
    return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  // 从本地存储获取数据
  getData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get data from localStorage:', error);
      return [];
    }
  }

  // 保存数据到本地存储
  saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save data to localStorage:', error);
    }
  }
}

// 创建API实例工厂
export const createApi = (resourceName) => {
  return new LocalStorageAPI(resourceName);
};    