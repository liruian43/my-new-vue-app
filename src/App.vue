<template>
  <div class="app-container">
    <div class="nav-container">
      <!-- 左上角模式切换换下拉菜单 -->
      <div class="mode-switcher">
        <select 
          v-model="selectedModeId" 
          @change="handleModeChange"
          class="mode-select"
          :disabled="modes.length === 0"
        >
          <option value="">选择模式</option>
          <option 
            v-for="mode in modes" 
            :key="mode.id" 
            :value="mode.id"
          >
            {{ mode.name }} 
            <span v-if="mode.includeDataSection" class="data-badge">含数据</span>
          </option>
        </select>
      </div>
      
      <h1>通用卡片管理系统</h1>
    </div>
    <router-view />
  </div>
</template>

<script setup>
import { onMounted, computed, watch, ref } from "vue"
import { useCardStore } from './components/Data/store';
import { useRouter } from 'vue-router';

// 路由实例
const router = useRouter();
// 卡片存储实例
const cardStore = useCardStore();

// 从store获取模式列表
const modes = computed(() => cardStore.modes);
// 选中的模式ID（仅用于下拉框选择，不自动同步）
const selectedModeId = ref('');

// 处理模式切换（仅在手动选择时触发）
const handleModeChange = () => {
  if (selectedModeId.value) {
    // 1. 更新store中的当前模式
    cardStore.setCurrentMode(selectedModeId.value);
    // 2. 跳转到对应的模式页面
    router.push(`/mode/${selectedModeId.value}`);
    console.log(`已切换到模式: ${selectedModeId.value}`);
  } else {
    // 选择"选择模式"时返回首页
    cardStore.setCurrentMode('');
    router.push('/');
  }
};

onMounted(() => {
  console.log("App.vue 已挂载");
  // 移除自动选择逻辑，初始状态为空
});

// 监听模式列表变化，避免已删除的模式仍显示在选中状态
watch(modes, (newModes) => {
  const modeExists = newModes.some(mode => mode.id === selectedModeId.value);
  if (!modeExists) {
    selectedModeId.value = '';
    cardStore.setCurrentMode('');
  }
});
</script>

<style>
.app-container {
  padding: 20px;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nav-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
  position: relative;
}

/* 模式切换样式 */
.mode-switcher {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
}

.mode-select {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
}

.mode-select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.data-badge {
  font-size: 12px;
  color: #2196f3;
  margin-left: 6px;
  font-weight: normal;
}

h1 {
  margin: 0;
  color: #333;
}
</style>
    