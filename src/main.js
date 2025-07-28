import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);

// 修改后的错误处理器
app.config.errorHandler = (err) => {
  console.error("全局错误:", err);
  alert(`发生错误: ${err.message}`);
};

app.mount("#app");
