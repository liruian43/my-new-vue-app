// 示例：其他模式如何直接使用序列化/反序列化功能
// src/components/Othermodes/exampleUsage.js

// 方式1：直接从序列化模块导入需要的功能
import { 
  Serialization,
  loadEnvironmentConfigs,
  saveEnvironmentConfigs,
  saveEnvFullSnapshot,
  applyEnvFullSnapshot,
  listEnvFullSnapshots,
  stableStringify,
  hashString
} from '../Data/store-parts/serialization.js';

// 方式2：使用聚合对象访问所有功能
// import { Serialization } from '../Data/store-parts/serialization.js';

// 示例：子模式使用序列化功能
export class SubModeDataHandler {
  constructor(modeId) {
    this.modeId = modeId;
    this.currentVersion = 'V1.0';
  }

  // 示例1：加载环境配置（反序列化）
  async loadConfig() {
    try {
      // 构造上下文，包含必要的模式ID和版本信息
      const ctx = {
        currentModeId: this.modeId,
        currentVersion: this.currentVersion,
        dataManager: {
          longTermStorage: localStorage // 或其他存储实现
        }
      };

      // 直接调用序列化模块的反序列化功能
      const config = await loadEnvironmentConfigs(ctx);
      console.log(`[${this.modeId}] 加载配置成功:`, config);
      return config;
    } catch (error) {
      console.error(`[${this.modeId}] 加载配置失败:`, error);
      return null;
    }
  }

  // 示例2：保存环境配置（序列化）
  async saveConfig(configData) {
    try {
      const ctx = {
        currentModeId: this.modeId,
        currentVersion: this.currentVersion,
        dataManager: {
          longTermStorage: localStorage
        }
      };

      // 直接调用序列化模块的序列化功能
      const success = await saveEnvironmentConfigs(ctx, configData);
      console.log(`[${this.modeId}] 保存配置结果:`, success);
      return success;
    } catch (error) {
      console.error(`[${this.modeId}] 保存配置失败:`, error);
      return false;
    }
  }

  // 示例3：应用全量快照（反序列化并恢复）
  async applySnapshot(versionLabel) {
    try {
      const ctx = {
        currentModeId: this.modeId,
        currentVersion: versionLabel,
        sessionCards: [], // 当前会话卡片
        error: null, // 错误状态
        dataManager: {
          longTermStorage: localStorage
        }
      };

      // 直接调用序列化模块的快照应用功能
      const success = await applyEnvFullSnapshot(ctx, versionLabel);
      console.log(`[${this.modeId}] 应用快照 ${versionLabel} 结果:`, success);
      return success;
    } catch (error) {
      console.error(`[${this.modeId}] 应用快照失败:`, error);
      return false;
    }
  }

  // 示例4：列出可用的快照版本
  async listSnapshots() {
    try {
      const ctx = {
        currentModeId: this.modeId,
        dataManager: {
          longTermStorage: localStorage
        }
      };

      // 直接调用序列化模块的快照列表功能
      const snapshots = await listEnvFullSnapshots(ctx);
      console.log(`[${this.modeId}] 可用快照:`, snapshots);
      return snapshots;
    } catch (error) {
      console.error(`[${this.modeId}] 获取快照列表失败:`, error);
      return [];
    }
  }

  // 示例5：使用聚合对象访问内部工具
  generateStorageKey(version, type, excelId) {
    // 使用内部工具生成存储键
    const ctx = {
      currentModeId: this.modeId,
      currentVersion: version
    };
    
    return Serialization._internal.storageKeyForEnv(ctx);
  }

  // 示例6：数据哈希计算
  calculateDataHash(data) {
    // 使用稳定字符串化和哈希功能
    const stableJson = stableStringify(data);
    const hash = hashString(stableJson);
    console.log(`[${this.modeId}] 数据哈希:`, hash);
    return hash;
  }
}

// 使用示例
export function createSubModeHandler(modeId) {
  return new SubModeDataHandler(modeId);
}

// 快速使用函数示例
export async function quickLoadConfig(modeId, version = 'V1.0') {
  const handler = new SubModeDataHandler(modeId);
  handler.currentVersion = version;
  return await handler.loadConfig();
}

export async function quickSaveConfig(modeId, configData, version = 'V1.0') {
  const handler = new SubModeDataHandler(modeId);
  handler.currentVersion = version;
  return await handler.saveConfig(configData);
}