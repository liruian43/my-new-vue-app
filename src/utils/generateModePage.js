import CardSection from '../root_admin/CardSection.vue'
import DataSection from '../root_admin/DataSection.vue'
import { defineComponent, ref, onMounted } from 'vue'
// 导入数据管理器和存储策略
import DataManager, { LocalStorageStrategy } from '../components/Data/manager.js'
// 导入卡片存储（修复handleContainerClick中useCardStore未导入的问题）
import { useCardStore } from '../components/Data/store'

// 初始化数据管理器（与项目存储策略保持一致）
const storageStrategy = new LocalStorageStrategy()
const dataManager = new DataManager(storageStrategy)

// 生成模式页面模板（只负责模板，不涉及路由）
export const generateModePage = (mode) => {
  // 根据模式是否包含数据区，动态生成不同的模板内容
  const template = `
    <div class="home-page" @click="handleContainerClick">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner">加载中...</div>
      </div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else class="component-container">
        <CardSection :mode-id="modeId" :cards="cards" />
        ${mode.includeDataSection ? '<DataSection :mode-id="modeId" />' : ''}
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
    setup() {
      // 使用ref存储响应式数据
      const modeIdRef = ref(modeId)
      const loading = ref(true)
      const error = ref(null)
      const cards = ref([])

      // 处理容器点击事件
      const handleContainerClick = (event) => {
        const isCardControls = event.target.closest('.card-controls')
        if (!isCardControls) {
          // 重置选中状态
          const cardStore = useCardStore()
          cardStore.selectedCardId = null
        }
      }

      // 页面挂载时加载数据
      onMounted(async () => {
        try {
          loading.value = true
          
          // 加载当前模式的卡片数据
          const modeCards = dataManager.loadModeData(
            modeIdRef.value, 
            'cards', 
            'all'
          )
          if (modeCards) {
            cards.value = modeCards
          }

        } catch (err) {
          console.error('加载模式数据失败:', err)
          error.value = '数据加载失败，请刷新页面重试'
        } finally {
          loading.value = false
        }
      })

      return {
        modeId: modeIdRef,
        loading,
        error,
        cards,
        handleContainerClick
      }
    },
    template: template || '<div>页面加载失败</div>'
  })
}

// 删除模式页面（同步清理模板和ID记录）
export const deleteModePage = (modeId) => {
  localStorage.removeItem(`modeTemplate_${modeId}`)
  const modeIds = JSON.parse(localStorage.getItem('modeIds') || '[]')
  localStorage.setItem('modeIds', JSON.stringify(modeIds.filter(id => id !== modeId)))
  
  // 同时清理该模式的所有数据
  dataManager.deleteMode(modeId)
}
