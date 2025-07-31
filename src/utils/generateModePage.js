import CardSection from '../Views/CardSection.vue'
import DataSection from '../Views/DataSection.vue'
import { defineComponent } from 'vue'

// 生成模式页面模板（只负责模板，不涉及路由）
export const generateModePage = (mode) => {
  // 页面模板内容（与HomePage结构一致）
  const template = `
    <div class="home-page" @click="handleContainerClick">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner">加载中...</div>
      </div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else class="component-container">
        <CardSection :mode-id="modeId" />
        <button @click="toggleDataSection" class="toggle-data-btn">
          {{ showDataSection ? '隐藏数据区' : '显示数据区' }}
        </button>
        <DataSection v-if="showDataSection" :mode-id="modeId" />
      </div>
    </div>
  `

  // 保存模板到本地存储（路由不存储模板）
  localStorage.setItem(`modeTemplate_${mode.id}`, template)
  
  // 记录模式ID，用于路由注册
  const modeIds = JSON.parse(localStorage.getItem('modeIds') || '[]')
  if (!modeIds.includes(mode.id)) {
    modeIds.push(mode.id)
    localStorage.setItem('modeIds', JSON.stringify(modeIds))
  }
}

// 提供给路由的组件获取方法（路由只做跳转映射）
export const getModeComponent = (modeId) => {
  // 从本地存储获取模板
  const template = localStorage.getItem(`modeTemplate_${modeId}`)
  
  // 返回Vue组件定义（路由只需要知道组件，不关心模板如何生成）
  return defineComponent({
    components: { CardSection, DataSection },
    data() {
      return {
        modeId,
        showDataSection: false,
        loading: false,
        error: null
      }
    },
    methods: {
      toggleDataSection() {
        this.showDataSection = !this.showDataSection
        // 数据区状态存在对应模式的数据区
        this.$store.saveModeData(modeId, 'showDataSection', this.showDataSection)
      },
      handleContainerClick(event) {
        // 与HomePage相同的点击逻辑
        const isCardControls = event.target.closest('.card-controls')
        if (!isCardControls) {
          this.$store.selectedCardId = null
        }
      }
    },
    mounted() {
      // 从模式数据加载状态
      this.showDataSection = this.$store.getModeData(modeId).showDataSection || false
    },
    template: template || '<div>页面加载失败</div>'
  })
}

// 删除模式页面（同步清理模板和ID记录）
export const deleteModePage = (modeId) => {
  localStorage.removeItem(`modeTemplate_${modeId}`)
  const modeIds = JSON.parse(localStorage.getItem('modeIds') || '[]')
  localStorage.setItem('modeIds', JSON.stringify(modeIds.filter(id => id !== modeId)))
}
