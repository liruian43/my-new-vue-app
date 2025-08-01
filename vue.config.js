module.exports = {
  publicPath: '/',
  lintOnSave: false, // 保留你原有的关闭ESLint检查配置
  // 新增配置：仅添加Vue模板编译支持，不改变其他现有配置
  configureWebpack: {
    resolve: {
      alias: {
        'vue$': 'vue/dist/vue.esm-bundler.js' // 支持模板编译，不影响其他功能
      }
    }
  }
}
