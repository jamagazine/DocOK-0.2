import * as pdfjs from 'pdfjs-dist';
import { ParsedFile } from './fileUtils';

// Установка воркера локально
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── КОНСТАНТЫ ГОСТ 21.110-2013 (в мм) ───────────────────────────────────
// ── КОНСТАНТЫ ГОСТ 21.110-2013 (в мм) ───────────────────────────────────
const MM_TO_PT = 2.83465; // 1 мм ≈ 2.83465 пунктов PDF
const GOST_COLS_MM = [15, 60, 20, 20, 20, 15, 10, 10, 15]; // 9 колонок спецификации (185мм)

// ── ИЕРАРХИЧЕСКИЙ СЛОВАРЬ (ГОСТ 21.110-2013) ───────────────────────────
const GOST_HIERARCHY = [
  { id: 0, levels: ['Позиция', 'Поз'], fallbackMm: 15 },
  { id: 1, levels: ['Наименование и техническая характеристика', 'Наименование', 'Наименование и тех. характеристика'], fallbackMm: 60 },
  { id: 2, levels: ['Тип, марка, обозначение документа, опросного листа', 'Тип, марка', 'Тип'], fallbackMm: 20 },
  { id: 3, levels: ['Код оборудования, изделия, материала', 'Код оборудования', 'Код'], fallbackMm: 20 },
  { id: 4, levels: ['Завод-изготовитель (для импортного оборудования - страна, фирма)', 'Завод', 'Поставщик'], fallbackMm: 20 },
  { id: 5, levels: ['Единица измерения', 'Ед. изм.', 'Ед'], fallbackMm: 15 },
  { id: 6, levels: ['Количество', 'Кол-во', 'Кол'], fallbackMm: 10 },
  { id: 7, levels: ['Масса единицы, кг', 'Масса', 'кг'], fallbackMm: 10 },
  { id: 8, levels: ['Примечание', 'Прим'], fallbackMm: 15 }
];

// Хелпер для нормализации строки (удаление пробелов, знаков препинания)
const normalize = (s: string) => s.replace(/[^a-zа-яё0-9]/gi, '').toLowerCase();

// Хелпер для Fuzzy Match (Коэффициент Сёренсена-Дайса или простая схожесть)
function getSimilarity(s1: string, s2: string): number {
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  if (n1 === n2) return 1.0;
  if (n1.length < 2 || n2.length < 2) return 0;
  
  let matches = 0;
  for (let i = 0; i < n1.length - 1; i++) {
    if (n2.includes(n1.substring(i, i + 2))) matches++;
  }
  return (2.0 * matches) / (n1.length + n2.length - 2);
}

export interface PdfGeometry {
  gridX: number[];
  gridY: number[];
  headers: string[];
  zones: {
    sideTable: { x1: number, y1: number, x2: number, y2: number };
    stamp: { x1: number, y1: number, x2: number, y2: number };
    mainSpec: { x1: number, y1: number, x2: number, y2: number };
    notes: { x1: number, y1: number, x1_abs: number, y1_abs: number };
  };
}

export async function parsePdfGeometry(file: File): Promise<PdfGeometry> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const stampWidth = 185 * MM_TO_PT;
  const stampHeight = 55 * MM_TO_PT;
  const sideWidth = 12 * MM_TO_PT;

  const zones = {
    sideTable: { x1: 0, y1: 0, x2: sideWidth, y2: pageHeight },
    stamp: { x1: pageWidth - stampWidth, y1: pageHeight - stampHeight, x2: pageWidth, y2: pageHeight },
    mainSpec: { x1: pageWidth - stampWidth, y1: 0, x2: pageWidth, y2: pageHeight - stampHeight },
    notes: { x1: sideWidth, y1: 0, x1_abs: sideWidth, y1_abs: 0 }
  };

  // 1. Сбор текста в верхней части (25%)
  const textContent = await page.getTextContent();
  const items = (textContent.items as any[]).map(it => {
    const [,, ,, x, y] = it.transform;
    return { text: (it.str || '').trim(), x, y, w: it.width };
  }).filter(it => it.text && it.y > pageHeight * 0.75); // PDF Y растет снизу вверх

  // 2. Семантическая Сборка (Stencil) по иерархии
  const detected: { text: string, rightX: number, id: number }[] = [];
  
  for (const entry of GOST_HIERARCHY) {
    let found = false;
    for (const level of entry.levels) {
      for (const item of items) {
        if (getSimilarity(item.text, level) >= 0.85) {
          detected.push({ text: item.text, rightX: item.x + item.w, id: entry.id });
          found = true;
          break;
        }
      }
      if (found) break;
    }
    // Если не нашли, добавим метку для fallback (позже)
  }

  // 3. Фиксация геометрии (строго по порядку словаря)
  let currentX = zones.mainSpec.x1;
  const gridX: number[] = [currentX];
  const headerStrings: string[] = [];

  for (const entry of GOST_HIERARCHY) {
    const match = detected.find(d => d.id === entry.id);
    if (match) {
      currentX = match.rightX;
      headerStrings.push(match.text);
    } else {
      currentX += entry.fallbackMm * MM_TO_PT;
      headerStrings.push(`[${entry.levels[entry.levels.length-1]}]`);
    }
    gridX.push(currentX);
  }

  const gridY: number[] = [20 * MM_TO_PT, pageHeight - stampHeight];

  console.log('Fuzzy Stencil Applied:', { gridX, headerStrings });

  return { gridX, gridY, headers: headerStrings, zones } as any;
}

