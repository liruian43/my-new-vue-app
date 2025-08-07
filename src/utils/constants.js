// 8项内容的字段标识
export const FIELD_IDS = {
  CARD_COUNT: 'cardCount', // 1.卡片数量（通过数组长度体现）
  CARD_ORDER: 'cardOrder', // 3.卡片顺序（通过数组索引体现）
  CARD_TITLE: 'title', // 4.卡片标题
  OPTIONS: 'options', // 2.选项数据（数组）
  OPTION_NAME: 'optionName', // 5.选项名称（options子项）
  OPTION_VALUE: 'optionValue', // 6.选项值（options子项）
  OPTION_UNIT: 'optionUnit', // 7.选项单位（options子项）
  SELECT_OPTIONS: 'selectOptions' // 8.下拉菜单
};

// 固定同步的字段（无需用户选择，点击联动即同步）
export const FIXED_SYNC_FIELDS = [
  FIELD_IDS.OPTIONS, 
  FIELD_IDS.SELECT_OPTIONS,
  FIELD_IDS.CARD_COUNT, // 由数组长度自然同步
  FIELD_IDS.CARD_ORDER // 由数组索引自然同步
];

// 可配置同步的字段（用户选择是否同步展示内容）
export const CONFIGURABLE_SYNC_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT
];

// 可授权编辑的字段（用户选择是否允许目标模式编辑）
export const AUTHORIZABLE_FIELDS = [
  FIELD_IDS.CARD_TITLE,
  FIELD_IDS.OPTION_NAME,
  FIELD_IDS.OPTION_VALUE,
  FIELD_IDS.OPTION_UNIT
];
