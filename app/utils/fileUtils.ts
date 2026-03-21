import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { parsePdf, parsePdfGeometry, PdfGeometry } from './pdfUtils';

export interface MaterialPosition {
  name: string;
  brand: string;
  code: string;
  supplier: string;
  unit: string;
  quantity: string;
  mass: string;
  note: string;
}

export interface ParsedFile {
  headers: string[];
  rows: string[][];
  gridX?: number[];
}

export async function parseFile(file: File): Promise<ParsedFile> {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    return parsePdf(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let workbook: XLSX.WorkBook;

        if (file.name.toLowerCase().endsWith('.csv')) {
          workbook = XLSX.read(data as string, { type: 'string' });
        } else {
          workbook = XLSX.read(data, { type: 'binary' });
        }

        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        });

        if (allRows.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // Find the first non-empty row to use as headers
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, allRows.length); i++) {
          const row = allRows[i] as unknown[];
          if (row.some((c) => c !== '' && c !== null && c !== undefined)) {
            headerRowIndex = i;
            break;
          }
        }

        const rawHeaders = (allRows[headerRowIndex] as unknown[]).map((h) =>
          String(h ?? '').trim()
        );
        const dataRows = allRows.slice(headerRowIndex + 1).map((row) =>
          (row as unknown[]).map((cell) => String(cell ?? '').trim())
        );

        // Intelligent import: filter completely empty columns
        const columnsToKeep: number[] = [];
        const maxCols = Math.max(rawHeaders.length, ...dataRows.map(r => r.length));
        
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          const header = rawHeaders[colIdx] || '';
          if (header !== '') {
             columnsToKeep.push(colIdx);
             continue;
          }
          
          const hasData = dataRows.some(row => row[colIdx] !== undefined && row[colIdx] !== '');
          if (hasData) {
            columnsToKeep.push(colIdx);
          }
        }
        
        const headers = columnsToKeep.map(idx => rawHeaders[idx] || '');
        const mappedDataRows = dataRows.map(row => columnsToKeep.map(idx => row[idx] || ''));

        // Filter completely empty rows
        const filteredRows = mappedDataRows.filter((row) =>
          row.some((cell) => cell !== '')
        );

        resolve({ headers, rows: filteredRows });
      } catch (err) {
        reject(new Error('Не удалось прочитать файл. Проверьте формат (Excel или CSV).'));
      }
    };

    reader.onerror = () =>
      reject(new Error('Ошибка чтения файла'));

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Лист1'
) {
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-width columns
  const colWidths = Object.keys(data[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Column auto-detection ──────────────────────────────────────────────────────

export const SPEC_ALIASES: Record<string, string[]> = {
  name: ['наименование', 'название', 'материал', 'описание', 'позиция', 'наим'],
  brand: ['марка', 'тип', 'бренд', 'модель', 'обозначение', 'марка/тип'],
  code: ['код', 'артикул', '№', 'шифр', 'номер', 'арт'],
  supplier: ['поставщик', 'производитель', 'завод', 'фирма', 'вендор'],
  unit: ['единица', 'ед.изм', 'ед.', 'ед', 'единиц', 'изм', 'ед.измерения'],
  quantity: ['количество', 'кол-во', 'кол.', 'кол', 'объем', 'объём', 'шт'],
  mass: ['масса', 'вес', 'kg', 'кг', 'масса,кг'],
  note: ['примечание', 'примечания', 'комментарий', 'комментарии', 'доп.', 'коммент', 'прим'],
};

export const INVOICE_ALIASES: Record<string, string[]> = {
  article: ['артикул', 'арт', 'арт.', 'код товара', 'код', 'sku', '№'],
  name: ['наименование', 'название', 'описание', 'товар', 'наим'],
  supplier: ['поставщик', 'производитель', 'завод', 'фирма', 'вендор', 'контрагент'],
  quantity: ['количество', 'кол-во', 'кол.', 'кол', 'qty'],
  unit: ['единица', 'ед.изм', 'ед.', 'ед', 'единиц', 'изм'],
  price: ['цена', 'цена ед', 'цена за ед.', 'цена за единицу', 'стоимость ед'],
  vat: ['ндс', '%ндс', 'ставка ндс', 'ндс%', 'ставка', 'vat'],
  vatAmount: ['сумма ндс', 'ндс сумма', 'нДС', 'вкл ндс'],
  total: ['сумма', 'итого', 'стоимость', 'всего', 'total', 'сумма с ндс'],
};

export interface DetectedMapping {
  index: number;
  isUncertain: boolean;
}

export function autoDetectMapping(
  headers: string[],
  aliases: Record<string, string[]>
): Record<string, DetectedMapping> {
  const mapping: Record<string, DetectedMapping> = {};
  const usedIndices = new Set<number>();

  for (const [key, keyAliases] of Object.entries(aliases)) {
    for (let i = 0; i < headers.length; i++) {
      if (usedIndices.has(i)) continue;
      const normalized = headers[i].toLowerCase().trim();
      
      const exactMatch = keyAliases.find((alias) => normalized === alias);
      if (exactMatch) {
         mapping[key] = { index: i, isUncertain: false };
         usedIndices.add(i);
         break;
      }
      
      const partialMatch = keyAliases.find((alias) => normalized.includes(alias));
      if (partialMatch) {
         // If it's a partial match, we calculate confidence based on length ratio
         const confidence = partialMatch.length / Math.max(normalized.length, 1);
         mapping[key] = { index: i, isUncertain: confidence < 0.8 };
         usedIndices.add(i);
         break;
      }
    }
  }

  return mapping;
}

export function mergeDuplicateMaterials<T extends MaterialPosition & { id: string }>(
  materials: T[]
): (T & { originalRowsIds: string[]; children: T[] })[] {
  const mergedMap = new Map<string, T & { originalRowsIds: string[]; children: T[] }>();

  for (const item of materials) {
    const name = item.name.trim().toLowerCase();
    const key = name;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      
      const parseQty = (val: unknown) => parseFloat(String(val).replace(/\s/g, '').replace(/,/g, '.')) || 0;
      const existingQty = parseQty(existing.quantity);
      const itemQty = parseQty(item.quantity);
      
      existing.quantity = String(existingQty + itemQty);
      existing.originalRowsIds.push(item.id);
      existing.children.push({ ...item });
      
      // Merge notes if they differ
      if (item.note && !existing.note.includes(item.note)) {
        existing.note = existing.note ? `${existing.note}; ${item.note}` : item.note;
      }
    } else {
      mergedMap.set(key, { 
        ...item, 
        originalRowsIds: [item.id],
        children: [{ ...item }] 
      });
    }
  }

  return Array.from(mergedMap.values());
}

export async function exportToXLSX(headers: string[], rows: string[][], gridX?: number[], filename: string = 'diagnostic_export.xlsx') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  if (gridX && gridX.length > 0) {
    worksheet.columns = headers.map((header, i) => {
      let width = 15;
      if (i < gridX.length - 1) {
        const pxDiff = gridX[i + 1] - gridX[i];
        width = Math.max(8, pxDiff / 5);
      } else {
        width = 50;
      }
      return { header, key: `col${i}`, width };
    });
  } else {
    worksheet.columns = headers.map((header, i) => ({ header, key: `col${i}`, width: 15 }));
  }

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== '') {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveExcelFile(buffer, filename);
}

export async function exportGeometryToXLSX(geometry: PdfGeometry, filename: string = 'geometry_twin_semantic.xlsx') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Digital Twin');

  const GOST_EXCEL_WIDTHS = [4.5, 35, 8.5, 8.5, 8.5, 5, 3.5, 3.5, 7];
  
  worksheet.columns = GOST_EXCEL_WIDTHS.map((w, i) => ({
    key: `col${i}`,
    width: w
  }));

  // Вставляем найденные или дефолтные заголовки в первую строку
  const headerRow = worksheet.addRow(geometry.headers);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Настройка пустых строк
  for (let i = 0; i < 40; i++) {
    const row = worksheet.addRow([]);
    row.height = 18;
    
    for (let col = 1; col <= 9; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveExcelFile(buffer, filename);
}

function saveExcelFile(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

