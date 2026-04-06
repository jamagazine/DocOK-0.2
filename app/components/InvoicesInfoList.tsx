import React from 'react';
import { useData } from '../context/DataContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { FileItem } from '../types';
import { ConfidenceInput } from './Table/EditableCell';
import { toast } from 'sonner';

export const InvoicesInfoList: React.FC = () => {
  const { uploadStatuses, verifyField } = useData();

  // Find all files that are of type 'invoice'
  const invoiceFiles = Object.entries(uploadStatuses)
    .filter(([_, status]) => status.type === 'invoice')
    .map(([filename, status]) => ({
      ...status,
      id: filename,
      name: filename,
    })) as FileItem[];

  if (invoiceFiles.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mx-1">
        Нет загруженных счетов
      </div>
    );
  }

  const getStatusColor = (file: FileItem, data: any) => {
    const fields = ['organization_name', 'inn', 'kpp', 'legal_address', 'postal_address'];
    const allVerified = fields.every(key => !!file.verifiedFields?.[key]);
    if (allVerified) return 'bg-emerald-500';

    const hasLowConfidence = fields.some(key => (data[key]?.confidence ?? 1.0) < 0.95);
    if (hasLowConfidence) return 'bg-yellow-500';

    const hasEmptyFields = fields.some(key => !data[key]?.value);
    if (hasEmptyFields) return 'bg-rose-500';

    return 'bg-blue-500'; // Default / processing
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1">
        Документы ({invoiceFiles.length})
      </div>
      
      <Accordion type="multiple" className="w-full space-y-2">
        {invoiceFiles.map((file) => {
          const supplierData = file.supplierData as any;
          const data = supplierData?.document || supplierData || {};
          const orgName = data.organization_name?.value || file.name;
          const statusColor = getStatusColor(file, data);

          return (
            <AccordionItem 
              value={file.id!} 
              key={file.id} 
              className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm transition-all hover:border-slate-300"
            >
              <AccordionTrigger className="hover:no-underline px-3 py-2.5 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-center gap-2.5 w-full pr-2 overflow-hidden">
                  <div 
                    className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${statusColor}`} 
                    title="Статус проверки"
                  />
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="text-[13px] font-bold text-slate-700 truncate w-full text-left leading-tight">
                      {orgName}
                    </span>
                    {data.organization_name?.value && (
                      <span className="text-[10px] text-slate-400 italic truncate w-full text-left font-normal mt-0.5">
                        {file.name}
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="px-3 pb-4 pt-2 border-t border-slate-50">
                <div className="flex flex-col gap-5">
                  
                  {/* Group 1: LEGAL DETAILS */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span className="w-1 h-3 bg-indigo-500/30 rounded-full" />
                      ЮРИДИЧЕСКИЕ РЕКВИЗИТЫ
                    </div>
                    {[
                      { key: 'organization_name', label: 'Организация' },
                      { key: 'inn', label: 'ИНН' },
                      { key: 'kpp', label: 'КПП' },
                      { key: 'legal_address', label: 'Юр. адрес' },
                      { key: 'postal_address', label: 'Почтовый адрес' },
                      { key: 'phone', label: 'Телефон' }
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col gap-1.5 overflow-hidden">
                        <label className="text-[11px] text-slate-500 font-semibold pl-1 uppercase tracking-tight">
                          {f.label}
                        </label>
                        <div className="break-all overflow-wrap-anywhere">
                          <ConfidenceInput 
                            initialValue={data[f.key]?.value || null}
                            confidence={data[f.key]?.confidence ?? 1.0}
                            isVerified={!!file.verifiedFields?.[f.key]}
                            onConfirm={() => {
                              if (file.id) verifyField(file.id, f.key);
                              toast.success(`${f.label} подтвержден`, {
                                style: { fontSize: '12px' }
                              });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Group 2: PAYMENT DETAILS */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span className="w-1 h-3 bg-emerald-500/30 rounded-full" />
                      ПЛАТЕЖНЫЕ РЕКВИЗИТЫ
                    </div>
                    {[
                      { key: 'bank_name', label: 'Название банка' },
                      { key: 'bank_bik', label: 'БИК' },
                      { key: 'bank_account', label: 'Расчетный счет' }
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col gap-1.5 overflow-hidden">
                        <label className="text-[11px] text-slate-500 font-semibold pl-1 uppercase tracking-tight">
                          {f.label}
                        </label>
                        <div className="break-all">
                          <ConfidenceInput 
                            initialValue={data[f.key]?.value || null}
                            confidence={data[f.key]?.confidence ?? 1.0}
                            isVerified={!!file.verifiedFields?.[f.key]}
                            onConfirm={() => {
                              if (file.id) verifyField(file.id, f.key);
                              toast.success(`${f.label} подтвержден`, {
                                style: { fontSize: '12px' }
                              });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
