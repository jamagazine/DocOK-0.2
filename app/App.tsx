import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from './components/ui/sonner';
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
  const [projectName, setProjectName] = useState(() => {
    try {
      const saved = localStorage.getItem('docok_projectName');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return 'Проект Торговый Центр "Галактика"';
  });

  useEffect(() => {
    localStorage.setItem('docok_projectName', JSON.stringify(projectName));
  }, [projectName]);

  const stageOrder: Stage[] = ['spec', 'request', 'invoice', 'estimate'];
  const currentStageIndex = stageOrder.indexOf(currentStage);
  const hasNextStage = currentStageIndex < stageOrder.length - 1;
  const canProceed = currentStage !== 'estimate'; // Can proceed from any stage except the last one

  const handleNextStage = () => {
    if (hasNextStage) {
      setCurrentStage(stageOrder[currentStageIndex + 1]);
    }
  };

  const { invoiceRows, specRows, filesMap, handleFile, uploadStatuses, generateEstimate, isDragging, setIsDragging } = useData();
  
  useEffect(() => {
    if (currentStage === 'estimate') {
      generateEstimate();
    }
  }, [currentStage, specRows, invoiceRows, generateEstimate]);

  const fileEntries = Object.entries((uploadStatuses || {}) as Record<string, any>);
  const filesList: UploadedFile[] = fileEntries.map(([filename, data]) => {
    const s = (data.status || '').toLowerCase();
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

  const dragCounter = useRef(0);
  const handleFileRef = useRef(handleFile);

  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  useEffect(() => {
    let hideTimer: NodeJS.Timeout;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      clearTimeout(hideTimer);
      if (Array.from(e.dataTransfer?.types || []).some(t => t === 'Files')) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      clearTimeout(hideTimer);
      // setIsDragging(true) could be called here as a fallback but usually not needed.
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Debounce the leave to prevent flickering when transitioning between DOM nodes
      hideTimer = setTimeout(() => {
        setIsDragging(false);
      }, 50);
    };

    const handleDropWindow = async (e: DragEvent) => {
      e.preventDefault();
      clearTimeout(hideTimer);
      setIsDragging(false);
      
      const droppedFiles = Array.from(e.dataTransfer?.files || []);
      if (droppedFiles.length > 0 && handleFileRef.current) {
        await handleFileRef.current(droppedFiles, currentStage);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimeout(hideTimer);
        setIsDragging(false);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDropWindow);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDropWindow);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStage, setIsDragging]);

  return (
    <>
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-indigo-50/90 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none p-12"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center border-4 border-dashed border-indigo-400 rounded-[40px] w-full h-full max-w-7xl"
            >
              <Upload size={80} className="text-indigo-500 mb-8 animate-bounce" />
              <h2 className="text-4xl font-extrabold text-indigo-800 text-center">Отпустите файлы для загрузки</h2>
              <p className="text-indigo-600/70 mt-6 font-semibold text-lg text-center max-w-lg">
                Файлы будут добавлены в текущий раздел: {currentStage === 'spec' ? 'Спецификация' : currentStage === 'invoice' ? 'Счета' : 'Проект'}
              </p>
            </motion.div>
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
      <Toaster position="top-right" richColors />
      <AppContent />
    </DataProvider>
  );
}
