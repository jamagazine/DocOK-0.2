export interface HierarchyRow {
  id: string;
  name?: string;
  quantity?: number | string;
  mass?: number | string;
  weight?: number | string;
  unit?: string;
  level?: number;
  parentId?: string | null;
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
  is_header?: boolean;
  [key: string]: any;
}

export function calculateHierarchy(rows: HierarchyRow[]): HierarchyRow[] {
  // Правило 4: Игнорируем или фильтруем пустые строки с точки зрения имени.
  // Мы не будем их удалять из массива, чтобы не сломать индексы (хотя можем).
  // Если мы их удаляем, то:
  const validRows = rows.filter(r => r.name && String(r.name).trim() !== '');

  // Фаза 1: Разметка ITEM vs HEADER_CANDIDATE
  const markedRows = validRows.map(row => {
    const q = String(row.quantity || '').trim();
    const mass = String(row.mass || row.weight || '').trim();
    const u = String(row.unit || '').trim();
    
    // Если есть хотя бы одно из этих полей, это позиция.
    const isItem = (q !== '' && q !== '0' && q !== '0.00') || 
                   (mass !== '' && mass !== '0' && mass !== '0.00') || 
                   (u !== '');
                   
    return {
      ...row,
      __is_item: isItem
    };
  });

  // Фаза 2: Backward pass для определения уровня заголовков
  let maxChildLevel = -1;
  const stack: { row: any, level: number }[] = [];

  for (let i = markedRows.length - 1; i >= 0; i--) {
    const row = markedRows[i];

    if (row.__is_item) {
      maxChildLevel = Math.max(maxChildLevel, 0);
      row.level = 0;
      row.row_type = 'ITEM';
      row.is_header = false;

      // Очищаем стек заголовков, если встретили позицию (ITEM бывает только внутри L1)
      while (stack.length > 0 && stack[stack.length - 1].level > 1) {
        stack.pop();
      }
      maxChildLevel = 0;
    } else {
      // Это кандидат в заголовки
      const level = maxChildLevel + 1;
      row.level = level;
      row.is_header = true;
      
      // Маппинг на старые типы для UI совместимости
      if (level === 1) row.row_type = 'GROUP';
      else if (level === 2) row.row_type = 'LOCATION';
      else row.row_type = 'WORK_TYPE';

      // Обновляем стек
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      stack.push({ row, level });
      maxChildLevel = level;
    }
  }

  // Фаза 3: Forward pass для назначения parentId
  const currentParents: Record<number, string> = {};

  for (let i = 0; i < markedRows.length; i++) {
    const row = markedRows[i];
    const lvl = row.level || 0;

    // Все, что выше нашего уровня по иерархии (level > current) сбрасывается/игнорируется в этом контексте
    // Наш родитель - это ближайший заголовок с уровнем lvl + 1
    const parentId = currentParents[lvl + 1] || null;
    row.parentId = parentId;

    if (row.is_header) {
      currentParents[lvl] = row.id;
      // При входе в новый заголовок определенного уровня, 
      // все "текущие родители" более низких уровней сбрасываются
      for (let k = 1; k < lvl; k++) {
        delete currentParents[k];
      }
    }
  }

  // Очистка от временных полей
  return markedRows.map(({ __is_item, ...rest }) => rest);
}
