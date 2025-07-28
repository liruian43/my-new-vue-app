export function useEncryption() {
  // 移除加密功能，直接返回原始数据
  const encryptData = (data) => data;
  const decryptData = (data) => data;

  return {
    encryptData,
    decryptData,
  };
}
