import { Loader2, Download, Sparkles } from "lucide-react";
import { useData } from '../context/DataContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FileItem } from '../types';
import { EditableField } from './EditableField';
import { exportSupplierToExcel } from '../utils/exportUtils';

export const InvoicesInfoList: React.FC = () => {
  const { uploadStatuses, verifyField, updateSupplierField, invoiceRows, reprocessAi } = useData();

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
    
    const hasEmpty = validFields.some(f => !f.value || f.value === "---");
    if (hasEmpty) return "bg-red-500"; // Есть пустые обязательные поля
    
    const hasUnverified = validFields.some(f => (f.confidence ?? 1.0) < 0.95 && f.isVerified === false);
    if (hasUnverified) return "bg-yellow-500"; // Есть неподтвержденные сомнительные поля
    
    return "bg-green-500"; // Все поля отличные или подтверждены
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-[10px] items-center font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1">
        Поставщиков: {invoiceFiles.filter(f => {
          const d = (f.supplierData as any)?.document || f.supplierData || {};
          return !!d.inn?.value;
        }).length}
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

            const overallStatus = [legalStatus, paymentStatus].includes("bg-red-500") ? "bg-red-500" 
                                : [legalStatus, paymentStatus].includes("bg-yellow-500") ? "bg-yellow-500" 
                                : [legalStatus, paymentStatus].includes("bg-gray-300") ? "bg-gray-300"
                                : "bg-green-500";

            const fileItems = invoiceRows.filter(r => r.fileId === file.id);
            const itemCount = fileItems.length;

            return (
              <AccordionItem 
                value={file.id!} 
                key={file.id} 
                className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="hover:no-underline px-3 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5 w-full pr-2">
                    <div className="mr-1 flex-shrink-0">
                      {(!data || isProcessing) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      ) : (
                        <div className={`w-3 h-3 rounded-full ${overallStatus} shadow-sm`} />
                      )}
                    </div>
                    <div className="flex flex-col items-start min-w-0 flex-1 gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-800 whitespace-normal text-left">
                          {orgName}
                        </span>
                        {data.document_type?.value && data.document_type.value !== "---" && (
                          <Badge variant="outline" className="text-[10px] h-5 py-0 px-1.5 border-indigo-200 text-indigo-600 bg-indigo-50">
                            {data.document_type.value}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {itemCount} поз.
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