export async function parsePdf(file: File): Promise<ParsedFile> {
  return parsePdfLegacy(file);
}

async function parsePdfLegacy(file: File): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  let allBlocks: TextBlock[] = [];
  const addBlockIfNotDuplicate = (newBlock: TextBlock) => {
    const isDuplicate = allBlocks.some(b => b.text === newBlock.text && Math.abs(b.x - newBlock.x) <= 2 && Math.abs(b.y - newBlock.y) <= 2);
    if (!isDuplicate) allBlocks.push(newBlock);
  };
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent({ includeMarkedContent: true });
    for (const item of textContent.items as any[]) {
      if (item.str === undefined) continue;
      const text = item.str.trim(); if (text === '') continue;
      const [,, ,, x, y] = item.transform; if (y < 40 || y > 800) continue;
      addBlockIfNotDuplicate({ text, x, y, width: item.width, height: item.height });
    }
    const annotations = await page.getAnnotations();
    for (const ann of annotations as any[]) {
      if (!ann.contents) continue;
      const text = String(ann.contents).trim(); if (text === '') continue;
      const [x1, y1, x2, y2] = ann.rect; if (y1 < 40 || y1 > 800) continue;
      addBlockIfNotDuplicate({ text, x: x1, y: y1, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    }
  }
  if (allBlocks.length === 0) return { headers: [], rows: [] };
  
  // Применяем ГОСТ-колонки вместо динамических
  const startX = allBlocks.length > 0 ? Math.min(...allBlocks.map(b => b.x)) : 0;
  let currentX = startX;
  const gridX: number[] = [currentX];
  for (const mw of GOST_COLS_MM) {
    currentX += mw * MM_TO_PT;
    gridX.push(currentX);
  }

  const getColIndex = (x: number) => {
    let bestIdx = 0; let minDiff = Math.abs(x - gridX[0]);
    for (let i = 1; i < gridX.length; i++) { const diff = Math.abs(x - gridX[i]); if (diff < minDiff) { minDiff = diff; bestIdx = i; } }
    return bestIdx;
  };
  const rows: TextBlock[][] = [];
  const sortedByY = [...allBlocks].sort((a, b) => b.y - a.y);
  let currentRow: TextBlock[] = [sortedByY[0]];
  for (let i = 1; i < sortedByY.length; i++) {
    const curr = sortedByY[i]; const rowBaseY = currentRow[0].y;
    if (Math.abs(curr.y - rowBaseY) <= 4) currentRow.push(curr); else { rows.push(currentRow); currentRow = [curr]; }
  }
  rows.push(currentRow);
  const finalRows: string[][] = [];
  for (const blockRow of rows) {
    blockRow.sort((a, b) => a.x - b.x); const tableRow = new Array(gridX.length - 1).fill('');
    for (const block of blockRow) {
      const colIndex = getColIndex(block.x);
      if (colIndex < tableRow.length) {
        if (tableRow[colIndex]) { const connector = tableRow[colIndex].endsWith('-') ? '' : ' '; tableRow[colIndex] += connector + block.text; }
        else { tableRow[colIndex] = block.text; }
      }
    }
    finalRows.push(tableRow);
  }
  const logicalRows: string[][] = [];
  for (const tableRow of finalRows) {
    const anchorText = tableRow[0] ? tableRow[0].trim() : '';
    if (anchorText === '' && logicalRows.length > 0) {
       const prevRow = logicalRows[logicalRows.length - 1];
       for (let i = 0; i < tableRow.length; i++) {
          if (tableRow[i].trim() !== '') {
             if (prevRow[i] !== '') { const connector = prevRow[i].endsWith('-') ? '' : ' '; prevRow[i] += connector + tableRow[i]; }
             else { prevRow[i] = tableRow[i]; }
          }
       }
    } else logicalRows.push(tableRow);
  }
  const cleanedRows = logicalRows.filter(r => r.some(cell => cell.trim() !== ''));
  if (cleanedRows.length === 0) return { headers: [], rows: [] };
  const headers = cleanedRows[0].map(h => h.trim());
  const dataRows = cleanedRows.slice(1).map(r => r.map(c => c.trim()));
  return { headers, rows: dataRows, gridX } as ParsedFile & { gridX?: number[] };
}
