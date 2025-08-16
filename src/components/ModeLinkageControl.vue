<template>
  <div class="mode-linkage-control">
    <!-- 模式选择下拉框 -->
    <div class="mode-selector">
      <button 
        class="selector-button" 
        @click="cardStore.toggleModeDropdown"
      >
        {{ cardStore.environmentConfigs.linkageControl.selectedMode || '选择模式' }}
        <i class="fa fa-chevron-down" :class="{ 'rotate': cardStore.environmentConfigs.linkageControl.isModeDropdownOpen }"></i>
      </button>
      
      <!-- 下拉菜单 -->
      <div 
        class="mode-dropdown" 
        v-if="cardStore.environmentConfigs.linkageControl.isModeDropdownOpen"
      >
        <!-- 本组件特有的"所有模式"选项 -->
        <div 
          class="mode-option" 
          @click="cardStore.selectMode('所有模式')"
        >
          所有模式
        </div>
        
        <!-- 使用过滤过滤后的的模式列表 -->
        <div 
          class="mode-option" 
          v-for="mode in cardStore.filteredModes" 
          :key="mode.id"
          @click="cardStore.selectMode(mode.name)"
        >
          {{ mode.name }}
          <span v-if="mode.includeDataSection" class="data-badge">含数据</span>
        </div>
      </div>
    </div>

    <!-- 准备/取消联动按钮 -->
    <button 
      class="action-button prepare-button"
      :disabled="!cardStore.environmentConfigs.linkageControl.selectedMode || !cardStore.currentModeId"
      @click="cardStore.togglePrepareStatus"
    >
      {{ cardStore.environmentConfigs.linkageControl.isInPrepareState ? '取消联动' : '准备联动' }}
    </button>

    <!-- 同步选项区域 -->
    <div class="sync-options">
      <div class="option-group">
        <span class="group-label">同步(控制显示):</span>
        <div class="fixed-sync-hint">
          固定同步: 卡片数量、选项数据、卡片顺序、下拉菜单
        </div>
        <div 
          class="option-item" 
          v-for="syncItem in cardStore.environmentConfigs.linkageControl.syncOptions" 
          :key="syncItem.id"
        >
          <input 
            type="checkbox" 
            :id="`sync-${syncItem.id}`"
            v-model="syncItem.checked"
            :disabled="!cardStore.environmentConfigs.linkageControl.isInPrepareState"
          >
          <label :for="`sync-${syncItem.id}`">{{ syncItem.name }}</label>
        </div>
      </div>

      <!-- 授权选项区域 -->
      <div class="option-group">
        <span class="group-label">授权(控制编辑):</span>
        <div 
          class="option-item" 
          v-for="authItem in cardStore.environmentConfigs.linkageControl.authOptions" 
          :key="authItem.id"
        >
          <input 
            type="checkbox" 
            :id="`auth-${authItem.id}`"
            v-model="authItem.checked"
            :disabled="!cardStore.environmentConfigs.linkageControl.isInPrepareState"
          >
          <label :for="`auth-${authItem.id}`">{{ authItem.name }}</label>
        </div>
      </div>
    </div>

    <!-- 确认联动按钮 -->
    <button 
      class="action-button confirm-button"
      :disabled="!cardStore.canConfirmLinkage"
      @click="handleConfirmLinkage"
    >
      确认联动
    </button>
  </div>
</template>

<script setup>
import { useCardStore } from '@/components/Data/store';
import { watch } from 'vue';

// 获取store实例
const cardStore = useCardStore();

// 处理确认联动
const handleConfirmLinkage = () => {
  const result = cardStore.confirmLinkage();
  if (result && result.success) {
    alert(`已成功联动至 ${cardStore.environmentConfigs.linkageControl.selectedMode}`);
  } else if (cardStore.error) {
    alert(cardStore.error);
  }
};

// 监听过滤后的模式列表变化
watch(
  () => cardStore.filteredModes,
  (newModes) => {
    const selectedMode = cardStore.environmentConfigs.linkageControl.selectedMode;
    if (selectedMode && selectedMode !== '所有模式') {
      const modeExists = newModes.some(mode => mode.name === selectedMode);
      if (!modeExists) {
        cardStore.resetLinkageState();
      }
    }
  }
);
</script>

<style scoped>
/* 样式保持不变 */
.mode-linkage-control {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  flex-wrap: wrap;
}

.mode-selector {
  position: relative;
  min-width: 120px;
}

.selector-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.selector-button:hover {
  border-color: #409eff;
}

.mode-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.mode-option {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
}

.mode-option:hover {
  background-color: #f5f7fa;
}

.mode-option:first-child {
  border-bottom: 1px solid #e4e7ed;
}

.data-badge {
  font-size: 12px;
  color: #2196f3;
  margin-left: 6px;
  font-weight: normal;
}

.action-button {
  padding: 6px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.prepare-button {
  background-color: #409eff;
  color: #fff;
}

.prepare-button:hover:not(:disabled) {
  background-color: #66b1ff;
}

.prepare-button:disabled {
  background-color: #c0ccda;
  cursor: not-allowed;
}

.confirm-button {
  background-color: #67c23a;
  color: #fff;
}

.confirm-button:hover:not(:disabled) {
  background-color: #85ce61;
}

.confirm-button:disabled {
  background-color: #c2e7b0;
  cursor: not-allowed;
}

.sync-options {
  display: flex;
  gap: 20px;
  flex: 1;
  min-width: 400px;
}

.option-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.group-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.fixed-sync-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 20px;
  width: 100%;
}

.option-item {
  display: inline-flex;
  align-items: center;
  margin-right: 12px;
  font-size: 14px;
  color: #303133;
}

.option-item input {
  margin-right: 4px;
  cursor: pointer;
}

.option-item input:disabled + label {
  color: #c0ccda;
  cursor: not-allowed;
}

.fa-chevron-down {
  transition: transform 0.2s;
  margin-left: 6px;
  font-size: 12px;
}

.rotate {
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .mode-linkage-control {
    flex-direction: column;
    align-items: stretch;
  }
  
  .sync-options {
    min-width: auto;
    flex-direction: column;
    gap: 8px;
  }
  
  .option-group {
    flex-wrap: wrap;
  }
}
</style>
