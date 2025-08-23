<template>
  <div class="mode-linkage-control" :class="{ 'component-disabled': isDisabled }">
    <!-- 模式选择下拉框 -->
    <div class="mode-selector">
      <button 
        class="selector-button" 
        @click="!isDisabled && cardStore.toggleModeDropdown"
        :disabled="isDisabled"
      >
        {{ cardStore?.environmentConfigs?.linkageControl?.selectedMode || '选择模式' }}
        <i class="fa fa-chevron-down" :class="{ 'rotate': cardStore?.environmentConfigs?.linkageControl?.isModeDropdownOpen }"></i>
      </button>
      
      <!-- 下拉菜单（禁用时不显示） -->
      <div 
        class="mode-dropdown" 
        v-if="!isDisabled && cardStore?.environmentConfigs?.linkageControl?.isModeDropdownOpen"
      >
        <div 
          class="mode-option" 
          @click="!isDisabled && cardStore.selectMode('所有模式')"
        >
          所有模式
        </div>
        
        <div 
          class="mode-option" 
          v-for="mode in cardStore?.filteredModes || []" 
          :key="mode.id"
          @click="!isDisabled && cardStore.selectMode(mode.name)"
        >
          {{ mode.name }}
          <span v-if="mode.includeDataSection" class="data-badge">含数据</span>
        </div>
      </div>
    </div>

    <!-- 准备/取消联动按钮 -->
    <button 
      class="action-button prepare-button"
      :disabled="isDisabled || (!cardStore?.environmentConfigs?.linkageControl?.selectedMode || !cardStore?.currentModeId)"
      @click="!isDisabled && cardStore.togglePrepareStatus"
    >
      {{ cardStore?.environmentConfigs?.linkageControl?.isInPrepareState ? '取消联动' : '准备联动' }}
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
          v-for="syncItem in cardStore?.environmentConfigs?.linkageControl?.syncOptions || []" 
          :key="syncItem.id"
        >
          <input 
            type="checkbox" 
            :id="`sync-${syncItem.id}`"
            v-model="syncItem.checked"
            :disabled="isDisabled || !cardStore?.environmentConfigs?.linkageControl?.isInPrepareState"
          >
          <label :for="`sync-${syncItem.id}`">{{ syncItem.name }}</label>
        </div>
      </div>

      <!-- 授权选项区域 -->
      <div class="option-group">
        <span class="group-label">授权(控制编辑):</span>
        <div 
          class="option-item" 
          v-for="authItem in cardStore?.environmentConfigs?.linkageControl?.authOptions || []" 
          :key="authItem.id"
        >
          <input 
            type="checkbox" 
            :id="`auth-${authItem.id}`"
            v-model="authItem.checked"
            :disabled="isDisabled || !cardStore?.environmentConfigs?.linkageControl?.isInPrepareState"
          >
          <label :for="`auth-${authItem.id}`">{{ authItem.name }}</label>
        </div>
      </div>
    </div>

    <!-- 确认联动按钮 -->
    <button 
      class="action-button confirm-button"
      :disabled="isDisabled || !cardStore?.canConfirmLinkage"
      @click="!isDisabled && handleConfirmLinkage"
    >
      确认联动
    </button>
  </div>
</template>

<script setup>
import { useCardStore } from '@/components/Data/store';
import { watch, ref } from 'vue';

// 全局禁用开关 - 设为true即可禁用所有功能
const isDisabled = ref(true);

// 安全获取store实例（避免store缺失导致报错）
let cardStore;
try {
  cardStore = useCardStore();
} catch (error) {
  cardStore = null;
  console.warn('ModeLinkageControl组件暂时禁用中，store未就绪');
}

// 处理确认联动
const handleConfirmLinkage = () => {
  if (!cardStore) return;
  
  const result = cardStore.confirmLinkage();
  if (result && result.success) {
    alert(`已成功联动至 ${cardStore.environmentConfigs.linkageControl.selectedMode}`);
  } else if (cardStore.error) {
    alert(cardStore.error);
  }
};

// 条件性添加监听（仅当store存在且组件未禁用时）
if (cardStore && !isDisabled.value) {
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
}
</script>

<style scoped>
/* 原有样式保持不变 */
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

/* 添加禁用状态样式 - 使组件呈现"不可用"的视觉效果 */
.component-disabled {
  opacity: 0.7; /* 降低透明度 */
  pointer-events: none; /* 阻止所有鼠标事件（作为双重保险） */
}

/* 其他原有样式... */
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

/* 其余样式保持不变... */
</style>
