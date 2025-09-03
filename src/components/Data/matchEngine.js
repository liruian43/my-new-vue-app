// src/components/Data/matchEngine.js
import { ID } from './services/id.js'

// 新增：五段式 Key 比对工具（仅用于“数据比对过程”，不属于 id.js 的职责）
// 规则：
// - 原始五段顺序严格保持：prefix, modeId, version, type, excelId
// - 前四段一律严格校验（不可跳过或变更顺序）
// - 若任意一方的第五段为占位符 'main'，则跳过第五段的校验（不参与相等性判断）
// 返回结构包含每段的对比详情与 overallEqual 标记，便于上层做差异化处理
export function compareFiveSegmentKeys(keyA, keyB) {
  const parsedA = ID.parseKey(keyA)
  const parsedB = ID.parseKey(keyB)

  if (!parsedA.valid || !parsedB.valid) {
    return {
      valid: false,
      error: '存在无效的五段式 Key',
      a: parsedA,
      b: parsedB
    }
  }

  const names = ['prefix', 'modeId', 'version', 'type', 'excelId']
  const segsA = [parsedA.prefix, parsedA.modeId, parsedA.version, parsedA.type, parsedA.excelId]
  const segsB = [parsedB.prefix, parsedB.modeId, parsedB.version, parsedB.type, parsedB.excelId]

  const skipFifth = ID.isMainPlaceholder(parsedA.excelId) || ID.isMainPlaceholder(parsedB.excelId)
  const segments = []

  for (let i = 0; i < 5; i++) {
    if (i === 4 && skipFifth) {
      // 第五段：若任一为 main 占位符，则跳过校验（保持顺序，不改变任何段的相对位置）
      segments.push({ index: i + 1, name: names[i], a: segsA[i], b: segsB[i], compared: false, equal: true })
    } else {
      segments.push({ index: i + 1, name: names[i], a: segsA[i], b: segsB[i], compared: true, equal: segsA[i] === segsB[i] })
    }
  }

  // overallEqual：仅以“被比较的段”是否全部相等为准
  const overallEqual = segments.every(s => (s.compared ? s.equal : true))

  return {
    valid: true,
    overallEqual,
    excelIdCompared: !skipFifth,
    segments
  }
}

// 匹配策略接口
class MatchStrategy {
  match(userSelections, questionBank, envConfigs) {
    throw new Error('match method must be implemented')
  }
}

// 标准匹配策略（即精准匹配）
class StandardMatchStrategy extends MatchStrategy {
  match(userSelections, questionBank, envConfigs) {
    // 将选中的选项转换为表达式格式
    const selectedIds = userSelections.map(s => `${s.cardId}${s.optionId}`)
    selectedIds.sort() // 标准化排序
    
    const expression = selectedIds.join('+')
    
    // 在题库中查找匹配的表达式
    const matchedQuestion = questionBank.questions.find(q => {
      // 解析题库中的表达式
      const exprParts = q.expression.split('→')[0]
      const exprIds = exprParts.split('+').map(id => id.trim())
      exprIds.sort() // 标准化排序
      
      // 精确比较表达式
      return exprIds.join('+') === expression
    })
    
    if (matchedQuestion) {
      // 验证参数
      const paramValidation = this.validateParameters(userSelections, envConfigs)
      if (paramValidation.valid) {
        return {
          success: true,
          expression: matchedQuestion.expression,
          result: matchedQuestion.content,
          parameters: userSelections,
          validation: paramValidation
        }
      } else {
        return {
          success: false,
          error: `参数验证失败: ${paramValidation.message}`
        }
      }
    }
    
    return {
      success: false,
      error: '未找到匹配的表达式'
    }
  }
  
  validateParameters(selections, envConfigs) {
    for (const selection of selections) {
      const fullId = `${selection.cardId}${selection.optionId}`
      
      // 获取该选项的参数标准
      const paramStandard = envConfigs.configs?.[fullId]
      if (!paramStandard) {
        continue // 没有参数标准，跳过验证
      }
      
      // 验证值
      if (paramStandard.valueRange) {
        const value = parseFloat(selection.value)
        const [min, max] = paramStandard.valueRange
        if (value < min || value > max) {
          return {
            valid: false,
            message: `${fullId} 的值 ${selection.value} 超出范围 [${min}, ${max}]`
          }
        }
      }
      
      // 验证单位
      if (paramStandard.allowedUnits && selection.unit) {
        if (!paramStandard.allowedUnits.includes(selection.unit)) {
          return {
            valid: false,
            message: `${fullId} 的单位 ${selection.unit} 不在允许范围内 ${paramStandard.allowedUnits.join(', ')}`
          }
        }
      }
    }
    
    return {
      valid: true,
      message: '所有参数验证通过'
    }
  }
}

