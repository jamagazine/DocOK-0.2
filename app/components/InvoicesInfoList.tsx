import React, { useState, useRef, useEffect } from "react";
import { useData } from '../context/DataContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { EditableField } from './EditableField';
import { ChevronDown, ChevronRight, Check, Download, AlertCircle, FileText, CheckCircle2, FileStack, X } from "lucide-react";
import { exportSupplierToExcel } from '../utils/exportUtils';
import { formatOrgName, formatItemCount } from '../utils/formatters';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../utils/cn";

interface InternalSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const InternalCollapsibleSection: React.FC<InternalSectionProps> = ({ title, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col w-full">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full text-left group/section mb-2 outline-none"
      >
        <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 group-hover/section:text-indigo-500 transition-colors shrink-0">
          {title}
        </h4>
        <div className="h-[1px] flex-1 bg-slate-100 group-hover/section:bg-indigo-50 transition-colors mx-3" />
        <ChevronRight className={cn(
          "w-3.5 h-3.5 text-slate-300 transition-all duration-200",
          isOpen ? "rotate-90 text-indigo-400" : "group-hover/section:translate-x-0.5"
        )} />
      </button>
      
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

export const InvoicesInfoList: React.FC = () => {
  const { 
    suppliers, 
    saveSuppliers, 
    activeFileId, 
    setActiveFileId, 
    uploadStatuses, 
    verifyField, 
    updateSupplierField, 
    invoiceRows = [] 
  } = useData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const supplierEntries = Object.values(suppliers || {});

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  if (supplierEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 py-12 opacity-60">
        <FileStack className="w-12 h-12 mb-3 stroke-[1.5]" />
        <span className="text-sm font-medium tracking-tight">Нет данных о поставщиках</span>
        <span className="text-xs">Загрузите счета для анализа</span>
      </div>
    );
  }

  const handleEditStart = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditValue(currentName);
  };

  const handleEditSave = (id: string) => {
    if (!editValue.trim() || !suppliers[id] || editValue === suppliers[id].name) {
      setEditingId(null);
      return;
    }
    const updatedSuppliers = {
      ...suppliers,
      [id]: {
        ...suppliers[id],
        name: editValue.trim()
      }
    };
    saveSuppliers(updatedSuppliers);
    setEditingId(null);
  };

  const verifyAllSupplierData = (supplierId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supplier = suppliers[supplierId];
    if (!supplier) return;
    
    const profiles = supplier.requisites_profiles || [];
    profiles.forEach((profile: any) => {
      (profile.linked_files || []).forEach((fileId: string) => {
        const fileStatus = (uploadStatuses || {})[fileId];
        if (!fileStatus) return;
        const data = (fileStatus.supplierData || {}) as any;
        Object.entries(data).forEach(([key, field]) => {
          if (field && typeof field === 'object' && 'confidence' in (field as any)) {
            const isVerified = !!fileStatus.verifiedFields?.[key];
            if (((field as any).confidence ?? 1.0) < 0.95 && !isVerified) {
              verifyField(fileId, key);
            }
          }
        });
      });
    });
  };

  try {
    return (
      <div className="flex flex-col w-full h-full pb-8">
        <Accordion type="multiple" className="w-full space-y-4 px-1">
          {supplierEntries.map((supplier) => {
            if (!supplier || !supplier.id) return null;

            const { form, name: orgNameOnly } = formatOrgName(String(supplier?.name || "---"));
            const cleanName = orgNameOnly.replace(/^["'«]+|["'»]+$/g, '').trim();
            
            const profiles = Array.isArray(supplier.requisites_profiles) ? supplier.requisites_profiles : [];
            const primaryProfile = profiles[0] || {};
            const primaryFileId = Array.isArray(primaryProfile?.linked_files) ? primaryProfile.linked_files[0] : "";
            const primaryStatus = (uploadStatuses || {})[primaryFileId || ""] || {};
            const primarySD = (primaryStatus.supplierData || {}) as any;
            const primaryIsVerifiedMap = primaryStatus.verifiedFields || {};

            let hasLowConfidence = false;
            let allLinkedFiles: string[] = [];
            let totalItemsCount = 0;

            profiles.forEach(profile => {
              if (!profile) return;
              (profile.linked_files || []).forEach(fileId => {
                if (!fileId) return;
                if (!allLinkedFiles.includes(fileId)) {
                  allLinkedFiles.push(fileId);
                  const fileRows = (invoiceRows || []).filter(r => r.fileId === fileId);
                  totalItemsCount += fileRows.length;
                }
                const fs = (uploadStatuses || {})[fileId];
                if (!fs) return;
                const sd = (fs.supplierData || {}) as any;
                Object.entries(sd).forEach(([key, field]) => {
                  if (field && typeof field === 'object' && 'confidence' in (field as any)) {
                    if (((field as any).confidence ?? 1.0) < 0.95 || fs.uncertainFields?.[key]) {
                      hasLowConfidence = true;
                    }
                  }
                });
              });
            });
            
            const dotColor = hasLowConfidence ? "bg-amber-500" : "bg-emerald-500";
            
            const getShortDocType = (type: string | null | undefined) => {
              const t = String(type || "").toLowerCase();
              if (t.includes("счет")) return "СЧЕТ";
              if (t.includes("предложение") || t.includes(" кп")) return "КП";
              if (t.includes("спецификация")) return "СПЕЦ";
              if (t.includes("упд") || t.includes("универсальный")) return "УПД";
              if (t.includes("договор")) return "ДОГ";
              if (t.includes("смета")) return "СМЕТА";
              return "ДОК";
            };

            const docTypeLabel = getShortDocType(primarySD?.document_type?.value);

            return (
              <AccordionItem
                value={String(supplier.id)}
                key={supplier.id}
                className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                <AccordionTrigger className="group hover:no-underline px-5 py-4 hover:bg-slate-50/50 transition-colors [&>svg]:hidden">
                  <div className="grid grid-cols-[40px_1fr_30px] items-center gap-2.5 w-full text-left">
                    <div className="flex flex-col shrink-0 min-w-0">
                      <span className="text-[13px] font-semibold text-slate-400 leading-none mb-0.5">
                        {formatItemCount(totalItemsCount)}
                      </span>
                      <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest truncate">
                        {docTypeLabel}
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                       <div className="flex items-center gap-2 mb-1 pl-0.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor} shadow-[0_0_4px_rgba(0,0,0,0.1)]`} />
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none">
                            {form || "---"}
                          </span>
                       </div>

                       {editingId === supplier.id ? (
                         <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                           <input
                             ref={inputRef}
                             type="text"
                             value={editValue}
                             onChange={(e) => setEditValue(e.target.value)}
                             onBlur={() => handleEditSave(supplier.id)}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') handleEditSave(supplier.id);
                               if (e.key === 'Escape') setEditingId(null);
                             }}
                             className="text-[14px] font-bold text-slate-900 border border-indigo-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-100 w-full"
                           />
                         </div>
                       ) : (
                         <span 
                            className="text-[14px] font-bold text-slate-900 leading-tight line-clamp-2 break-words hover:text-indigo-600 transition-colors cursor-text"
                            title={supplier.name}
                            onClick={(e) => handleEditStart(e, supplier.id, String(supplier.name))}
                         >
                           {cleanName}
                         </span>
                       )}
                    </div>

                    <div className="flex justify-end pr-1">
                       <ChevronDown className="h-4 w-4 text-slate-300 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-0 bg-transparent border-t border-slate-100 relative">
                  {/* Внутренняя тень под шапкой (по просьбе пользователя) */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-slate-900/[0.04] to-transparent pointer-events-none" />
                  
                  <div className="flex flex-col px-5 pb-5 pt-4 space-y-4">
                    {hasLowConfidence && (
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl mt-1">
                         <div className="flex items-center gap-2 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                           <AlertCircle className="w-4 h-4" />
                           Требуется проверка
                         </div>
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className="h-7 text-[10px] bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 font-bold shadow-xs px-3 rounded-lg"
                           onClick={(e) => verifyAllSupplierData(supplier.id, e)}
                         >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Подтвердить
                         </Button>
                      </div>
                    )}

                    {/* СЕКЦИЯ 1: Реквизиты */}
                    <InternalCollapsibleSection title="Реквизиты" defaultOpen={true}>
                       <div className="flex flex-col divide-y divide-slate-100/60 mb-1">
                          <EditableField 
                             label="ИНН"
                             value={primarySD.inn?.value || profiles[0]?.data?.inn || supplier.inn}
                             confidence={primarySD.inn?.confidence ?? 1.0}
                             isVerified={!!primaryIsVerifiedMap['inn']}
                             note={primarySD.inn?.note}
                             onVerify={() => primaryFileId && verifyField(primaryFileId, 'inn')}
                             onChange={(val) => primaryFileId && updateSupplierField(primaryFileId, 'inn', val)}
                          />
                          <EditableField 
                             label="КПП"
                             value={primarySD.kpp?.value || profiles[0]?.data?.kpp}
                             confidence={primarySD.kpp?.confidence ?? 1.0}
                             isVerified={!!primaryIsVerifiedMap['kpp']}
                             note={primarySD.kpp?.note}
                             onVerify={() => primaryFileId && verifyField(primaryFileId, 'kpp')}
                             onChange={(val) => primaryFileId && updateSupplierField(primaryFileId, 'kpp', val)}
                          />
                          <EditableField 
                             label="Телефон / Email"
                             value={primarySD.phone?.value || profiles[0]?.data?.phone}
                             confidence={primarySD.phone?.confidence ?? 1.0}
                             isVerified={!!primaryIsVerifiedMap['phone']}
                             note={primarySD.phone?.note}
                             onVerify={() => primaryFileId && verifyField(primaryFileId, 'phone')}
                             onChange={(val) => primaryFileId && updateSupplierField(primaryFileId, 'phone', val)}
                          />
                          <EditableField 
                             label="Юр. адрес"
                             value={primarySD.legal_address?.value || profiles[0]?.data?.legal_address}
                             confidence={primarySD.legal_address?.confidence ?? 1.0}
                             isVerified={!!primaryIsVerifiedMap['legal_address']}
                             note={primarySD.legal_address?.note}
                             onVerify={() => primaryFileId && verifyField(primaryFileId, 'legal_address')}
                             onChange={(val) => primaryFileId && updateSupplierField(primaryFileId, 'legal_address', val)}
                          />
                          <EditableField 
                             label="Почтовый адрес"
                             value={primarySD.postal_address?.value || profiles[0]?.data?.postal_address}
                             confidence={primarySD.postal_address?.confidence ?? 1.0}
                             isVerified={!!primaryIsVerifiedMap['postal_address']}
                             note={primarySD.postal_address?.note}
                             onVerify={() => primaryFileId && verifyField(primaryFileId, 'postal_address')}
                             onChange={(val) => primaryFileId && updateSupplierField(primaryFileId, 'postal_address', val)}
                          />
                       </div>
                    </InternalCollapsibleSection>

                    {/* СЕКЦИЯ 2: Банк */}
                    <InternalCollapsibleSection title="Банковские реквизиты" defaultOpen={false}>
                       <div className="flex flex-col gap-4 mb-1">
                         {profiles.map((profile, idx) => {
                           if (!profile || !profile.profile_id) return null;
                           const fid = (profile.linked_files || [])[0];
                           const fs = (uploadStatuses || {})[fid] || {};
                           const sd = (fs.supplierData || {}) as any;
                           const isVerifiedMap = fs.verifiedFields || {};
                           const isMultiple = profiles.length > 1;

                           return (
                              <div key={profile.profile_id} className="flex flex-col">
                                {isMultiple && (
                                   <div className="mb-2 flex items-center">
                                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">Счет #{idx + 1}</span>
                                   </div>
                                )}
                                <div className="flex flex-col divide-y divide-slate-100/60">
                                   <EditableField 
                                       label="Банк"
                                       value={sd.bank_name?.value || profile.data?.bank_name}
                                       confidence={sd.bank_name?.confidence ?? 1.0}
                                       isVerified={!!isVerifiedMap['bank_name']}
                                       note={sd.bank_name?.note}
                                       onVerify={() => fid && verifyField(fid, 'bank_name')}
                                       onChange={(val) => fid && updateSupplierField(fid, 'bank_name', val)}
                                   />
                                   <EditableField 
                                       label="БИК"
                                       value={sd.bank_bik?.value || profile.data?.bank_bik}
                                       confidence={sd.bank_bik?.confidence ?? 1.0}
                                       isVerified={!!isVerifiedMap['bank_bik']}
                                       note={sd.bank_bik?.note}
                                       onVerify={() => fid && verifyField(fid, 'bank_bik')}
                                       onChange={(val) => fid && updateSupplierField(fid, 'bank_bik', val)}
                                   />
                                   <EditableField 
                                       label="Р/С"
                                       value={sd.bank_account?.value || profile.data?.bank_account}
                                       confidence={sd.bank_account?.confidence ?? 1.0}
                                       isVerified={!!isVerifiedMap['bank_account']}
                                       note={sd.bank_account?.note}
                                       onVerify={() => fid && verifyField(fid, 'bank_account')}
                                       onChange={(val) => fid && updateSupplierField(fid, 'bank_account', val)}
                                   />
                                </div>
                              </div>
                           )
                         })}
                       </div>
                    </InternalCollapsibleSection>
                  </div>

                  {/* Разделитель и тень перед инструментами (Теперь ВНЕ px-5, строго на всю ширину) */}
                  {allLinkedFiles.length > 0 && (
                    <>
                      <div className="w-full h-[1px] bg-slate-100 relative">
                         {/* Тень падает ВВЕРХ (к реквизитам), чтобы создать эффект вложенности */}
                         <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-slate-900/[0.04] to-transparent pointer-events-none" />
                      </div>
                      
                      <div className="flex flex-col space-y-4 py-5 px-5">
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="w-full h-9 text-[11px] font-bold border-slate-200 hover:bg-slate-50 text-slate-600 px-4 rounded-xl shadow-xs transition-all hover:border-slate-300"
                           onClick={(e) => {
                             e.stopPropagation();
                             const allItems = (invoiceRows || []).filter(r => allLinkedFiles.includes(r.fileId || ""));
                             exportSupplierToExcel(String(supplier.name), primarySD, allItems);
                           }}
                         >
                           <Download className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                           Карточка поставщика
                         </Button>

                         <div className="flex items-center justify-between mb-3 px-1">
                           <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Связанные документы</h4>
                         </div>
                         <div className="flex flex-wrap gap-2">
                           {allLinkedFiles.map(fileId => {
                             const isActive = activeFileId === fileId;
                             return (
                               <Badge 
                                 key={fileId}
                                 variant="secondary"
                                 className={cn(
                                   "cursor-pointer px-3 py-1.5 transition-all text-[11px] font-medium rounded-lg border",
                                   isActive 
                                   ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' 
                                   : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
                                 )}
                                 onClick={() => setActiveFileId(fileId)}
                               >
                                 <FileText className={cn("w-3.5 h-3.5 mr-2", isActive ? "opacity-100" : "opacity-40")} />
                                 {fileId}
                               </Badge>
                             )
                           })}
                         </div>
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    );
  } catch (err) {
    console.error("Supplier Info Render Error:", err);
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-4 bg-slate-50 rounded-3xl mx-2 border border-dashed text-slate-400">
        <AlertCircle className="w-12 h-12 opacity-50" />
        <div className="text-sm font-bold uppercase">Ошибка отрисовки данных</div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Обновить модуль</Button>
      </div>
    );
  }
};
