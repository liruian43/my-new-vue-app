<template>
  <div class="app-container">
    <div class="nav-container">
      <h1>通用卡片管理系统</h1>
    </div>
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from "vue"

onMounted(() => {
  console.log("App.vue 已挂载")
})
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
  width: 100%;
  margin-bottom: 20px;
}
</style>