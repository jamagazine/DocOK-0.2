import { FileItem } from '../types'; // Убедись, что путь до типов правильный

export const isDocumentFullyVerified = (file: FileItem | null | undefined): boolean => {
  if (!file || !file.supplierData) return true; // Если данных нет, блокировать нечего
  
  const verified = file.verifiedFields || {};
  
  // Проходим по всем извлеченным полям поставщика
  for (const [key, fieldInfo] of Object.entries(file.supplierData)) {
    if (!fieldInfo) continue;
    
    // Приводим к any для динамического обхода (FieldWithConfidence)
    const field = fieldInfo as any; 
    const confidence = field.confidence ?? 1.0;
    const value = field.value;
    
    // Условие сомнения: низкая уверенность ИЛИ пустое значение
    const needsVerification = confidence < 0.95 || value === null || value === '';
    
    // Если поле требует проверки, но его ключа нет в verifiedFields -> БЛОКИРУЕМ
    if (needsVerification && !verified[key]) {
      return false; 
    }
  }
  
  return true; // Все проблемные поля подтверждены
};
