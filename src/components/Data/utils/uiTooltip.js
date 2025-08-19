// src/components/Data/utils/uiTooltip.js
// [可能需要删除] UI 辅助：根据对象生成提示信息字符串

export function generateTooltip(item) {
  if (!item) return '无数据';

  // 卡片类型提示
  if (item.id && item.data?.title !== undefined) {
    const lines = [`卡片 ID: ${item.id}`, `标题: ${item.data.title ?? '未设置'}`];

    if (Array.isArray(item.data.options)) {
      lines.push(`选项数量: ${item.data.options.length}`);
    }
    if (item.syncStatus) {
      const synced = item.syncStatus.title?.hasSync ? '已同步' : '未同步';
      lines.push(`同步状态: ${synced}`);
    }
    return lines.join('\n');
  }

  // 选项类型提示
  if (item.name !== undefined || item.value !== undefined) {
    const lines = [];
    if (item.id) lines.push(`选项 ID: ${item.id}`);
    if (item.name !== null && item.name !== undefined) lines.push(`名称: ${item.name}`);
    if (item.value !== null && item.value !== undefined) {
      lines.push(`值: ${item.value}${item.unit || ''}`);
    }
    return lines.join('\n') || '无选项信息';
  }

  return '数据信息未定义';
}