<template>
  <div class="permission-push-valve">
    <h3>精细化权限控制阀门</h3>
    
    <div class="valve-section">
      <!-- 基础配置行 -->
      <div class="valve-row">
        <label>目标模式:</label>
        <select 
          v-model="selectedTargetMode" 
          class="mode-select"
          :disabled="availableModes.length === 0"
        >
          <option value="">请选择模式</option>
          <option 
            v-for="mode in availableModes" 
            :key="mode.id" 
            :value="mode.id"
          >
            {{ mode.name }} ({{ mode.id }})
          </option>
        </select>
        
        <label>推送版本:</label>
        <select 
          v-model="selectedVersion" 
          class="version-select"
          :disabled="availableVersions.length === 0 || !selectedTargetMode"
        >
          <option value="">请选择版本</option>
          <option 
            v-for="version in availableVersions" 
            :key="version" 
            :value="version"
          >
            {{ version }}
          </option>
        </select>
      </div>
      
      <!-- 数据加载状态 - 默认显示，版本选择后显示具体内容 -->
      <div class="valve-row">
        <div class="data-status">
          <span class="status-label">数据状态:</span>
          <span class="excel-count">
            {{ selectedVersion ? `${currentExcelIds.length} 个ExcelID` : '未选择版本' }}
          </span>
          <span class="version-info" v-if="selectedVersion">版本: {{ selectedVersion }}</span>
          <span class="mode-info">模式: {{ IdSvc.ROOT_ADMIN_MODE_ID }}</span>
          <button @click="loadPermissionData" class="reload-btn" :disabled="!selectedVersion">重新加载</button>
          <button @click="debugCurrentData" class="debug-btn" :disabled="!selectedVersion">调试数据</button>
        </div>
      </div>
      
      <!-- 固定同步字段说明 -->
      <div class="config-section">
        <h4>固定同步字段 <span class="fixed-hint">(✅ 自动同步 + 只读)</span></h4>
        <div class="fixed-fields">
          <span class="fixed-field">卡片标题</span>
          <span class="fixed-field">卡片数量</span>
          <span class="fixed-field">选项数据</span>
          <span class="fixed-field">卡片顺序</span>
          <span class="fixed-field">下拉菜单</span>
          <span class="fixed-field">预设配置</span>
        </div>
        <div class="logic-explanation">
          <small>
            📝 <strong>权限逻辑说明</strong>：
            <strong>同步</strong>和<strong>授权</strong>完全独立，互不干扰。
            同步决定数据内容（原值/null），授权决定编辑权限（可编辑/只读）。
            无论如何设置，字段架构始终存在。
          </small>
        </div>
      </div>
      
      <!-- 精细化权限矩阵 - 默认显示，支持多列布局 -->
      <div class="permission-matrix">
        <h4>精细化权限控制矩阵 
          <span class="matrix-info" v-if="selectedVersion">
            ({{ currentExcelIds.length }} 个ExcelID)
          </span>
          <span class="matrix-info" v-else>
            (请选择版本以加载数据)
          </span>
        </h4>
        
        <!-- 调试信息 -->
        <div class="matrix-debug" v-if="selectedVersion && currentExcelIds.length > 0">
          <small>当前ExcelID: {{ currentExcelIds.join(', ') }}</small>
        </div>
        <div class="matrix-debug" v-else-if="selectedVersion">
          <small>当前版本无ExcelID数据</small>
        </div>
        
        <!-- 双列表格矩阵容器 -->
        <div class="matrix-container" v-if="selectedVersion">
          <!-- 分组显示矩阵 -->
          <div class="matrix-columns" v-if="currentExcelIds.length > 0">
            <!-- 左列矩阵 -->
            <div class="matrix-column" v-if="leftColumnIds.length > 0">
              <!-- 表头 -->
              <div class="matrix-header">
                <div class="excel-id-header">ExcelID</div>
                <div class="field-header" v-for="field in fieldTypes" :key="field">
                  {{ fieldLabels[field] }}
                  <div class="field-sub-headers">
                    <span class="sync-header">同步</span>
                    <span class="auth-header">授权</span>
                  </div>
                </div>
              </div>
              
              <!-- 矩阵内容 -->
              <div class="matrix-content">
                <div 
                  v-for="excelId in leftColumnIds" 
                  :key="excelId" 
                  class="matrix-row"
                  :data-excel-id="excelId"
                >
                  <div class="excel-id-cell">{{ excelId }}</div>
                  <div 
                    v-for="field in fieldTypes" 
                    :key="field" 
                    class="field-cell"
                  >
                    <div class="field-controls-matrix" v-if="fineGrainedPermissions[excelId] && fineGrainedPermissions[excelId][field]">
                      <label class="matrix-checkbox sync">
                        <input 
                          type="checkbox" 
                          v-model="fineGrainedPermissions[excelId][field].sync"
                          :disabled="!selectedTargetMode"
                          @change="onSyncChange(excelId, field, $event.target.checked)"
                        >
                      </label>
                      <label class="matrix-checkbox auth">
                        <input 
                          type="checkbox" 
                          v-model="fineGrainedPermissions[excelId][field].auth"
                          :disabled="!selectedTargetMode"
                          @change="onAuthChange(excelId, field, $event.target.checked)"
                        >
                      </label>
                    </div>
                    <div class="field-controls-error" v-else>
                      <span class="error-text">未初始化</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 右列矩阵 -->
            <div class="matrix-column" v-if="rightColumnIds.length > 0">
              <!-- 表头 -->
              <div class="matrix-header">
                <div class="excel-id-header">ExcelID</div>
                <div class="field-header" v-for="field in fieldTypes" :key="field">
                  {{ fieldLabels[field] }}
                  <div class="field-sub-headers">
                    <span class="sync-header">同步</span>
                    <span class="auth-header">授权</span>
                  </div>
                </div>
              </div>
              
              <!-- 矩阵内容 -->
              <div class="matrix-content">
                <div 
                  v-for="excelId in rightColumnIds" 
                  :key="excelId" 
                  class="matrix-row"
                  :data-excel-id="excelId"
                >
                  <div class="excel-id-cell">{{ excelId }}</div>
                  <div 
                    v-for="field in fieldTypes" 
                    :key="field" 
                    class="field-cell"
                  >
                    <div class="field-controls-matrix" v-if="fineGrainedPermissions[excelId] && fineGrainedPermissions[excelId][field]">
                      <label class="matrix-checkbox sync">
                        <input 
                          type="checkbox" 
                          v-model="fineGrainedPermissions[excelId][field].sync"
                          :disabled="!selectedTargetMode"
                          @change="onSyncChange(excelId, field, $event.target.checked)"
                        >
                      </label>
                      <label class="matrix-checkbox auth">
                        <input 
                          type="checkbox" 
                          v-model="fineGrainedPermissions[excelId][field].auth"
                          :disabled="!selectedTargetMode"
                          @change="onAuthChange(excelId, field, $event.target.checked)"
                        >
                      </label>
                    </div>
                    <div class="field-controls-error" v-else>
                      <span class="error-text">未初始化</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 无数据提示 -->
          <div class="matrix-empty" v-else>
            <p>当前版本没有ExcelID数据，或数据加载中...</p>
          </div>
        </div>
        
        <!-- 未选择版本提示 -->
        <div class="matrix-placeholder" v-else>
          <p>请选择版本以显示权限控制矩阵</p>
        </div>
        
        <!-- 批量操作 -->
        <div class="matrix-actions">
          <button @click="batchOperation('allSync')" class="matrix-btn" :disabled="!selectedVersion || currentExcelIds.length === 0">全部同步</button>
          <button @click="batchOperation('allAuth')" class="matrix-btn" :disabled="!selectedVersion || currentExcelIds.length === 0">全部授权</button>
          <button @click="batchOperation('syncToAuth')" class="matrix-btn" :disabled="!selectedVersion || currentExcelIds.length === 0">同步→授权</button>
          <button @click="batchOperation('syncPlusAuth')" class="matrix-btn" :disabled="!selectedVersion || currentExcelIds.length === 0">同步+授权</button>
          <button @click="batchOperation('random')" class="matrix-btn" :disabled="!selectedVersion || currentExcelIds.length === 0">随机配置</button>
          <button @click="batchOperation('clearAll')" class="matrix-btn" :disabled="!selectedVersion || currentExcelIds.length === 0">清空所有</button>
        </div>
      </div>
      
      <!-- 推送按钮 -->
      <div class="valve-row push-action">
        <button 
          @click="savePermissionData" 
          class="save-btn" 
          :disabled="!hasUnsavedChanges || !selectedVersion"
        >
          保存配置
        </button>
        
        <button 
          class="action-button push-button"
          :disabled="!selectedTargetMode || !selectedVersion || isPushing || currentExcelIds.length === 0"
          @click="executePush"
        >
          {{ isPushing ? '推送中...' : '推送配置' }}
        </button>
        
        <div class="push-summary" v-if="selectedTargetMode && selectedVersion">
          <span>将推送到: {{ selectedTargetMode }}</span>
          <span>版本: {{ selectedVersion }}</span>
          <span v-if="currentExcelIds.length > 0">对象: {{ currentExcelIds.length }} 个ExcelID</span>
          <span v-if="Object.keys(fineGrainedPermissions).length > 0">权限: 已配置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import * as IdSvc from './Data/services/id.js'
