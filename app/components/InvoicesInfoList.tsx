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
import { isDocumentFullyVerified } from '../utils/validation';
import { FileText } from 'lucide-react';
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
      <div className="text-center text-slate-500 py-4 text-sm">
        Нет загруженных счетов
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Счета на оплату ({invoiceFiles.length})</div>
      <Accordion type="single" collapsible className="w-full space-y-2">
        {invoiceFiles.map((file) => {
          const isFullyVerified = isDocumentFullyVerified(file);
          const supplierData = file.supplierData as any;
          const data = supplierData?.document || supplierData || {};

          return (
            <AccordionItem value={file.id!} key={file.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 w-full pr-4">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 truncate min-w-0 text-left w-full">{file.name}</span>
                  <div 
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isFullyVerified ? 'bg-emerald-500' : 'bg-yellow-500'}`} 
                    title={isFullyVerified ? "Проверено" : "Требует проверки"}
                  />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-1 border-t border-slate-100">
                <div className="flex flex-col gap-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Реквизиты поставщика</div>
                  
                  <div className="space-y-3">
                    {[
                      { key: 'organization_name', label: 'Организация' },
                      { key: 'inn', label: 'ИНН' },
                      { key: 'kpp', label: 'КПП' },
                      { key: 'legal_address', label: 'Юр. адрес' },
                      { key: 'postal_address', label: 'Почтовый адрес' }
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 font-medium pl-1">{f.label}</label>
                        <ConfidenceInput 
                          initialValue={data[f.key]?.value || null}
                          confidence={data[f.key]?.confidence ?? 1.0}
                          isVerified={!!file.verifiedFields?.[f.key]}
                          onConfirm={() => {
                            if (file.id) verifyField(file.id, f.key);
                            toast.success(`${f.label} подтвержден`);
                          }}
                        />
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
