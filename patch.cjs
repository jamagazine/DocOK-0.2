const fs = require('fs');
let code = fs.readFileSync('app/context/DataContext.tsx', 'utf8');

// 1. Inclusions
code = code.replace(/import \{ parsePdfGeometry, PdfGeometry \} from '\.\.\/utils\/pdfUtils';\nimport \{ Stage, FileStatus, UploadStatus \} from '\.\.\/types';/, "import { parsePdfGeometry, PdfGeometry } from '../utils/pdfUtils';\nimport { calculateHierarchy } from '../utils/hierarchy';\nimport { Stage, FileStatus, UploadStatus, SpecRow, InvoiceRow, EstimateRow } from '../types';");

// 2. dataPipeline integration
const dpFind = `    let result = baseRows.filter(r => !isActuallyEmpty(r));

    // 2. ФИЛЬТР НАВИГАТОРА`;
const dpReplace = `    let result = baseRows.filter(r => !isActuallyEmpty(r));

    // АВТО-РАСЧЕТ ИЕРАРХИИ (Спецификации)
    if (currentStage === 'spec') {
      result = calculateHierarchy(result);
    }

    // 2. ФИЛЬТР НАВИГАТОРА`;
code = code.replace(dpFind, dpReplace);

// 3. getNavigatorTree replace
const oldNav = `    const tree: any[] = [];
    let currentL0: any = null;
    let currentL1: any = null;

    baseRows.forEach(r => {
      // Use row_type as primary signal — robust regardless of is_header value in cached  data
      const type = r.row_type;
      if (!type || type === 'ITEM') return;
      // Skip rows with empty or blank names
      if (!r.name || !r.name.trim()) return;

      const node = { id: r.id, name: r.name.trim(), row_type: type, children: [] as any[] };
      if (type === 'WORK_TYPE') {
        currentL0 = node;
        currentL1 = null;
        tree.push(node);
      } else if (type === 'LOCATION') {
        currentL1 = node;
        if (currentL0) currentL0.children.push(node);
        else tree.push(node);
      } else if (type === 'GROUP') {
        if (currentL1) currentL1.children.push(node);
        else if (currentL0) currentL0.children.push(node);
        else tree.push(node);
      }
    });`;

const newNav = `    let processedBaseRows = baseRows;
    if (currentStage === 'spec') {
      processedBaseRows = calculateHierarchy(baseRows.filter(r => !(r.is_header && (!r.name || !r.name.trim()))));
    }

    const tree: any[] = [];
    const nodes: Record<string, any> = {};

    processedBaseRows.forEach(row => {
      if (!row.name || !row.name.trim()) return;
      const level = typeof row.level === 'number' ? row.level : (row.is_header ? 1 : 0);
      if (level > 0 || row.is_header) {
        nodes[row.id] = { 
          id: row.id, 
          name: row.name.trim(), 
          row_type: row.row_type, 
          level: level,
          parentId: row.parentId, 
          children: [] as any[], 
          count: 0 
        };
      }
    });

    processedBaseRows.forEach(row => {
      if (!row.name || !row.name.trim()) return;
      const level = typeof row.level === 'number' ? row.level : (row.is_header ? 1 : 0);
      
      if (level === 0 && !row.is_header) {
        let currId = row.parentId;
        while(currId && nodes[currId]) {
          nodes[currId].count++;
          currId = nodes[currId].parentId;
        }
      } else if (level > 0 || row.is_header) {
        const node = nodes[row.id];
        if (row.parentId && nodes[row.parentId]) {
          nodes[row.parentId].children.push(node);
        } else {
          tree.push(node);
        }
      }
    });`;

code = code.replace(oldNav, newNav);

fs.writeFileSync('app/context/DataContext.tsx', code);
console.log('Update Complete!');