import { useCardStore } from './Data/store.js'
// 新增导入（保留原有导入不动）
import {
  loadRootEnvFullSnapshotWithSerialization,
  writeTargetEnvFullSnapshotWithSerialization,
  maskEnvBySyncOnly,
  extractExcelIdsFromSnapshot
} from './PermissionValve.helper.js'

// Props
defineProps({
  availableModes: {
    type: Array,
    default: () => []
  },
  availableVersions: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['push-success', 'push-error'])

// 使用全局store来统一管理数据
const cardStore = useCardStore()

// 响应式数据
const selectedTargetMode = ref('')
const selectedVersion = ref('')
const isPushing = ref(false)
const hasUnsavedChanges = ref(false)

// 字段类型定义
const fieldTypes = ['name', 'value', 'unit']
const fieldLabels = {
  name: '名称',
  value: '值', 
  unit: '单位'
}

// 精细化权限数据结构 - 这就是您要的格式！
const fineGrainedPermissions = ref({})

// 存储异步获取的ExcelID列表
const currentExcelIds = ref([])

// 简单的左右交替排列
const leftColumnIds = computed(() => {
  return currentExcelIds.value.filter((_, index) => index % 2 === 0)
})

const rightColumnIds = computed(() => {
  return currentExcelIds.value.filter((_, index) => index % 2 === 1)
})

// 通过store统一获取ExcelID列表 - 符合全局架构一致性
const loadCurrentExcelIds = async () => {
  if (!selectedVersion.value) {
    currentExcelIds.value = []
    return
  }
  
  try {
    console.log(`\n=== [权限矩阵] 使用store统一调用获取数据 ===`)
    console.log(`目标版本: ${selectedVersion.value}`)
    console.log(`模式ID: ${IdSvc.ROOT_ADMIN_MODE_ID}`)
    
    // 替换原先通过 cardStore.getEnvFullSnapshot(...) 的获取方式
    const snapData = loadRootEnvFullSnapshotWithSerialization(cardStore, IdSvc, selectedVersion.value)
    
    if (!snapData) {
      console.warn(`[权限矩阵] 未找到版本 ${selectedVersion.value} 的快照数据`)
      currentExcelIds.value = []
      return
    }
    
    console.log(`[权限矩阵] 成功通过store加载快照数据:`, snapData)
    console.log(`[权限矩阵] 快照数据类型: ${typeof snapData}`)
    console.log(`[权限矩阵] 快照数据包含的字段:`, Object.keys(snapData || {}))
    
    // 用 helper 提取并排序 ExcelID（内部已按你的排序规则处理）
    const sortedExcelIds = extractExcelIdsFromSnapshot(snapData, IdSvc)
    currentExcelIds.value = sortedExcelIds
    return
  } catch (error) {
    console.error('[权限矩阵] 通过store获取ExcelID列表失败:', error)
    currentExcelIds.value = []
  }
}

// 初始化权限数据结构 - 增强版本
const initializePermissions = (excelIds) => {
  console.log(`\n=== [权限初始化] 开始初始化 ===`)
  console.log(`需要初始化的ExcelID:`, excelIds)
  
  const newPermissions = {}
  
  excelIds.forEach(excelId => {
    newPermissions[excelId] = {
      name: { sync: false, auth: false },
      value: { sync: false, auth: false },
      unit: { sync: false, auth: false }
    }
    console.log(`[权限初始化] 为 ${excelId} 创建权限结构`)
  })
  
  fineGrainedPermissions.value = newPermissions
  console.log(`[权限初始化] 完成！共初始化 ${excelIds.length} 个ExcelID的权限结构`)
  console.log(`[权限初始化] 最终权限对象:`, fineGrainedPermissions.value)
  console.log(`=== [权限初始化] 结束 ===\n`)
}

// 手动重新加载数据的按钮处理
const loadPermissionData = () => {
  if (!selectedTargetMode.value || !selectedVersion.value) {
    console.warn('[权限加载] 缺少目标模式或版本')
    return
  }
  
  // 如果ExcelID列表为空，先加载ExcelID
  if (currentExcelIds.value.length === 0) {
    console.log('[权限加载] ExcelID列表为空，先加载ExcelID数据')
    loadCurrentExcelIds().then(() => {
      if (currentExcelIds.value.length > 0) {
        loadPermissionDataCore()
      }
    })
    return
  }
  
  loadPermissionDataCore()
}

// 核心权限数据加载逻辑
const loadPermissionDataCore = () => {
  
  try {
    // 使用store统一接口加载权限配置
    const savedPermissions = cardStore.loadPermissionConfig(selectedTargetMode.value, selectedVersion.value)
    
    if (Object.keys(savedPermissions).length > 0) {
      console.log('[权限加载] 加载已保存的权限配置:', savedPermissions)
      
      // 合并加载的配置和当前ExcelID列表
      const currentIds = currentExcelIds.value
      const newPermissions = {}
      
      currentIds.forEach(excelId => {
        if (savedPermissions[excelId]) {
          // 使用已保存的配置
          newPermissions[excelId] = savedPermissions[excelId]
        } else {
          // 新的ExcelID，使用默认配置
          newPermissions[excelId] = {
            name: { sync: false, auth: false },
            value: { sync: false, auth: false },
            unit: { sync: false, auth: false }
          }
        }
      })
      
      fineGrainedPermissions.value = newPermissions
      hasUnsavedChanges.value = false
      console.log('[权限加载] 成功加载', Object.keys(newPermissions).length, '个ExcelID的权限配置')
    } else {
      // 没有保存的配置，初始化默认配置
      initializePermissions(currentExcelIds.value)
      hasUnsavedChanges.value = false
      console.log('[权限加载] 未找到保存的配置，使用默认配置')
    }
  } catch (error) {
    console.error('[权限加载] 加载失败:', error)
    initializePermissions(currentExcelIds.value)
  }
}

// 保存权限配置数据
const savePermissionData = () => {
  if (!selectedTargetMode.value || !selectedVersion.value) {
    alert('请选择目标模式和版本')
    return
  }
  
  try {
    // 使用store统一接口保存权限配置
    const success = cardStore.savePermissionConfig(
      selectedTargetMode.value, 
      selectedVersion.value, 
      fineGrainedPermissions.value,
      {
        pushedBy: IdSvc.ROOT_ADMIN_MODE_ID,
        configuredExcelIds: currentExcelIds.value.length,
        configuredAt: new Date().toISOString()
      }
    )
    
    if (success) {
      hasUnsavedChanges.value = false
      console.log('[权限保存] 成功保存权限配置')
      alert('权限配置已保存')
    } else {
      throw new Error('保存失败')
    }
  } catch (error) {
    console.error('[权限保存] 保存失败:', error)
    alert('保存失败: ' + error.message)
  }
}

// 监听版本变化，自动加载ExcelID数据
watch(selectedVersion, async (newVersion) => {
  if (newVersion) {
    console.log(`[权限监听] 版本变化为: ${newVersion}，开始加载ExcelID数据`)
    await loadCurrentExcelIds()
    // 加载完成后，重新加载权限配置
    if (currentExcelIds.value.length > 0) {
      loadPermissionData()
    }
  } else {
    console.log('[权限监听] 版本清空，清空所有数据')
    currentExcelIds.value = []
    fineGrainedPermissions.value = {}
  }
}, { immediate: true })

// 监听ExcelID变化，重新加载权限 - 增强版本
watch(currentExcelIds, (newExcelIds, oldExcelIds) => {
  console.log(`\n=== [权限监听] ExcelID列表变化 ===`)
  console.log('旧列表:', oldExcelIds)
  console.log('新列表:', newExcelIds)
  
  if (newExcelIds && newExcelIds.length > 0) {
    console.log(`[权限监听] 检测到 ${newExcelIds.length} 个ExcelID，开始加载权限数据`)
    loadPermissionData()
    
    // 强制触发视图更新
    setTimeout(() => {
      console.log(`[权限监听] 延迟检查：权限对象包含 ${Object.keys(fineGrainedPermissions.value).length} 个ExcelID`)
      console.log(`[权限监听] 当前权限结构:`, Object.keys(fineGrainedPermissions.value))
    }, 100)
  } else {
    console.log('[权限监听] ExcelID列表为空，清空权限数据')
    fineGrainedPermissions.value = {}
  }
  console.log(`=== [权限监听] 监听处理完成 ===\n`)
}, { deep: true })

// 调试当前数据 - 专门针对空值数据问题和ExcelID分布问题
const debugCurrentData = () => {
  if (!selectedVersion.value) {
    alert('请先选择版本')
    return
  }
  
  try {
    console.log('\n\n=== 🔍 开始深度调试数据 (权限矩阵显示问题排查) ===')  
    console.log('选中版本:', selectedVersion.value)
    console.log('模式 ID:', IdSvc.ROOT_ADMIN_MODE_ID)
    
    // === 1. 全局localStorage扫描 ===
    console.log('\n--- 第一步：全局localStorage扫描 ---')
    const allLocalStorageKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) allLocalStorageKeys.push(key)
    }
    console.log(`localStorage总条目数: ${allLocalStorageKeys.length}`)
    
    // 过滤出相关的Key（包含版本和envFull的）
    const relevantKeys = allLocalStorageKeys.filter(key => {
      return key.includes(selectedVersion.value) && key.includes('envFull')
    })
    console.log(`与版本 ${selectedVersion.value} 和 envFull 相关的Key:`, relevantKeys)
    
    // 分析每个相关的Key
    const keyAnalysis = relevantKeys.map(key => {
      const data = localStorage.getItem(key)
      let parsedData = null
      try {
        parsedData = JSON.parse(data)
      } catch (e) {
        parsedData = { parseError: e.message }
      }
      
      // 尝试解析Key结构
      const keyParts = key.split(':')
      return {
        key,
        keyParts,
        dataLength: data ? data.length : 0,
        parsedData,
        isValidKey: keyParts.length === 5
      }
    })
    
    console.log('相关Key详细分析:', keyAnalysis)
    
    // === 2. 使用batchKeyOperation进行标准查询 ===
    console.log('\n--- 第二步：使用batchKeyOperation标准查询 ---')
    const allKeys = IdSvc.batchKeyOperation('export', {
      modeId: IdSvc.ROOT_ADMIN_MODE_ID,
      version: selectedVersion.value,
      type: 'envFull'
    })
    
    console.log(`batchKeyOperation 查询结果: ${allKeys.length} 条数据`)
    
    if (allKeys.length === 0) {
      console.warn('⚠️ 警告：batchKeyOperation 没有找到任何数据！')
      
      // 尝试不同的查询条件
      console.log('\n--- 尝试放宽查询条件 ---')
      const looseQuery = IdSvc.batchKeyOperation('export', {
        version: selectedVersion.value
      })
      console.log('仅按版本查询结果:', looseQuery.length, '条')
      
      const envFullQuery = IdSvc.batchKeyOperation('export', {
        type: 'envFull'
      })
      console.log('仅按envFull查询结果:', envFullQuery.length, '条')
      
      const modeQuery = IdSvc.batchKeyOperation('export', {
        modeId: IdSvc.ROOT_ADMIN_MODE_ID
      })
      console.log('仅按模式ID查询结果:', modeQuery.length, '条')
    }
    
    // === 3. ExcelID分析 ===
    let excelIdDistribution = {}
    let totalValidData = 0
    let totalEmptyData = 0
    
    allKeys.forEach((item, index) => {
      console.log(`\n--- 数据条目 ${index + 1} ---`)
      console.log(`Key: ${item.key}`)  
      console.log(`Fields:`, item.fields)
      console.log(`ExcelID: ${item.fields.excelId}`)
      
      const excelId = item.fields.excelId
      if (!excelIdDistribution[excelId]) {
        excelIdDistribution[excelId] = {
          count: 0,
          hasContent: 0,
          isEmpty: 0,
          examples: []
        }
      }
      excelIdDistribution[excelId].count++
      
      try {
        const parsedData = JSON.parse(item.data)
        console.log(`解析数据:`, parsedData)
        
        // 分析数据内容
        const hasContent = Object.values(parsedData).some(value => 
          value !== null && value !== undefined && value !== '' && 
          (Array.isArray(value) ? value.length > 0 : true)
        )
        
        if (hasContent) {
          totalValidData++
          excelIdDistribution[excelId].hasContent++
          console.log('✅ 该条目有内容')
        } else {
          totalEmptyData++
          excelIdDistribution[excelId].isEmpty++
          console.log('⚠️ 该条目为空值/空内容')
        }
        
        excelIdDistribution[excelId].examples.push({
          key: item.key,
          hasContent,
          dataSize: item.data.length
        })
        
      } catch (parseError) {
        console.error('数据解析失败:', parseError, '原始数据:', item.data)
        excelIdDistribution[excelId].examples.push({
          key: item.key,
          parseError: parseError.message
        })
      }
    })
    
    // === 4. 综合分析报告 ===
    console.log('\n=== 📊 综合分析报告 ===') 
    console.log(`总数据条目: ${allKeys.length}`)
    console.log(`有内容的条目: ${totalValidData}`)
    console.log(`空值/空内容条目: ${totalEmptyData}`)
    console.log(`ExcelID 分布统计:`, excelIdDistribution)
    console.log('当前 currentExcelIds 计算结果:', currentExcelIds.value)
    console.log('当前权限对象结构:', Object.keys(fineGrainedPermissions.value))
    
    // === 5. 问题诊断 ===
    console.log('\n=== 🩺 问题诊断 ===') 
    const uniqueExcelIds = Object.keys(excelIdDistribution)
    
    if (uniqueExcelIds.length === 0) {
      console.log('🚨 严重问题：没有找到任何ExcelID数据！')
    } else if (uniqueExcelIds.length === 1 && uniqueExcelIds[0] === 'A0') {
      console.log('🔴 确认问题：只有A0数据存在')
      console.log('   - 这可能意味着：')
      console.log('     1. 数据确实只有A0卡片')
      console.log('     2. 其他卡片数据存储位置不正确')
      console.log('     3. 数据查询条件过于严格')
    } else {
      console.log(`🟢 数据正常：找到 ${uniqueExcelIds.length} 个不同的ExcelID`)
      console.log('   ExcelID列表:', uniqueExcelIds)
      
      if (currentExcelIds.value.length !== uniqueExcelIds.length) {
        console.log('🟡 计算问题：currentExcelIds计算结果与实际数据不符')
        console.log('   实际ExcelID:', uniqueExcelIds)
        console.log('   计算结果:', currentExcelIds.value)
      }
    }
    
    console.log('=== 🔍 深度调试数据结束 ===\n\n')  
    
    // 显示用户友好的总结报告
    const summary = `🔍 权限矩阵显示问题调试报告

📋 基本信息:
版本: ${selectedVersion.value}
模式: ${IdSvc.ROOT_ADMIN_MODE_ID}
总数据条目: ${allKeys.length}

📊 ExcelID分布:
${Object.entries(excelIdDistribution).map(([id, stats]) => 
  `${id}: ${stats.count}条 (内容${stats.hasContent}条, 空${stats.isEmpty}条)`
).join('\n')}

🔍 当前显示:
ExcelID计算结果: ${currentExcelIds.value.join(', ') || '无'}
权限对象包含: ${Object.keys(fineGrainedPermissions.value).join(', ') || '无'}

💡 问题分析:
${uniqueExcelIds.length === 0 ? '❌ 未找到任何ExcelID数据' :
  uniqueExcelIds.length === 1 && uniqueExcelIds[0] === 'A0' ? '⚠️ 仅找到A0数据，可能其他卡片数据存储异常' :
  currentExcelIds.value.length === uniqueExcelIds.length ? '✅ 数据计算正常' :
  '🔧 数据存在但计算逻辑需要调整'}

🛠️ 建议操作:
${uniqueExcelIds.length === 0 ? '1. 检查数据是否正确保存\n2. 确认版本号和模式ID正确' :
  uniqueExcelIds.length === 1 ? '1. 检查其他卡片数据是否正确存储\n2. 尝试重新保存完整数据' :
  '1. 检查计算逻辑\n2. 查看控制台详细日志'}

详细调试信息已输出到控制台（按F12查看）`
    
    alert(summary)
    
  } catch (error) {
    console.error('调试数据失败:', error)
    alert('调试数据失败: ' + error.message)
  }
}

