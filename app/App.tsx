import React, { useState, useEffect, useRef } from 'react';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { CenterPanel } from './components/CenterPanel';
import type { Stage, UploadedFile } from './types';
import { DataProvider, useData } from './context/DataContext';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);
  const [currentStage, setCurrentStage] = useState<Stage>('spec');
  const [projectName, setProjectName] = useState('Проект Торговый Центр "Галактика"');

  const stageOrder: Stage[] = ['spec', 'request', 'invoice', 'estimate'];
  const currentStageIndex = stageOrder.indexOf(currentStage);
  const hasNextStage = currentStageIndex < stageOrder.length - 1;
  const canProceed = currentStage !== 'estimate'; // Can proceed from any stage except the last one

  const handleNextStage = () => {
    if (hasNextStage) {
      setCurrentStage(stageOrder[currentStageIndex + 1]);
    }
  };

  const { invoiceRows, specRows, filesMap, handleFile, uploadStatuses, generateEstimate } = useData();
  
  useEffect(() => {
    if (currentStage === 'estimate') {
      generateEstimate();
    }
  }, [currentStage, specRows, invoiceRows, generateEstimate]);

  const fileEntries = Object.entries(uploadStatuses || {});
  const filesList: UploadedFile[] = fileEntries.map(([filename, data]) => {
    const s = data.status.toLowerCase();
    const st = s.includes('ошиб') ? 'error' : s.includes('готов') ? 'ok' : 'loading';
    const md = s.includes('ии') ? 'AI' : 'Local';
    return {
      id: filename,
      name: filename,
      status: st,
      method: md,
      uploadTime: data.time
    };
  });

  const [isDropZoneVisible, setIsDropZoneVisible] = useState(false);
  const dragCounter = useRef(0);
  const handleFileRef = useRef(handleFile);

  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current += 1;
      setIsDropZoneVisible(true);
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) setIsDropZoneVisible(false);
    };
    const handleDropWindow = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDropZoneVisible(false);
      
      const droppedFiles = Array.from(e.dataTransfer?.files || []);
      const validFiles = droppedFiles.filter(f => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return ['.pdf', '.png', '.jpg', '.jpeg', '.xls', '.xlsx', '.csv'].includes(ext);
      });

      if (validFiles.length > 0 && handleFileRef.current) {
        for (const file of validFiles) {
          await handleFileRef.current(file, currentStage, false);
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDropWindow);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDropWindow);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {isDropZoneVisible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-indigo-50/80 backdrop-blur-[4px] border-[3px] border-indigo-400 border-dashed m-6 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload size={54} className="text-indigo-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-indigo-700">Добавить документы</h2>
            <p className="text-indigo-600/70 mt-3 font-medium text-sm text-center max-w-sm">
              Отпустите файлы здесь, и мы моментально добавим их к проекту
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
        <LeftPanel 
          expanded={leftExpanded} 
          onToggle={() => setLeftExpanded(!leftExpanded)} 
          currentStage={currentStage}
          onSetStage={setCurrentStage}
        />
        
        <CenterPanel 
          currentStage={currentStage}
          projectName={projectName}
          setProjectName={setProjectName}
          files={filesList}
        />
        
        <RightPanel 
          expanded={rightExpanded} 
          onToggle={() => setRightExpanded(!rightExpanded)} 
          currentStage={currentStage}
          onNextStage={handleNextStage}
          hasNextStage={hasNextStage}
          canProceed={canProceed}
        />
      </div>
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
