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
      
      <!-- 数据加载状态 -->
      <div class="valve-row" v-if="selectedVersion">
        <div class="data-status">
          <span class="status-label">数据状态:</span>
          <span class="excel-count">{{ currentExcelIds.length }} 个ExcelID</span>
          <span class="version-info">版本: {{ selectedVersion }}</span>
          <span class="mode-info">模式: {{ IdSvc.ROOT_ADMIN_MODE_ID }}</span>
          <button @click="loadPermissionData" class="reload-btn">重新加载</button>
          <button @click="savePermissionData" class="save-btn" :disabled="!hasUnsavedChanges">保存配置</button>
          <button @click="debugCurrentData" class="debug-btn">调试数据</button>
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
      </div>
      
      <!-- 精细化权限矩阵 - 弹性显示增强版 -->
      <div class="permission-matrix" v-if="currentExcelIds.length > 0">
        <h4>精细化权限控制矩阵 <span class="matrix-info">({{ currentExcelIds.length }} 个ExcelID)</span></h4>
        
        <!-- 调试信息 -->
        <div class="matrix-debug" v-if="currentExcelIds.length > 0">
          <small>当前ExcelID: {{ currentExcelIds.join(', ') }}</small>
        </div>
        
        <!-- 弹性矩阵容器 -->
        <div class="matrix-container">
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
          
          <!-- 矩阵内容 - 确保所有ExcelID都显示 -->
          <div class="matrix-content">
            <div 
              v-for="excelId in currentExcelIds" 
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
                  <span class="error-text">数据未初始化</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 批量操作 -->
        <div class="matrix-actions">
          <button @click="batchOperation('allSync')" class="matrix-btn">全部同步</button>
          <button @click="batchOperation('allAuth')" class="matrix-btn">全部授权</button>
          <button @click="batchOperation('clearAll')" class="matrix-btn">清空所有</button>
          <button @click="batchOperation('syncToAuth')" class="matrix-btn">同步→授权</button>
          <button @click="batchOperation('random')" class="matrix-btn">随机配置</button>
        </div>
      </div>
      
      <!-- 推送按钮 -->
      <div class="valve-row push-action">
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
import { ref, watch } from 'vue'
import * as IdSvc from './Data/services/id.js'
import { useCardStore } from './Data/store.js'

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
    
    // 通过cardStore的getEnvFullSnapshot方法获取环境快照数据
    const snapData = await cardStore.getEnvFullSnapshot(selectedVersion.value)
    
    if (!snapData) {
      console.warn(`[权限矩阵] 未找到版本 ${selectedVersion.value} 的快照数据`)
      currentExcelIds.value = []
      return
    }
    
    console.log(`[权限矩阵] 成功通过store加载快照数据:`, snapData)
    console.log(`[权限矩阵] 快照数据类型: ${typeof snapData}`)
    console.log(`[权限矩阵] 快照数据包含的字段:`, Object.keys(snapData || {}))
    
    // 从快照数据中提取ExcelID - 遵循CardSection.vue的成功做法
    const env = snapData?.environment || { cards: {}, options: {} }
    const envOptions = env.options || {}
    
    console.log(`[权限矩阵] environment.options:`, envOptions)
    console.log(`[权限矩阵] environment.options类型: ${typeof envOptions}`)
    
    if (envOptions && typeof envOptions === 'object' && !Array.isArray(envOptions)) {
      const excelIdKeys = Object.keys(envOptions)
      console.log(`[权限矩阵] Object.keys(envOptions) 结果:`, excelIdKeys)
      console.log(`[权限矩阵] environment.options包含 ${excelIdKeys.length} 个ExcelID`)
      console.log(`[权限矩阵] 具体的ExcelID列表:`, excelIdKeys)
      
      if (excelIdKeys.length > 0) {
        // 使用ID体系中的compareFullOptionIds进行排序
        const sortedExcelIds = excelIdKeys.sort((a, b) => {
          try {
            if (IdSvc.compareFullOptionIds) {
              return IdSvc.compareFullOptionIds(a, b)
            }
            // 备用排序：先按卡片ID，再按选项ID
            const aMatch = a.match(/^([A-Z]+)(\d+)$/)
            const bMatch = b.match(/^([A-Z]+)(\d+)$/)
            if (aMatch && bMatch) {
              const cardCompare = aMatch[1].localeCompare(bMatch[1])
              if (cardCompare !== 0) return cardCompare
              return parseInt(aMatch[2]) - parseInt(bMatch[2])
            }
            return a.localeCompare(b)
          } catch (error) {
            console.warn('[权限矩阵] 排序失败，使用默认排序:', error)
            return a.localeCompare(b)
          }
        })
        
        console.log(`[权限矩阵] 排序后的ExcelID列表:`, sortedExcelIds)
        console.log(`=== [权限矩阵] ExcelID 计算完成，共 ${sortedExcelIds.length} 个 ===\n`)
        
        currentExcelIds.value = sortedExcelIds
        return
      }
    }
    
    // 如果environment.options为空，尝试从fullConfigs获取（备用方案）
    console.warn(`[权限矩阵] environment.options为空，尝试从fullConfigs获取`)
    const fullConfigs = snapData?.fullConfigs || {}
    if (fullConfigs && typeof fullConfigs === 'object') {
      const fullConfigIds = Object.keys(fullConfigs)
      console.log(`[权限矩阵] 从fullConfigs提取到 ${fullConfigIds.length} 个ExcelID:`, fullConfigIds)
      
      if (fullConfigIds.length > 0) {
        const sortedFullIds = fullConfigIds.sort(IdSvc.compareFullOptionIds || ((a, b) => a.localeCompare(b)))
        console.log(`[权限矩阵] 备用方案成功，返回 ${sortedFullIds.length} 个ExcelID`)
        currentExcelIds.value = sortedFullIds
        return
      }
    }
    
    console.error(`[权限矩阵] 无法从任何路径提取ExcelID数据！`)
    currentExcelIds.value = []
    
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
    // 构建权限配置的存储Key
    const permissionKey = `permission:${selectedTargetMode.value}:${selectedVersion.value}`
    const savedPermissions = localStorage.getItem(permissionKey)
    
    if (savedPermissions) {
      const parsed = JSON.parse(savedPermissions)
      console.log('[权限加载] 加载已保存的权限配置:', parsed)
      
      // 合并加载的配置和当前ExcelID列表
      const currentIds = currentExcelIds.value
      const newPermissions = {}
      
      currentIds.forEach(excelId => {
        if (parsed[excelId]) {
          // 使用已保存的配置
          newPermissions[excelId] = parsed[excelId]
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
    const permissionKey = `permission:${selectedTargetMode.value}:${selectedVersion.value}`
    const dataToSave = JSON.stringify(fineGrainedPermissions.value, null, 2)
    
    localStorage.setItem(permissionKey, dataToSave)
    hasUnsavedChanges.value = false
    
    console.log('[权限保存] 成功保存到:', permissionKey)
    console.log('[权限保存] 数据:', fineGrainedPermissions.value)
    alert('权限配置已保存')
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

// 同步变化处理 (智能关联：勾选授权时自动勾选同步)
const onSyncChange = (excelId, field, checked) => {
  if (!checked) {
    // 取消同步时，自动取消授权
    fineGrainedPermissions.value[excelId][field].auth = false
  }
  hasUnsavedChanges.value = true
}

// 授权变化处理 (智能关联：勾选授权时自动勾选同步)
const onAuthChange = (excelId, field, checked) => {
  if (checked) {
    // 勾选授权时，自动勾选同步
    fineGrainedPermissions.value[excelId][field].sync = true
  }
  hasUnsavedChanges.value = true
}

// 批量操作
const batchOperation = (action) => {
  const excelIds = currentExcelIds.value
  const fields = fieldTypes
  
  excelIds.forEach(excelId => {
    fields.forEach(field => {
      switch (action) {
        case 'allSync':
          fineGrainedPermissions.value[excelId][field].sync = true
          break
        case 'allAuth':
          fineGrainedPermissions.value[excelId][field].auth = true
          // 授权时自动同步
          fineGrainedPermissions.value[excelId][field].sync = true
          break
        case 'clearAll':
          fineGrainedPermissions.value[excelId][field].sync = false
          fineGrainedPermissions.value[excelId][field].auth = false
          break
        case 'syncToAuth':
          if (fineGrainedPermissions.value[excelId][field].sync) {
            fineGrainedPermissions.value[excelId][field].auth = true
          }
          break
        case 'random': {
          const shouldSync = Math.random() > 0.5
          fineGrainedPermissions.value[excelId][field].sync = shouldSync
          fineGrainedPermissions.value[excelId][field].auth = shouldSync ? Math.random() > 0.3 : false
          break
        }
      }
    })
  })
  
  hasUnsavedChanges.value = true
}

// 数据篡改逻辑 - 根据精细化权限配置克制数据（支持环境快照模式）
const tamperDataWithPermissions = (originalData, excelId) => {
  try {
    const parsedData = JSON.parse(originalData)
    
    // 检查是否为环境快照数据
    if (parsedData.fullConfigs && typeof parsedData.fullConfigs === 'object') {
      // 环境快照模式：处理整个fullConfigs对象
      console.log('[数据篡改] 检测到环境快照数据，进行批量处理')
      
      let modifiedData = JSON.parse(JSON.stringify(parsedData)) // 深拷贝
      let tamperReport = []
      
      // 遍历所有fullConfigs中的ExcelID
      Object.keys(parsedData.fullConfigs).forEach(currentExcelId => {
        // const itemData = parsedData.fullConfigs[currentExcelId] // 暂不直接使用
        
        // 检查是否有该ExcelID的权限配置
        if (fineGrainedPermissions.value[currentExcelId]) {
          const permissions = fineGrainedPermissions.value[currentExcelId]
          
          // 对每个字段进行权限检查
          fieldTypes.forEach(fieldType => {
            const fieldPermission = permissions[fieldType]
            const fieldLabel = fieldLabels[fieldType]
            
            // 根据字段类型确定对应的属性名
            let propertyName
            switch (fieldType) {
              case 'name': 
                propertyName = 'optionName'
                break
              case 'value': 
                propertyName = 'optionValue'
                break
              case 'unit': 
                propertyName = 'optionUnit'
                break
              default: 
                return // 跳过未知字段类型
            }
            
            if (!fieldPermission.sync) {
              // 不同步：设为null
              if (modifiedData.fullConfigs[currentExcelId][propertyName] !== undefined) {
                modifiedData.fullConfigs[currentExcelId][propertyName] = null
                tamperReport.push(`${currentExcelId}.${fieldLabel}: 克制为null (未同步)`)
              }
            } else {
              // 同步但检查授权状态 (用于报告)
              if (fieldPermission.auth) {
                tamperReport.push(`${currentExcelId}.${fieldLabel}: 同步+可编辑`)
              } else {
                tamperReport.push(`${currentExcelId}.${fieldLabel}: 同步+只读`)
              }
            }
          })
        } else {
          // 没有权限配置，默认全部不同步
          fieldTypes.forEach(fieldType => {
            let propertyName
            switch (fieldType) {
              case 'name': 
                propertyName = 'optionName'
                break
              case 'value': 
                propertyName = 'optionValue'
                break
              case 'unit': 
                propertyName = 'optionUnit'
                break
              default: 
                return // 跳过未知字段类型
            }
            
            if (modifiedData.fullConfigs[currentExcelId][propertyName] !== undefined) {
              modifiedData.fullConfigs[currentExcelId][propertyName] = null
              tamperReport.push(`${currentExcelId}.${fieldLabels[fieldType]}: 克制为null (无权限配置)`)
            }
          })
        }
      })
      
      // 同时更新environment.options中的对应数据
      if (modifiedData.environment && modifiedData.environment.options) {
        Object.keys(modifiedData.environment.options).forEach(optionId => {
          if (fineGrainedPermissions.value[optionId]) {
            const permissions = fineGrainedPermissions.value[optionId]
            const optionData = modifiedData.environment.options[optionId]
            
            fieldTypes.forEach(fieldType => {
              const fieldPermission = permissions[fieldType]
              
              if (!fieldPermission.sync && optionData[fieldType] !== undefined) {
                optionData[fieldType] = null
              }
            })
          }
        })
      }
      
      return {
        modifiedData: JSON.stringify(modifiedData),
        tamperReport
      }
    } else {
      // 单个ExcelID模式：原有逻辑
      let modifiedData = { ...parsedData }
      let tamperReport = []
      
      // 检查是否有该ExcelID的权限配置
      if (fineGrainedPermissions.value[excelId]) {
        const permissions = fineGrainedPermissions.value[excelId]
        
        // 对每个字段进行权限检查
        fieldTypes.forEach(fieldType => {
          const fieldPermission = permissions[fieldType]
          const fieldLabel = fieldLabels[fieldType]
          
          if (!fieldPermission.sync) {
            // 不同步：设为null
            if (modifiedData[fieldType] !== undefined) {
              modifiedData[fieldType] = null
              tamperReport.push(`${fieldLabel}: 克制为null (未同步)`)
            }
          } else {
            // 同步但检查授权状态 (用于报告)
            if (fieldPermission.auth) {
              tamperReport.push(`${fieldLabel}: 同步+可编辑`)
            } else {
              tamperReport.push(`${fieldLabel}: 同步+只读`)
            }
          }
        })
      } else {
        // 没有权限配置，默认全部不同步
        fieldTypes.forEach(fieldType => {
          if (modifiedData[fieldType] !== undefined) {
            modifiedData[fieldType] = null
            tamperReport.push(`${fieldLabels[fieldType]}: 克制为null (无权限配置)`)
          }
        })
      }
      
      return {
        modifiedData: JSON.stringify(modifiedData),
        tamperReport
      }
    }
  } catch (error) {
    console.warn('数据篡改失败，使用原始数据:', error)
    return {
      modifiedData: originalData,
      tamperReport: ['数据解析失败，未进行篡改']
    }
  }
}

// 执行推送 - 支持环境快照模式
const executePush = async () => {
  if (!selectedTargetMode.value || !selectedVersion.value) {
    alert('请选择目标模式和版本')
    return
  }
  
  if (hasUnsavedChanges.value) {
    const shouldSave = confirm('您有未保存的权限配置，是否先保存？')
    if (shouldSave) {
      savePermissionData()
    }
  }
  
  isPushing.value = true
  
  try {
    console.log(`[推送] 开始精细化推送: ${selectedVersion.value} -> ${selectedTargetMode.value}`)
    console.log(`[推送] 使用权限配置:`, fineGrainedPermissions.value)
    
    // 1. 清理目标模式旧数据
    const deletedCount = IdSvc.batchKeyOperation('delete', {
      modeId: selectedTargetMode.value,
      type: 'envFull'
    })
    console.log(`[推送] 清理旧数据: ${deletedCount} 条`)
    
    // 2. 获取源数据（环境快照）
    const sourceKeys = IdSvc.batchKeyOperation('export', {
      modeId: IdSvc.ROOT_ADMIN_MODE_ID,
      version: selectedVersion.value,
      type: 'envFull',
      excelId: 'A0'  // 环境快照统一存储在A0下
    })
    console.log(`[推送] 源数据: ${sourceKeys.length} 条`)
    
    if (sourceKeys.length === 0) {
      throw new Error('没有可推送的数据')
    }
    
    // 3. 处理环境快照数据并推送
    let copiedCount = 0
    let tamperReports = []
    
    sourceKeys.forEach(({ key, fields, data }) => {
      try {
        console.log(`[推送] 处理环境快照: ${key}`)
        
        // 数据篡改 (根据精细化权限配置)
        const { modifiedData, tamperReport } = tamperDataWithPermissions(data, fields.excelId)
        
        // 构建目标Key
        const targetKey = IdSvc.buildKey({
          prefix: fields.prefix,
          modeId: selectedTargetMode.value,
          version: fields.version,
          type: fields.type,
          excelId: fields.excelId
        })
        
        // 存储到目标位置
        localStorage.setItem(targetKey, modifiedData)
        copiedCount++
        
        if (tamperReport.length > 0) {
          tamperReports.push(`环境快照: ${tamperReport.join(', ')}`)
        }
        
        console.log(`[推送] 处理完成: ${key} -> ${targetKey}`)
        console.log(`[推送] 篡改报告:`, tamperReport)
      } catch (error) {
        console.error(`[推送] 处理失败:`, key, error)
      }
    })
    
    // 4. 构建推送报告
    const report = {
      targetMode: selectedTargetMode.value,
      version: selectedVersion.value,
      copiedCount,
      tamperReports,
      permissionSummary: generatePermissionSummary(),
      timestamp: new Date().toISOString()
    }
    
    // 5. 成功回调
    emit('push-success', report)
    
    // 显示成功信息
    const tamperSummary = tamperReports.length > 0 
      ? `\n数据篡改: ${tamperReports.length} 项`
      : '\n无数据篡改'
    
    const excelIdCount = currentExcelIds.value.length
    
    alert(`推送成功！\n目标: ${selectedTargetMode.value}\n版本: ${selectedVersion.value}\n条目: ${copiedCount}\nExcelID: ${excelIdCount} 个${tamperSummary}`)
    
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
}

.fixed-field {
  padding: 4px 8px;
  background-color: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 4px;
  font-size: 12px;
  color: #2e7d32;
}

/* 权限矩阵样式 - 弹性显示增强版 */
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
  overflow-x: auto;
  overflow-y: visible;
}

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

.matrix-content {
  max-height: 500px;
  overflow-y: auto;
  overflow-x: visible;
  width: 100%;
  border: 1px solid #eee;
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