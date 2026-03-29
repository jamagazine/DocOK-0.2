import os
import io

with open("app/context/DataContext.tsx", "r", encoding="utf-8") as f:
    text = f.read()
    
old_logic = """        const data = await res.json();
        const tokens = data.usage?.total_tokens || 0;
        const cost = data.cost || 0;
        
        const strToNumOrBlank = (v: any) => {
           if (v === undefined || v === null || v === '') return '';
           const parsed = parseFloat(String(v).replace(/,/g, '.').replace(/\\s/g, ''));
           return isNaN(parsed) ? String(v) : String(parsed);
        };

        if (stage === 'spec') {
          const aiRows: SpecRow[] = (data.items || []).map((item: any) => {
            if (item.pos === 'ERROR') {
              toast.error(`Ошибка в файле ${file.name}: ${item.name} (${item.note || 'Без описания'})`, { duration: 5000 });
            }
            return {
              id: genId(),
              fileId: file.name,
              pos: item.pos || '',
              name: item.name || '',
              brand: item.brand || '',
              code: item.code || item.article || '',
              supplier: item.supplier || data.document?.metadata?.vendor || '',
              unit: item.unit || 'шт',
              quantity: item.is_header ? '' : (strToNumOrBlank(item.quantity) || '1'),
              mass: item.is_header ? '' : (strToNumOrBlank(item.mass) || '0'),
              note: item.note || (item.isUncertain ? 'Требует проверки' : ''),
              is_header: Boolean(item.is_header),
              originalRowsIds: [],
              children: []
            };
          });

          setSpecRows((prev) => [...prev, ...aiRows]);
          setBackupSpecRows((prev) => [...prev, ...aiRows]);
          setIsMerged(false);
        } else {
          const aiRows: InvoiceRow[] = (data.items || []).map((item: any) => {
            if (item.pos === 'ERROR') {
              toast.error(`Ошибка в файле ${file.name}: ${item.name} (${item.note || 'Без описания'})`, { duration: 5000 });
            }
            const r = emptyInvoiceRow();
            r.fileId = file.name;
            r.documentName = data.document?.filename || data.document?.name || file.name;
            r.isUncertain = Boolean(item.isUncertain);
            r.article = item.article || '';
            r.name = item.name || '';
            r.supplier = data.document?.metadata?.vendor || '';
            r.quantity = strToNumOrBlank(item.quantity) || '1';
            r.unit = item.unit || 'шт';
            r.price = strToNumOrBlank(item.price) || '0';
            r.total = strToNumOrBlank(item.total) || '0';
            return r;
          });

          setInvoiceRows((prev) => [...prev, ...aiRows]);
        }
          
        setUploadStatuses((prev: any) => ({ 
          ...prev, 
          [file.name]: { 
            ...prev?.[file.name],
            status: 'Готово (ИИ)', 
            time: currentTime,
            tokens,
            cost,
            model: data.model || '',
            method: data.method || '',
            chunks_report: data.chunks_report || []
          } 
        }));
        setFilesMap((prev: Record<string, File>) => ({ ...prev, [file.name]: file }));
        // Sync status 'ok' to server
        updateFileStatusOnServer(file.name, 'ok');"""