// 同步变化处理（完全独立，无关联）
// eslint-disable-next-line no-unused-vars
const onSyncChange = (excelId, field, checked) => {
  // 同步变化不影响授权状态
  hasUnsavedChanges.value = true
}

// 授权变化处理（完全独立，无关联）
// eslint-disable-next-line no-unused-vars
const onAuthChange = (excelId, field, checked) => {
  // 授权变化不影响同步状态
  hasUnsavedChanges.value = true
}

// 批量操作（同步和授权完全独立）
const batchOperation = (action) => {
  console.log(`[批量操作] 执行操作: ${action}`)
  const excelIds = currentExcelIds.value
  const fields = fieldTypes
  
  if (excelIds.length === 0) {
    console.warn('[批量操作] 没有可操作的ExcelID')
    return
  }
  
  console.log(`[批量操作] 将对 ${excelIds.length} 个ExcelID 的 ${fields.length} 个字段执行操作`)
  
  excelIds.forEach(excelId => {
    if (!fineGrainedPermissions.value[excelId]) {
      console.warn(`[批量操作] ExcelID ${excelId} 的权限数据未初始化，跳过`)
      return
    }
    
    fields.forEach(field => {
      if (!fineGrainedPermissions.value[excelId][field]) {
        console.warn(`[批量操作] ExcelID ${excelId} 的字段 ${field} 未初始化，跳过`)
        return
      }
      
      switch (action) {
        case 'allSync':
          // 全部同步：只操作同步，不影响授权
          fineGrainedPermissions.value[excelId][field].sync = true
          break
          
        case 'allAuth':
          // 全部授权：只操作授权，不影响同步
          fineGrainedPermissions.value[excelId][field].auth = true
          break
          
        case 'clearAll':
          // 清空所有：清空同步和授权
          fineGrainedPermissions.value[excelId][field].sync = false
          fineGrainedPermissions.value[excelId][field].auth = false
          break
          
        case 'syncToAuth':
          // 同步→授权：将已勾选同步的项目设置为授权
          if (fineGrainedPermissions.value[excelId][field].sync) {
            fineGrainedPermissions.value[excelId][field].auth = true
          }
          break
          
        case 'syncPlusAuth':
          // 同步+授权：同时全选同步和授权
          fineGrainedPermissions.value[excelId][field].sync = true
          fineGrainedPermissions.value[excelId][field].auth = true
          break
          
        case 'random': {
          // 随机配置：独立随机设置同步和授权
          fineGrainedPermissions.value[excelId][field].sync = Math.random() > 0.5
          fineGrainedPermissions.value[excelId][field].auth = Math.random() > 0.5
          break
        }
        
        default:
          console.warn(`[批量操作] 未知操作类型: ${action}`)
          return
      }
    })
  })
  
  console.log(`[批量操作] 操作 ${action} 完成`)
  hasUnsavedChanges.value = true
}

