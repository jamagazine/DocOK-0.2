import React from 'react';
import { useData } from '../context/DataContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { FileItem } from '../types';
import { EditableField } from './EditableField';

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

  const getStatusColor = (file: FileItem, data: any) => {
    const fields = ['organization_name', 'inn', 'kpp', 'legal_address', 'postal_address', 'phone', 'bank_name', 'bank_bik', 'bank_account', 'corr_account'];
    
    const hasEmpty = fields.some(key => {
      // some fields might be purely optional, but we will count red if org_name or inn is empty
      const isRequired = ['organization_name', 'inn', 'legal_address'].includes(key);
      if (isRequired && !data[key]?.value) return true;
      return false;
    });

    if (hasEmpty) return 'bg-red-500';

    const hasUnverifiedOrLowConfidence = fields.some(key => {
      if (!data[key]?.value) return false;
      const isVerified = !!file.verifiedFields?.[key];
      const lowConf = (data[key]?.confidence ?? 1.0) < 0.95;
      return !isVerified || lowConf;
    });

    if (hasUnverifiedOrLowConfidence) return 'bg-yellow-500';

    return 'bg-green-500';
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Accordion type="multiple" className="w-full space-y-2">
        {invoiceFiles.map((file) => {
          const supplierData = file.supplierData as any;
          const data = supplierData?.document || supplierData || {};
          const orgName = data.organization_name?.value || file.name;
          const statusColor = getStatusColor(file, data);

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
                  <div 
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${statusColor}`} 
                  />
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="text-[13px] font-bold text-slate-800 whitespace-normal text-left">
                      {orgName}
                    </span>
                  </div>
                  <div className="flex-shrink-0 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {itemCount} поз.
                  </div>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="px-3 pb-3 pt-1 border-t border-slate-50">
                <Accordion type="multiple" className="w-full space-y-2">
                  
                  {/* Группа 1: Юридические реквизиты */}
                  <AccordionItem value="legal" className="border border-slate-100 rounded-lg bg-slate-50/50 overflow-hidden">
                    <AccordionTrigger className="px-3 py-2 text-[10px] uppercase font-black text-slate-400 tracking-wider hover:no-underline hover:bg-slate-100/50">
                      Юридические реквизиты
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-1">
                      <div className="flex flex-col">
                        {[
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
                    <AccordionTrigger className="px-3 py-2 text-[10px] uppercase font-black text-slate-400 tracking-wider hover:no-underline hover:bg-slate-100/50">
                      Платежные реквизиты
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
                                onVerify={() => file.id && verifyField(file.id, f.key)}
                                onChange={(val) => file.id && updateSupplierField(file.id, f.key, val)}
                              />
                            )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
