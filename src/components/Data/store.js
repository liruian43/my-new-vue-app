// src/components/Data/store.js
import { defineStore } from 'pinia';
import { createApi } from './api';

export const useDataStore = defineStore('data', {
  state: () => ({
    // 共享数据 (key: 资源名, value: 数据)
    sharedData: {},
    
    // 独立数据 (key: 组件实例ID, value: { 资源名: 数据 })
    instanceData: {},
    
    // 加载状态 (key: 操作ID, value: 布尔值)
    loading: {},
    
    // 错误信息 (key: 操作ID, value: 错误对象)
    errors: {}
  }),
  
  getters: {
    // 获取共享数据
    getSharedData: (state) => (resource) => {
      return state.sharedData[resource] || [];
    },
    
    // 获取独立数据
    getInstanceData: (state) => (instanceId, resource) => {
      return state.instanceData[instanceId]?.[resource] || [];
    },
    
    // 检查加载状态
    isLoading: (state) => (actionId) => {
      return state.loading[actionId] || false;
    },
    
    // 获取错误信息
    getError: (state) => (actionId) => {
      return state.errors[actionId];
    }
  },
  
  actions: {
    // 初始化组件实例
    initInstance(instanceId) {
      if (!this.instanceData[instanceId]) {
        this.instanceData[instanceId] = {};
      }
    },
    
    // 销毁组件实例
    destroyInstance(instanceId) {
      if (this.instanceData[instanceId]) {
        delete this.instanceData[instanceId];
      }
    },
    
    // 加载数据（支持共享或独立）
    async fetchData(resource, options = {}) {
      const { 
        shared = false, 
        instanceId = null,
        actionId = `fetch_${resource}` 
      } = options;
      
      this.loading[actionId] = true;
      this.errors[actionId] = null;
      
      try {
        const api = createApi(resource);
        const data = await api.getAll();
        
        if (shared) {
          this.sharedData[resource] = data;
        } else if (instanceId) {
          if (!this.instanceData[instanceId]) {
            this.instanceData[instanceId] = {};
          }
          this.instanceData[instanceId][resource] = data;
        }
        
        return data;
      } catch (error) {
        this.errors[actionId] = error;
        throw error;
      } finally {
        this.loading[actionId] = false;
      }
    },
    
    // 创建数据
    async createData(resource, data, options = {}) {
      const { 
        shared = false, 
        instanceId = null,
        actionId = `create_${resource}` 
      } = options;
      
      this.loading[actionId] = true;
      this.errors[actionId] = null;
      
      try {
        const api = createApi(resource);
        const newItem = await api.create(data);
        
        // 更新状态
        if (shared && this.sharedData[resource]) {
          this.sharedData[resource] = [...this.sharedData[resource], newItem];
        } else if (instanceId && this.instanceData[instanceId]?.[resource]) {
          this.instanceData[instanceId][resource] = [...this.instanceData[instanceId][resource], newItem];
        }
        
        return newItem;
      } catch (error) {
        this.errors[actionId] = error;
        throw error;
      } finally {
        this.loading[actionId] = false;
      }
    },
    
    // 更新数据
    async updateData(resource, id, data, options = {}) {
      const { 
        shared = false, 
        instanceId = null,
        actionId = `update_${resource}` 
      } = options;
      
      this.loading[actionId] = true;
      this.errors[actionId] = null;
      
      try {
        const api = createApi(resource);
        const updatedItem = await api.update(id, data);
        
        // 更新状态
        const updateDataList = (list) => {
          return list.map(item => item.id === id ? updatedItem : item);
        };
        
        if (shared && this.sharedData[resource]) {
          this.sharedData[resource] = updateDataList(this.sharedData[resource]);
        } else if (instanceId && this.instanceData[instanceId]?.[resource]) {
          this.instanceData[instanceId][resource] = updateDataList(this.instanceData[instanceId][resource]);
        }
        
        return updatedItem;
      } catch (error) {
        this.errors[actionId] = error;
        throw error;
      } finally {
        this.loading[actionId] = false;
      }
    },
    
    // 删除数据
    async deleteData(resource, id, options = {}) {
      const { 
        shared = false, 
        instanceId = null,
        actionId = `delete_${resource}` 
      } = options;
      
      this.loading[actionId] = true;
      this.errors[actionId] = null;
      
      try {
        const api = createApi(resource);
        await api.delete(id);
        
        // 更新状态
        const filterDataList = (list) => {
          return list.filter(item => item.id !== id);
        };
        
        if (shared && this.sharedData[resource]) {
          this.sharedData[resource] = filterDataList(this.sharedData[resource]);
        } else if (instanceId && this.instanceData[instanceId]?.[resource]) {
          this.instanceData[instanceId][resource] = filterDataList(this.instanceData[instanceId][resource]);
        }
      } catch (error) {
        this.errors[actionId] = error;
        throw error;
      } finally {
        this.loading[actionId] = false;
      }
    }
  }
});    