// 执行推送 - 确保目标模式ID下最多只有一条全量区内容
const executePush = async () => {
  if (!selectedTargetMode.value || !selectedVersion.value) {
    alert('请选择目标模式和版本')
    return
  }
  
  isPushing.value = true
  
  try {
    console.log(`[推送] 开始精细化推送: ${selectedVersion.value} -> ${selectedTargetMode.value}`)
    console.log(`[推送] 使用权限配置:`, fineGrainedPermissions.value)
    
    // 1. 唯一性控制（保留原逻辑或沿用 helper.ensureEnvFullUniqueness）
    const isTargetRootAdmin = selectedTargetMode.value === IdSvc.ROOT_ADMIN_MODE_ID
    console.log(`[推送] 目标模式: ${selectedTargetMode.value}, 是否为主模式: ${isTargetRootAdmin}`)
    
    let deletedCount = 0
    
    if (!isTargetRootAdmin) {
      // 其他模式：严格唯一性控制
      console.log(`[推送] 目标为其他模式 ${selectedTargetMode.value}，执行唯一性控制`)
      
      const existingKeys = IdSvc.batchKeyOperation('export', {
        modeId: selectedTargetMode.value,
        type: 'envFull'
      })
      
      console.log(`[推送] 其他模式下现有全量区内容: ${existingKeys.length} 条`)
      
      if (existingKeys.length > 1) {
        console.warn(`[推送] ⚠️ 发现异常：其他模式下有 ${existingKeys.length} 条全量区内容，违反唯一性规则！`)
      }
      
      // 清理其他模式下的所有全量区内容（确保唯一性）
      deletedCount = IdSvc.batchKeyOperation('delete', {
        modeId: selectedTargetMode.value,
        type: 'envFull'
      })
      console.log(`[推送] 清理其他模式下所有全量区内容: ${deletedCount} 条`)
    } else {
      // 主模式：无限制，允许多条全量区内容
      console.log(`[推送] 目标为主模式 ${selectedTargetMode.value}，跳过唯一性控制`)
      console.log(`[推送] 主模式允许任意数量的全量区内容，版本间独立存储`)
    }
    
    // 2. 读取源快照（root_admin + 版本 + envFull:A0）
    const sourceSnap = loadRootEnvFullSnapshotWithSerialization(cardStore, IdSvc, selectedVersion.value)
    if (!sourceSnap) throw new Error('没有可推送的数据')
    
    // 3. 仅按“同步”勾选克制（授权不影响数据层）
    const maskedSnap = maskEnvBySyncOnly(sourceSnap, fineGrainedPermissions.value)
    
    // 4. 写入目标模式：一条 A0（serialization.js 负责序列化写入）
    writeTargetEnvFullSnapshotWithSerialization(
      cardStore,
      selectedTargetMode.value,
      selectedVersion.value,
      maskedSnap
    )
    const copiedCount = 1
    const tamperReports = [] // 如需展示详细克制项，可在 maskEnvBySyncOnly 内累积返回
    
    // 5. 推送权限配置信息（使用store统一接口）
    const permissionSaveSuccess = cardStore.savePermissionConfig(
      selectedTargetMode.value,
      selectedVersion.value,
      fineGrainedPermissions.value,
      {
        pushedBy: IdSvc.ROOT_ADMIN_MODE_ID,
        pushedAt: new Date().toISOString(),
        sourceVersion: selectedVersion.value,
        copiedCount: copiedCount,
        uniquenessRule: '目标模式下最多只能有一条全量区内容'
      }
    )
    
    if (permissionSaveSuccess) {
      console.log(`[推送] 权限配置已推送`)
    } else {
      console.warn(`[推送] 权限配置推送失败`)
    }
    
    // 6. 最终验证：根据模式类型进行相应验证
    const finalCheck = IdSvc.batchKeyOperation('export', {
      modeId: selectedTargetMode.value,
      type: 'envFull'
    })
    
    let uniquenessValidation = {}
    
    if (isTargetRootAdmin) {
      // 主模式：无需验证唯一性，允许多条
      console.log(`[推送] ✅ 主模式验证：${selectedTargetMode.value} 下有 ${finalCheck.length} 条全量区内容（无限制）`)
      uniquenessValidation = {
        finalCount: finalCheck.length,
        isValid: true,
        rule: '主模式无唯一性限制，允许任意数量全量区内容'
      }
    } else {
      // 其他模式：验证唯一性
      if (finalCheck.length === 1) {
        console.log(`[推送] ✅ 其他模式验证通过：${selectedTargetMode.value} 下有且仅有 1 条全量区内容`)
        uniquenessValidation = {
          finalCount: finalCheck.length,
          isValid: true,
          rule: '其他模式下最多只能有一条全量区内容'
        }
      } else {
        console.error(`[推送] ❌ 其他模式验证失败：下有 ${finalCheck.length} 条全量区内容，违反唯一性规则！`)
        uniquenessValidation = {
          finalCount: finalCheck.length,
          isValid: false,
          rule: '其他模式下最多只能有一条全量区内容'
        }
      }
    }
    
    // 7. 构建推送报告
    const report = {
      targetMode: selectedTargetMode.value,
      version: selectedVersion.value,
      copiedCount,
      tamperReports,
      permissionSummary: generatePermissionSummary(),
      permissionConfig: fineGrainedPermissions.value,
      timestamp: new Date().toISOString(),
      uniquenessValidation
    }
    
    // 8. 成功回调
    emit('push-success', report)
    
    // 显示成功信息
    const tamperSummary = tamperReports.length > 0 
      ? `\n数据篡改: ${tamperReports.length} 项`
      : '\n无数据篡改'
    
    const excelIdCount = currentExcelIds.value.length
    const permissionCount = Object.keys(fineGrainedPermissions.value).length
    const uniquenessStatus = uniquenessValidation.isValid ? 
      `✅ 唯一性检查通过 (${isTargetRootAdmin ? '主模式无限制' : '其他模式唯一性'})` : 
      `❌ 唯一性检查失败(${finalCheck.length}条)`
    
    alert(`推送成功！\n目标: ${selectedTargetMode.value}\n版本: ${selectedVersion.value}\n条目: ${copiedCount}\nExcelID: ${excelIdCount} 个\n权限配置: ${permissionCount} 个ExcelID${tamperSummary}\n${uniquenessStatus}`)
    
  } catch (error) {
    console.error('[推送] 失败:', error)
    emit('push-error', error)
    alert('推送失败: ' + error.message)
  } finally {
    isPushing.value = false
  }
}

