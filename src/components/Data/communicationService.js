// src/components/Data/communicationService.js
import { ID } from './services/id.js'

class CommunicationService {
  constructor() {
    this.listeners = new Map()
  }

  // 主模式推送数据到子模式
  pushDataToMode(targetModeId, data, permissions, withholding) {
    // 创建包含五段式Key信息的数据包
    const packet = {
      sourceModeId: ID.ROOT_ADMIN_MODE_ID,
      targetModeId,
      data,
      permissions,
      withholding,
      timestamp: new Date().toISOString()
    }
    
    // 触发全局事件，通知目标模式接收数据
    window.dispatchEvent(new CustomEvent('mode-data-push', {
      detail: packet
    }))
    
    console.log(`数据已推送到模式: ${targetModeId}`)
    return packet
  }

  // 子模式监听数据推送
  onDataPush(callback) {
    const handler = (event) => {
      callback(event.detail)
    }
    
    window.addEventListener('mode-data-push', handler)
    return () => {
      window.removeEventListener('mode-data-push', handler)
    }
  }

  // 子模式请求数据（可选功能）
  requestDataFromMode(targetModeId, request) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    window.dispatchEvent(new CustomEvent('mode-data-request', {
      detail: {
        requestId,
        targetModeId,
        request,
        timestamp: new Date().toISOString()
      }
    }))
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('请求超时'))
      }, 5000)
      
      const responseHandler = (event) => {
        if (event.detail.requestId === requestId) {
          clearTimeout(timeout)
          window.removeEventListener('mode-data-response', responseHandler)
          resolve(event.detail.response)
        }
      }
      
      window.addEventListener('mode-data-response', responseHandler)
    })
  }

  // 主模式监听数据请求
  onDataRequest(callback) {
    const handler = (event) => {
      callback(event.detail)
    }
    
    window.addEventListener('mode-data-request', handler)
    return () => {
      window.removeEventListener('mode-data-request', handler)
    }
  }

  // 响应数据请求
  respondToDataRequest(requestId, response) {
    window.dispatchEvent(new CustomEvent('mode-data-response', {
      detail: {
        requestId,
        response,
        timestamp: new Date().toISOString()
      }
    }))
  }
}

export default new CommunicationService()