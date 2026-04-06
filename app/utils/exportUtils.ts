import * as XLSX from 'xlsx';
import { SupplierData, InvoiceRow } from '../types';

export const exportSupplierToExcel = (supplierName: string, data: SupplierData, items: InvoiceRow[]) => {
  // 1. Формируем шапку с реквизитами
  const headerData = [
    ["ДАННЫЕ ПОСТАВЩИКА"],
    ["Организация", data.organization_name?.value || ""],
    ["ИНН", data.inn?.value || ""],
    ["КПП", data.kpp?.value || ""],
    ["Телефон", data.phone?.value || ""],
    ["Юр. адрес", data.legal_address?.value || ""],
    ["Почтовый адрес", data.postal_address?.value || ""],
    [""],
    ["БАНКОВСКИЕ РЕКВИЗИТЫ"],
    ["Банк", data.bank_name?.value || ""],
    ["БИК", data.bank_bik?.value || ""],
    ["Р/С", data.bank_account?.value || ""],
    ["К/С", data.corr_account?.value || ""],
    [""],
    ["СПИСОК ТОВАРОВ / ПОЗИЦИЙ"]
  ];

  // 2. Формируем таблицу товаров
  const itemsHeader = ["№", "Наименование", "Кол-во", "Ед. изм.", "Цена", "Сумма", "НДС"];
  const itemsData = items.map((item, index) => [
    index + 1,
    item.name,
    item.quantity,
    item.unit,
    item.price,      // Используем актуальное поле из DataContext/InvoiceRow
    item.total,      // Используем актуальное поле из DataContext/InvoiceRow
    item.vatRate     // Используем актуальное поле из DataContext/InvoiceRow
  ]);

  // 3. Создаем рабочую книгу
  const ws = XLSX.utils.aoa_to_sheet([...headerData, itemsHeader, ...itemsData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Счет");

  // 4. Сохраняем файл
  XLSX.writeFile(wb, `${supplierName.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`);
};