// 生成权限配置摘要
const generatePermissionSummary = () => {
  const summary = {
    totalExcelIds: Object.keys(fineGrainedPermissions.value).length,
    syncCount: 0,
    authCount: 0,
    details: {}
  }
  
  Object.entries(fineGrainedPermissions.value).forEach(([excelId, permissions]) => {
    const excelSummary = {
      syncFields: [],
      authFields: [],
      readOnlyFields: [],
      hiddenFields: []
    }
    
    fieldTypes.forEach(field => {
      const perm = permissions[field]
      if (perm.sync && perm.auth) {
        excelSummary.syncFields.push(field)
        summary.authCount++
      } else if (perm.sync && !perm.auth) {
        excelSummary.readOnlyFields.push(field)
      } else {
        excelSummary.hiddenFields.push(field)
      }
      
      if (perm.sync) {
        summary.syncCount++
      }
    })
    
    summary.details[excelId] = excelSummary
  })
  
  return summary
}
</script>

<style scoped>
.permission-push-valve {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;
  background-color: #fafafa;
}

.valve-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.valve-row {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.valve-row label {
  font-weight: bold;
  min-width: 80px;
}

.mode-select, .version-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 200px;
}

/* 数据状态显示 */
.data-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: #f0f8f0;
  border: 1px solid #4caf50;
  border-radius: 4px;
}

