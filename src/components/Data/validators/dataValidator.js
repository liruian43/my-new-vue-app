// src/components/Data/validators/dataValidator.js
// [可能需要删除] 如果最终改为由UI或具体模块内做轻量校验，本文件可删除。
export class DataValidator {
  validateCard(card) {
    const errors = [];
    const safeCard = { ...card, invalid: false };

    if (!safeCard.data) {
      errors.push('缺少data字段');
      safeCard.data = {};
    }
    if (safeCard.data.title === undefined || safeCard.data.title === null) {
      errors.push('卡片标题不能为空');
    }
    if (!Array.isArray(safeCard.data.options)) {
      errors.push('options必须是数组');
      safeCard.data.options = [];
    } else if (safeCard.data.options.length === 0) {
      errors.push('至少需要一个选项');
    }

    safeCard.data.options = (safeCard.data.options || []).map((opt, index) => {
      const safeOpt = { ...opt };
      const optErrors = [];
      if (safeOpt.name === undefined || safeOpt.name === null) {
        optErrors.push(`选项${index + 1}名称不能为空`);
      }
      if (safeOpt.value === undefined || safeOpt.value === null || isNaN(safeOpt.value)) {
        optErrors.push(`选项${index + 1}数值必须为有效数字`);
        safeOpt.value = 0;
      }
      if (safeOpt.unit === undefined || safeOpt.unit === null) {
        safeOpt.unit = null;
      }
      if (optErrors.length > 0) errors.push(...optErrors);
      return safeOpt;
    });

    if (!Array.isArray(safeCard.data.selectOptions)) {
      safeCard.data.selectOptions = [];
    }
    if (safeCard.data.uiConfig === undefined || typeof safeCard.data.uiConfig !== 'object') {
      safeCard.data.uiConfig = {};
    }
    if (safeCard.data.scoreRules === undefined || !Array.isArray(safeCard.data.scoreRules)) {
      safeCard.data.scoreRules = [];
    }

    if (errors.length > 0) {
      safeCard.invalid = true;
      safeCard.validationErrors = errors;
    }
    return { pass: errors.length === 0, errors, card: safeCard };
  }

  validateQuestion(question) {
    const errors = [];
    if (!question.id) errors.push('题目必须有唯一ID');
    if (!question.content || question.content.trim() === '') errors.push('题目内容不能为空');
    if (!Array.isArray(question.options) || question.options.length === 0) {
      errors.push('题目必须包含选项');
    }
    if (question.correctAnswer === undefined || question.correctAnswer === null) {
      errors.push('题目必须设置正确答案');
    }
    if (!question.environmentConfig) {
      errors.push('题目必须包含环境配置');
    } else {
      if (!question.environmentConfig.uiConfig) {
        errors.push('环境配置必须包含UI配置');
      }
      if (!question.environmentConfig.scoringRules || question.environmentConfig.scoringRules.length === 0) {
        errors.push('环境配置必须包含评分规则');
      }
    }
    return { pass: errors.length === 0, errors };
  }

  validateConfig(cards) {
    if (!Array.isArray(cards)) {
      return { pass: false, errors: ['配置数据必须是数组'], validCards: [], invalidCards: [] };
    }
    if (cards.length === 0) {
      return { pass: false, errors: ['至少需要一张卡片'], validCards: [], invalidCards: [] };
    }
    const results = cards.map(card => this.validateCard(card));
    return {
      pass: results.every(r => r.pass),
      errors: results.flatMap(r => r.errors),
      validCards: results.filter(r => r.pass).map(r => r.card),
      invalidCards: results.filter(r => !r.pass).map(r => r.card)
    };
  }

  validateLinkageRule(rule) {
    const errors = [];
    if (!rule.id) errors.push('联动规则必须有唯一ID');
    if (!rule.sourceModeId) errors.push('必须指定源模式ID');
    if (!rule.targetModeId) errors.push('必须指定目标模式ID');
    if (!Array.isArray(rule.cardMappings)) {
      errors.push('cardMappings必须是数组');
    } else {
      rule.cardMappings.forEach((mapping, index) => {
        if (!mapping.sourceCardId) errors.push(`卡片映射${index + 1}必须指定源卡片ID`);
        if (!mapping.targetCardId) errors.push(`卡片映射${index + 1}必须指定目标卡片ID`);
        if (!Array.isArray(mapping.fieldMappings)) {
          errors.push(`卡片映射${index + 1}的fieldMappings必须是数组`);
        }
      });
    }
    return { pass: errors.length === 0, errors };
  }
}