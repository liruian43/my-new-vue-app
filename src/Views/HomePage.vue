<template>
  <div class="home-page">
    <!-- 16:9 横向背景容器 -->
    <div class="bg-container">
      <div class="content-wrapper">
        <div class="content">
          <div class="header">
            <img src="@/assets/logo.png" alt="系统Logo" class="logo" />
            <h1 class="title">自定义流程模拟系统</h1>
          </div>
          
          <div class="quote-section">
            <div class="main-quote">有志者，事竟成</div>
            <div class="sub-quote">——《后汉书》</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 静态首页，无需逻辑
</script>

<style scoped>
.home-page {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}

/* 16:9 横向背景容器 - 绿色→金黄→绿色交叉渐变 */
.bg-container {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    #56ab2f 0%,     /* 左侧深绿 */
    #a8e6cf 25%,    /* 中间浅绿/过渡 */
    #ffd700 50%,    /* 中心金黄 */
    #a8e6cf 75%,    /* 中间浅绿/过渡 */
    #56ab2f 100%    /* 右侧深绿 */
  );
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* 内容包装器 */
.content-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  box-sizing: border-box;
}

.content {
  text-align: left;
  max-width: 800px;
  width: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 40px;
  margin-bottom: 60px;
}

.logo {
  width: 90px;
  height: 90px;
  object-fit: contain;
}

.title {
  font-size: 42px;
  font-weight: bold;
  color: white;
  margin: 0;
  text-shadow: 2px 2px 6px rgba(0,0,0,0.4);
  letter-spacing: 4px;
}

/* ✅ 名言区域 - 您要求的布局 */
.quote-section {
  background: rgba(255, 255, 255, 0.95);
  padding: 40px 45px;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
  backdrop-filter: blur(10px);
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* ✅ "有志者事竟成" - 居中对齐 */
.main-quote {
  font-size: 26px;
  color: #2c3e50;
  font-weight: 600;
  margin: 0 0 15px 0;
  font-family: 'KaiTi', '楷体', serif;
  line-height: 1.4;
  text-align: center; /* ✅ 居中对齐 */
}

/* ✅ "——《后汉书》" - 靠右对齐 */
.sub-quote {
  font-size: 15px;
  color: #7f8c8d;
  font-style: italic;
  margin: 0;
  font-family: 'KaiTi', '楷体', serif;
  text-align: right; /* ✅ 靠右对齐 */
  width: 100%; /* 确保靠右效果 */
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .title {
    font-size: 48px;
    letter-spacing: 5px;
  }
  
  .main-quote {
    font-size: 28px;
  }
  
  .header {
    gap: 50px;
    margin-bottom: 70px;
  }
  
  .logo {
    width: 100px;
    height: 100px;
  }
  
  .quote-section {
    padding: 45px 50px;
  }
}
</style>