.status-label {
  font-weight: bold;
  color: #2e7d32;
}

.excel-count {
  background-color: #e8f5e8;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  color: #2e7d32;
}

.version-info, .mode-info {
  background-color: #e3f2fd;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  color: #1976d2;
}

.reload-btn, .save-btn, .debug-btn {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background-color: #fff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.reload-btn:hover {
  background-color: #e3f2fd;
}

.save-btn {
  background-color: #4caf50;
  color: white;
  border-color: #4caf50;
}

.save-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.save-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.debug-btn {
  background-color: #ff9800;
  color: white;
  border-color: #ff9800;
}

.debug-btn:hover {
  background-color: #f57c00;
}

.config-section {
  margin-bottom: 20px;
}

.config-section h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.fixed-hint {
  font-size: 12px;
  color: #666;
  font-weight: normal;
}

.fixed-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.fixed-field {
  padding: 4px 8px;
  background-color: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 4px;
  font-size: 12px;
  color: #2e7d32;
}

.logic-explanation {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 10px;
}

.logic-explanation small {
  color: #6c757d;
  line-height: 1.4;
}

/* 权限矩阵样式 - 双列表格布局 */
.permission-matrix {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  background-color: white;
  width: 100%;
  box-sizing: border-box;
}

.matrix-info {
  font-size: 12px;
  color: #666;
  font-weight: normal;
}

