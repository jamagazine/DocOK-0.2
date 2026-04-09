import { Loader2, Download, ChevronDown } from "lucide-react";
import { useData } from '../context/DataContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Button } from "./ui/button";
import { FileItem } from '../types';
import { EditableField } from './EditableField';
import { exportSupplierToExcel } from '../utils/exportUtils';
import { formatOrgName, formatItemCount } from '../utils/formatters';

export const InvoicesInfoList: React.FC = () => {
  const { uploadStatuses, verifyField, updateSupplierField, invoiceRows } = useData();

  const invoiceFiles = Object.entries(uploadStatuses)
    .filter(([_, status]) => status.type === 'invoice')
    .map(([filename, status]) => ({
      ...status,
      id: filename,
      name: filename,
    })) as FileItem[];

  if (invoiceFiles.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm opacity-50">
        Нет загруженных счетов
      </div>
    );
  }

  const getGroupStatusColor = (fields: (any | undefined)[]) => {
    const validFields = fields.filter(Boolean); // убираем undefined
    
    if (validFields.length === 0) return "bg-gray-300"; // Нет данных вообще (серая точка ожидания)
    
    const hasUnverified = validFields.some(f => (f.confidence ?? 1.0) < 0.9 && f.isVerified === false);
    if (hasUnverified) return "bg-yellow-500"; // Есть неподтвержденные сомнительные поля
    
    return "bg-green-500"; // Все поля отличные или подтверждены
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-[10px] items-center font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1">
        Поставщиков: {invoiceFiles.length}
      </div>
        <Accordion type="multiple" className="w-full space-y-2 px-1">
          {invoiceFiles.map((file) => {
            const supplierData = file.supplierData as any;
            const data = supplierData?.document || supplierData || {};
            const orgName = data.organization_name?.value || file.name;
            const isProcessing = file.status === 'processing' || file.status === 'uploading' || file.status?.includes('Анализ');

            const toField = (key: string) => data[key] ? { ...data[key], isVerified: !!file.verifiedFields?.[key] } : undefined;
            const legalFields = data ? ['organization_name', 'inn', 'kpp', 'legal_address', 'postal_address', 'phone'].map(toField) : [];
            const paymentFields = data ? ['bank_name', 'bank_bik', 'bank_account', 'corr_account'].map(toField) : [];

            const legalStatus = getGroupStatusColor(legalFields);
            const paymentStatus = getGroupStatusColor(paymentFields);

            const fileItems = invoiceRows.filter(r => r.fileId === file.id);
            const itemCount = fileItems.length;
            
            const { form, name } = formatOrgName(orgName);
            const itemCountStr = formatItemCount(itemCount);
            const docType = data.document_type?.value;
            const isKp = docType === 'Коммерческое предложение';

            // Умный цвет статуса
            let statusColor = 'bg-gray-300';
            const hasLowConfidence = Object.entries(data).some(([key, field]) => {
                if (!field || typeof field !== 'object' || !('confidence' in (field as any))) return false;
                const fieldData = field as any;
                const isVerified = !!file.verifiedFields?.[key];
                return (fieldData.confidence ?? 1.0) < 0.95 && !isVerified;
            });
            const isCriticalMissing = !orgName || orgName === '---' || (!isKp && (!data.inn?.value || data.inn?.value === '---'));

            if (isCriticalMissing) {
                statusColor = 'bg-red-500 shadow-red-500/50';
            } else if (hasLowConfidence) {
                statusColor = 'bg-yellow-500 shadow-yellow-500/50';
            } else {
                statusColor = 'bg-green-500 shadow-green-500/50';
            }

            return (
              <AccordionItem 
                value={file.id!} 
                key={file.id} 
                className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="group hover:no-underline px-4 py-3 hover:bg-slate-50 transition-colors [&>svg]:hidden">
                  <div className="grid grid-cols-[48px_1fr_24px] gap-2.5 w-full text-left items-center">
                      
                      {/* КОЛОНКА 1: Счетчики и Тип документа (Минимализм без плашек) */}
                      <div className="flex flex-col items-start gap-1">
                          <span 
                              className="text-[11px] font-bold text-slate-400 leading-tight mb-1" 
                              title={`${itemCount} позиций`}
                          >
                              {itemCountStr}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${isKp ? 'text-orange-500' : 'text-blue-500'}`}>
                              {isKp ? 'КП' : 'СЧЕТ'}
                          </span>
                      </div>

                      {/* КОЛОНКА 2: Название организации + Контекстный индикатор */}
                      <div className="flex flex-col min-w-0" title={orgName}>
                          {isProcessing ? (
                            <div className="flex items-center gap-2 pt-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                <span className="text-[13px] font-bold text-slate-400">Обработка...</span>
                            </div>
                          ) : (
                            <>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
                                    {form && (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                            {form}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 break-all sm:break-normal overflow-hidden text-ellipsis">
                                    {name}
                                </span>
                            </>
                          )}
                      </div>

                      {/* КОЛОНКА 3: Только стрелка */}
                      <div className="flex flex-col items-end">
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>

                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-3 pb-3 pt-1 border-t border-slate-50">
                  <Accordion type="multiple" defaultValue={["legal_group"]} className="w-full space-y-2">
                    
                    {/* Группа 1: Юридические реквизиты */}
                    <AccordionItem value="legal_group" className="border border-slate-100 rounded-lg bg-slate-50/50 overflow-hidden">
                      <AccordionTrigger className="text-xs py-2 px-3 hover:no-underline hover:bg-slate-100/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${legalStatus}`} />
                          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Юридические реквизиты</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1">
                        <div className="flex flex-col">
                          {[
                            { key: 'document_type', label: 'Тип док-та' },
                            { key: 'contact_person', label: 'Ответств. лицо' },
                            { key: 'inn', label: 'ИНН' },
                            { key: 'kpp', label: 'КПП' },
                            { key: 'phone', label: 'Телефон' },
                            { key: 'legal_address', label: 'Юр. адрес' },
                            { key: 'postal_address', label: 'Почтовый адрес' }
                          ].map((f) => {
                              const fieldData = data[f.key] || {};
                              return (
                                <EditableField 
                                  key={f.key}
                                  label={f.label}
                                  value={fieldData.value}
                                  confidence={fieldData.confidence ?? 1.0}
                                  isVerified={!!file.verifiedFields?.[f.key]}
                                  note={fieldData.note}
                                  onVerify={() => file.id && verifyField(file.id, f.key)}
                                  onChange={(val) => file.id && updateSupplierField(file.id, f.key, val)}
                                />
                              )
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Группа 2: Платежные реквизиты */}
                    <AccordionItem value="payment" className="border border-slate-100 rounded-lg bg-slate-50/50 overflow-hidden">
                      <AccordionTrigger className="text-xs py-2 px-3 hover:no-underline hover:bg-slate-100/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${paymentStatus}`} />
                          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Платежные реквизиты</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1">
                        <div className="flex flex-col">
                          {[
                            { key: 'bank_name', label: 'Банк' },
                            { key: 'bank_bik', label: 'БИК' },
                            { key: 'bank_account', label: 'Счёт' },
                            { key: 'corr_account', label: 'Корр. счет' }
                          ].map((f) => {
                              const fieldData = data[f.key] || {};
                              return (
                                <EditableField 
                                  key={f.key}
                                  label={f.label}
                                  value={fieldData.value}
                                  confidence={fieldData.confidence ?? 1.0}
                                  isVerified={!!file.verifiedFields?.[f.key]}
                                  note={fieldData.note}
                                  onVerify={() => file.id && verifyField(file.id, f.key)}
                                  onChange={(val) => file.id && updateSupplierField(file.id, f.key, val)}
                                />
                              )
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportSupplierToExcel(
                          data?.organization_name?.value || file.name,
                          data,
                          invoiceRows.filter(row => row.fileId === file.id)
                        );
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Скачать Excel
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
    </div>
  );
};