// 模糊匹配策略
class FuzzyMatchStrategy extends MatchStrategy {
  match(userSelections, questionBank, envConfigs) {
    // 查找包含用户选择的表达式
    const userSelectionSet = new Set(userSelections.map(s => `${s.cardId}${s.optionId}`))
    
    for (const question of questionBank.questions) {
      // 解析题库中的表达式
      const exprParts = question.expression.split('→')[0]
      const exprIds = exprParts.split('+').map(id => id.trim())
      
      // 检查是否包含所有必需的选项
      const containsAllRequired = exprIds.every(id => userSelectionSet.has(id))
      
      if (containsAllRequired) {
        // 进行模糊参数验证
        const paramValidation = this.fuzzyValidateParameters(userSelections, envConfigs, question)
        
        let result = question.content
        if (paramValidation.quality) {
          result = `${paramValidation.quality}${result}`
        }
        
        return {
          success: true,
          expression: question.expression,
          result: result,
          parameters: userSelections,
          validation: paramValidation
        }
      }
    }
    
    return {
      success: false,
      error: '未找到匹配的表达式'
    }
  }
  
  fuzzyValidateParameters(selections, envConfigs, question) {
    // 这里可以实现更复杂的模糊验证逻辑
    // 比如根据参数范围判断质量等级
    let quality = ''
    
    for (const selection of selections) {
      const fullId = `${selection.cardId}${selection.optionId}`
      const paramStandard = envConfigs.configs?.[fullId]
      
      if (paramStandard && paramStandard.valueRange) {
        const value = parseFloat(selection.value)
        const [min, max] = paramStandard.valueRange
        const optimal = (min + max) / 2
        const range = max - min
        
        // 判断参数质量
        if (value < min) {
          quality = '劣质'
          break
        } else if (value > max) {
          quality = '优质'
          break
        } else if (Math.abs(value - optimal) <= range * 0.1) {
          // 在最优值10%范围内
          quality = '完美'
        }
      }
    }
    
    return {
      valid: true,
      message: '模糊参数验证通过',
      quality: quality
    }
  }
}

// 匹配引擎管理器
class MatchEngineManager {
  constructor() {
    this.strategies = {
      'standard': new StandardMatchStrategy(), // 默认标准匹配
      'fuzzy': new FuzzyMatchStrategy()
    }
    this.currentStrategy = 'standard' // 默认使用标准匹配
  }
  
  // 设置匹配策略
  setStrategy(strategy) {
    if (this.strategies[strategy]) {
      this.currentStrategy = strategy
    } else {
      throw new Error(`未知的匹配策略: ${strategy}`)
    }
  }
  
  // 注册新的匹配策略
  registerStrategy(name, strategy) {
    if (!(strategy instanceof MatchStrategy)) {
      throw new Error('策略必须是MatchStrategy的实例')
    }
    this.strategies[name] = strategy
  }
  
  // 执行匹配
  async performMatch(modeId) {
    try {
      // 1. 收集用户选择的选项
      const userSelections = this.collectUserSelections(modeId)
      
      // 2. 获取本地题库规则
      const questionBank = this.loadQuestionBank(modeId)
      
      // 3. 获取本地参数标准
      const envConfigs = this.loadEnvConfigs(modeId)
      
      // 4. 验证版本一致性
      const versionConsistency = this.validateVersionConsistency(modeId, questionBank, envConfigs)
      if (!versionConsistency.valid) {
        return {
          success: false,
          error: versionConsistency.message
        }
      }
      
      // 5. 使用当前策略执行匹配
      const strategy = this.strategies[this.currentStrategy]
      if (!strategy) {
        throw new Error(`未找到匹配策略: ${this.currentStrategy}`)
      }
      
      const result = strategy.match(userSelections, questionBank, envConfigs)
      return result
    } catch (error) {
      console.error('匹配过程出错:', error)
      return {
        success: false,
        error: '匹配过程出错: ' + error.message
      }
    }
  }