.matrix-debug {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 10px;
  font-family: monospace;
}

.matrix-container {
  width: 100%;
  margin-bottom: 15px;
}

/* 双列布局 */
.matrix-columns {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.matrix-column {
  flex: 1;
  min-width: 400px;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background-color: white;
}

/* 表头样式 */
.matrix-header {
  display: flex;
  border-bottom: 2px solid #333;
  font-weight: bold;
  background-color: #f5f5f5;
  width: 100%;
  min-width: fit-content;
  flex-wrap: nowrap;
}

.excel-id-header {
  min-width: 100px;
  width: 100px;
  padding: 12px 8px;
  border-right: 1px solid #ddd;
  text-align: center;
  flex-shrink: 0;
  background-color: #e8f4fd;
}

.field-header {
  min-width: 140px;
  width: 140px;
  padding: 8px;
  border-right: 1px solid #ddd;
  text-align: center;
  flex-shrink: 0;
  background-color: #f0f8ff;
}

.field-sub-headers {
  display: flex;
  justify-content: space-around;
  margin-top: 5px;
  font-size: 10px;
  gap: 10px;
}

.sync-header {
  color: #2196f3;
  font-weight: bold;
}

.auth-header {
  color: #ff9800;
  font-weight: bold;
}

/* 矩阵内容样式 */
.matrix-content {
  max-height: 500px;
  overflow-y: auto;
  overflow-x: visible;
  width: 100%;
  border-top: none;
}

.matrix-row {
  display: flex;
  border-bottom: 1px solid #eee;
  width: 100%;
  min-width: fit-content;
  flex-wrap: nowrap;
  transition: background-color 0.2s;
}

.matrix-row:hover {
  background-color: #f8f9fa;
}

.matrix-row:nth-child(even) {
  background-color: #fafafa;
}

.excel-id-cell {
  min-width: 100px;
  width: 100px;
  padding: 12px 8px;
  border-right: 1px solid #ddd;
  text-align: center;
  font-weight: bold;
  background-color: #f9f9f9;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  color: #333;
}

.field-cell {
  min-width: 140px;
  width: 140px;
  padding: 8px;
  border-right: 1px solid #ddd;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.field-controls-matrix {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  gap: 15px;
}

.field-controls-error {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  color: #dc3545;
  font-size: 10px;
}

.error-text {
  background-color: #ffe6e6;
  padding: 2px 4px;
  border-radius: 2px;
  border: 1px solid #ffcccc;
}

.matrix-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-width: 20px;
}