new_logic = """        const reader = res.body?.getReader();
        if (!reader) throw new Error('Поток недоступен');
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\\n\\n')) >= 0) {
              const packet = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 2);
              
              if (!packet.startsWith('data: ')) continue;
              
              const payloadStr = packet.slice(6);
              let payload;
              try {
                payload = JSON.parse(payloadStr);
              } catch (e) {
                console.error('Невалидный JSON пакет:', payloadStr);
                continue;
              }

              if (payload.status === 'stage') {
                setUploadStatuses((prev: any) => ({
                  ...prev,
                  [file.name]: { ...prev[file.name], current_step: payload.step || 'prep' }
                }));
              } else if (payload.status === 'chunk') {
                setUploadStatuses((prev: any) => ({
                  ...prev,
                  [file.name]: {
                    ...prev[file.name],
                    current_step: 'ai',
                    processed_count: payload.index,
                    total_chunks: payload.total
                  }
                }));
              } else if (payload.status === 'error') {
                throw new Error(payload.detail || 'Неизвестная ошибка ИИ');
              } else if (payload.status === 'final') {
                const data = payload.data;
                const tokens = data.usage?.total_tokens || 0;
                const cost = data.cost || 0;
                
                const strToNumOrBlank = (v: any) => {
                   if (v === undefined || v === null || v === '') return '';
                   const parsed = parseFloat(String(v).replace(/,/g, '.').replace(/\\s/g, ''));
                   return isNaN(parsed) ? String(v) : String(parsed);
                };

                if (stage === 'spec') {
                  const aiRows: SpecRow[] = (data.items || []).map((item: any) => {
                    if (item.pos === 'ERROR') {
                      toast.error(`Ошибка в файле ${file.name}: ${item.name} (${item.note || 'Без описания'})`, { duration: 5000 });
                    }
                    return {
                      id: genId(),
                      fileId: file.name,
                      pos: item.pos || '',
                      name: item.name || '',
                      brand: item.brand || '',
                      code: item.code || item.article || '',
                      supplier: item.supplier || data.document?.metadata?.vendor || '',
                      unit: item.unit || 'шт',
                      quantity: item.is_header ? '' : (strToNumOrBlank(item.quantity) || '1'),
                      mass: item.is_header ? '' : (strToNumOrBlank(item.mass) || '0'),
                      note: item.note || (item.isUncertain ? 'Требует проверки' : ''),
                      is_header: Boolean(item.is_header),
                      originalRowsIds: [],
                      children: []
                    };
                  });

                  setSpecRows((prev) => [...prev, ...aiRows]);
                  setBackupSpecRows((prev) => [...prev, ...aiRows]);
                  setIsMerged(false);
                } else {
                  const aiRows: InvoiceRow[] = (data.items || []).map((item: any) => {
                    if (item.pos === 'ERROR') {
                      toast.error(`Ошибка в файле ${file.name}: ${item.name} (${item.note || 'Без описания'})`, { duration: 5000 });
                    }
                    const r = emptyInvoiceRow();
                    r.fileId = file.name;
                    r.documentName = data.document?.filename || data.document?.name || file.name;
                    r.isUncertain = Boolean(item.isUncertain);
                    r.article = item.article || '';
                    r.name = item.name || '';
                    r.supplier = data.document?.metadata?.vendor || '';
                    r.quantity = strToNumOrBlank(item.quantity) || '1';
                    r.unit = item.unit || 'шт';
                    r.price = strToNumOrBlank(item.price) || '0';
                    r.total = strToNumOrBlank(item.total) || '0';
                    return r;
                  });

                  setInvoiceRows((prev) => [...prev, ...aiRows]);
                }
                  
                setUploadStatuses((prev: any) => ({ 
                  ...prev, 
                  [file.name]: { 
                    ...prev?.[file.name],
                    status: 'Готово (ИИ)', 
                    time: currentTime,
                    current_step: 'final',
                    tokens,
                    cost,
                    model: data.model || '',
                    method: data.method || '',
                    chunks_report: data.chunks_report || []
                  } 
                }));
                setFilesMap((prev: Record<string, File>) => ({ ...prev, [file.name]: file }));
                // Sync status 'ok' to server
                updateFileStatusOnServer(file.name, 'ok');
              }
            }
          }
        } finally {
          reader.cancel().catch(e => console.error('Не удалось закрыть поток:', e));
        }"""
        
if old_logic in text:
    print("Replacing old logic in DataContext.tsx")
    text = text.replace(old_logic, new_logic)
else:
    print("ERROR: old_logic not found in DataContext.tsx")

with open("app/context/DataContext.tsx", "w", encoding="utf-8") as f:
    f.write(text)
