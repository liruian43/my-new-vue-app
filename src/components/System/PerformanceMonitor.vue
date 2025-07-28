<template>
  <div class="performance-monitor">
    <h4>系统性能</h4>
    <div class="metrics">
      <div class="metric">
        <span class="label">卡片数量:</span>
        <span class="value">{{ cardCount }}</span>
      </div>
      <div class="metric">
        <span class="label">内存使用:</span>
        <span class="value">{{ memoryUsage }}</span>
      </div>
      <div class="metric">
        <span class="label">渲染时间:</span>
        <span class="value">{{ renderTime }}ms</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUpdated } from "vue";
import { useDataManagement } from "../../composables/useDataManagement";

const { appData } = useDataManagement();

const cardCount = computed(() => appData.value.cards.length);
const memoryUsage = ref("0 KB");
const renderTime = ref(0);

const updateMemoryUsage = () => {
  // 简化实现，实际项目中可以使用 performance.memory (Chrome only)
  const dataSize = JSON.stringify(appData.value).length;
  memoryUsage.value = `${(dataSize / 1024).toFixed(2)} KB`;
};

onMounted(() => {
  updateMemoryUsage();

  // 模拟渲染时间测量
  const start = performance.now();
  setTimeout(() => {
    const end = performance.now();
    renderTime.value = (end - start).toFixed(2);
  }, 0);
});

onUpdated(() => {
  updateMemoryUsage();
});
</script>

<style scoped>
.performance-monitor {
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 0.8rem;
}

.metrics {
  display: flex;
  gap: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
}

.label {
  color: #666;
}

.value {
  font-weight: bold;
}
</style>