.matrix-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  transform: scale(1.1);
}

.matrix-checkbox.sync input[type="checkbox"]:checked {
  accent-color: #2196f3;
}

.matrix-checkbox.auth input[type="checkbox"]:checked {
  accent-color: #ff9800;
}

/* 空状态和占位符 */
.matrix-empty, .matrix-placeholder {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px dashed #ddd;
}

.matrix-empty p, .matrix-placeholder p {
  margin: 0;
  font-size: 14px;
}

/* 响应式调整 */
@media (max-width: 1000px) {
  .matrix-columns {
    flex-direction: column;
  }
  
  .matrix-column {
    min-width: 100%;
  }
}

@media (max-width: 600px) {
  .matrix-column {
    min-width: 100%;
  }
  
  .field-header, .field-cell {
    min-width: 100px;
    width: 100px;
  }
  
  .excel-id-header, .excel-id-cell {
    min-width: 80px;
    width: 80px;
  }
}

.matrix-actions {
  display: flex;
  gap: 8px;
  margin-top: 15px;
  flex-wrap: wrap;
}

.matrix-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #e3f2fd;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.matrix-btn:hover {
  background-color: #bbdefb;
}

.push-action {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.push-button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background-color: #4caf50;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.push-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.push-button:hover:not(:disabled) {
  background-color: #45a049;
}

.push-summary {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #666;
  margin-left: 15px;
}

.push-summary span {
  background-color: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