  // 验证版本一致性
  validateVersionConsistency(modeId, questionBank, envConfigs) {
    // 获取当前版本
    const currentVersion = this.getCurrentVersion(modeId)
    
    // 验证题库版本
    const questionVersions = [...new Set(questionBank.questions
      .filter(q => q.version)
      .map(q => q.version))]
    
    // 验证环境配置版本
    const envVersion = envConfigs.version
    
    // 检查是否存在多个题库版本
    if (questionVersions.length > 1) {
      return {
        valid: false,
        message: `题库中存在多个版本: ${questionVersions.join(', ')}，请确保版本一致性`
      }
    }
    
    const questionVersion = questionVersions[0] || null
    
    // 检查版本是否一致
    if (questionVersion && questionVersion !== currentVersion) {
      return {
        valid: false,
        message: `题库版本(${questionVersion})与当前版本(${currentVersion})不一致`
      }
    }
    
    if (envVersion && envVersion !== currentVersion) {
      return {
        valid: false,
        message: `环境配置版本(${envVersion})与当前版本(${currentVersion})不一致`
      }
    }
    
    return {
      valid: true,
      message: '版本一致性验证通过'
    }
  }

  // 收集用户选择的选项
  collectUserSelections(modeId) {
    // 这里应该从本地存储中收集用户的选择
    // 模拟实现
    const selections = []
    
    // 实际实现应该遍历所有卡片，收集选中的选项
    // 示例数据结构：
    /*
    [
      {
        cardId: 'A',
        optionId: 'A1',
        value: '100',
        unit: 'kg'
      },
      {
        cardId: 'B',
        optionId: 'B2',
        value: '红色',
        unit: null
      }
    ]
    */
    
    return selections
  }

  // 加载本地题库规则
  loadQuestionBank(modeId) {
    // 构建题库Key
    const key = ID.buildKey({
      modeId: modeId,
      version: this.getCurrentVersion(modeId),
      type: ID.TYPES.QUESTION_BANK,
      excelId: null // Meta数据
    })
    
    try {
      const bankData = localStorage.getItem(key)
      const parsedBank = bankData ? JSON.parse(bankData) : { questions: [] }
      
      // 确保题库数据包含版本信息
      if (parsedBank && !parsedBank.version) {
        parsedBank.version = this.getCurrentVersion(modeId)
      }
      
      return parsedBank
    } catch (error) {
      console.error('加载题库失败:', error)
      return { questions: [] }
    }
  }

  // 加载本地环境配置（参数标准）
  loadEnvConfigs(modeId) {
    // 构建环境配置Key
    const key = ID.buildKey({
      modeId: modeId,
      version: this.getCurrentVersion(modeId),
      type: ID.TYPES.ENV_FULL,
      excelId: null // Meta数据
    })
    
    try {
      const envData = localStorage.getItem(key)
      const parsedEnv = envData ? JSON.parse(envData) : { configs: {} }
      
      // 确保环境配置包含版本信息
      if (parsedEnv && !parsedEnv.version) {
        parsedEnv.version = this.getCurrentVersion(modeId)
      }
      
      return parsedEnv
    } catch (error) {
      console.error('加载环境配置失败:', error)
      return { configs: {} }
    }
  }

  // 获取当前版本
  getCurrentVersion(modeId) {
    // 从本地存储获取当前版本
    const versionKey = ID.buildKey({
      modeId: modeId,
      version: 'meta_version',
      type: '@meta',
      excelId: 'current_version'
    })
    
    try {
      const version = localStorage.getItem(versionKey)
      return version || 'default'
    } catch (error) {
      console.error('获取当前版本失败:', error)
      return 'default'
    }
  }
}

// 主模式匹配引擎控制器
class RootMatchEngineController {
  constructor() {
    this.engineManager = new MatchEngineManager()
  }
  
  // 设置匹配策略
  setMatchStrategy(strategy) {
    this.engineManager.setStrategy(strategy)
  }
  
  // 注册新的匹配策略
  registerMatchStrategy(name, strategy) {
    this.engineManager.registerStrategy(name, strategy)
  }
  
  // 获取可用的匹配策略列表
  getAvailableStrategies() {
    return Object.keys(this.engineManager.strategies)
  }
  
  // 配置模糊匹配参数
  configureFuzzyMatch(params) {
    // 这里可以添加模糊匹配的配置逻辑
    console.log('配置模糊匹配参数:', params)
  }
}

// 导出单例
export const matchEngine = new MatchEngineManager()
export const rootMatchController = new RootMatchEngineController()