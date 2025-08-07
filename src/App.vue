<template>
  <div class="app-container">
    <div class="nav-container">
      <!-- 左侧垂直排列容器 -->
      <div class="left-vertical-group">
        <!-- 首页导航入口 -->
        <div class="root-admin-entry" @click="goToHome">首页</div>
        <!-- root_admin固定导航入口 -->
        <div class="root-admin-entry" @click="goToRootAdmin">根权限</div>
        
        <!-- 模式切换下拉菜单 -->
        <div class="mode-switcher">
          <select 
            v-model="selectedModeId" 
            @change="handleModeChange"
            class="mode-select"
            :disabled="filteredModes.length === 0"
          >
            <option value="">选择模式</option>
            <!-- 仅渲染过滤后的模式 -->
            <option 
              v-for="mode in filteredModes" 
              :key="mode.id" 
              :value="mode.id"
            >
              {{ mode.name }} 
            </option>
          </select>
        </div>
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

// 从store获取原始模式列表
const modes = computed(() => cardStore.modes);

// 仅基于ID过滤root_admin模式，无其他过滤条件
const filteredModes = computed(() => {
  return modes.value.filter(mode => mode.id !== 'root_admin');
});

// 选中的模式ID
const selectedModeId = ref('');

// 处理模式切换
const handleModeChange = () => {
  if (selectedModeId.value) {
    cardStore.setCurrentMode(selectedModeId.value);
    router.push(`/mode/${selectedModeId.value}`);
    console.log(`已切换到模式: ${selectedModeId.value}`);
  } else {
    cardStore.setCurrentMode('');
    router.push('/');
  }
};

// 跳转到首页
const goToHome = () => {
  router.push('/');
};

// 跳转到root_admin页面
const goToRootAdmin = () => {
  router.push('/root_admin');
};

onMounted(() => {
  console.log("App.vue 已挂载");
  // 打印所有模式信息用于调试
  console.log("所有模式列表:", modes.value);
});

// 监听过滤后的模式列表变化
watch(filteredModes, (newModes) => {
  const modeExists = newModes.some(mode => mode.id === selectedModeId.value);
  if (!modeExists) {
    selectedModeId.value = '';
    cardStore.setCurrentMode('');
  }
});
</script>

<style>
/* 样式保持不变 */
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
  min-height: 80px;
}

.left-vertical-group {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mode-switcher {
  margin-top: 7px;
  width: 100%;
  text-align: center;
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

h1 {
  margin: 0;
  color: #333;
}

.root-admin-entry {
  padding: 2px 6px;
  color: #0066cc;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  user-select: none;
  background: none;
  border: none;
  width: 100%;
  text-align: center;
}

.root-admin-entry:hover {
  color: #004499;
  text-decoration: underline;
}
</style>