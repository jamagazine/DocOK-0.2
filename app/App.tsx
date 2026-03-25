import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from './components/ui/sonner';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { CenterPanel } from './components/CenterPanel';
import type { Stage, UploadedFile } from './types';
import { DataProvider, useData } from './context/DataContext';
import { Upload } from 'lucide-react';

function AppContent() {
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);
  const { currentStage, setCurrentStage, invoiceRows, specRows, filesMap, handleFile, uploadStatuses, generateEstimate, isDragging, setIsDragging } = useData();
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
  const canProceed = currentStage !== 'estimate';

  const handleNextStage = () => {
    if (hasNextStage) {
      setCurrentStage(stageOrder[currentStageIndex + 1]);
    }
  };

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

  const handleFileRef = useRef(handleFile);

  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      const types = e.dataTransfer?.types;
      const isFile = types ? Array.from(types).indexOf('Files') !== -1 : false;
      if (isFile) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      const types = e.dataTransfer?.types;
      const isFile = types ? Array.from(types).indexOf('Files') !== -1 : false;
      if (isFile && e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // If relatedTarget is null, it means the cursor physically left the window bounds
      if (!e.relatedTarget) {
        setIsDragging(false);
      }
    };

    const handleDropWindow = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const droppedFiles = Array.from(e.dataTransfer?.files || []);
      if (droppedFiles.length > 0 && handleFileRef.current) {
        await handleFileRef.current(droppedFiles, currentStage);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDragging(false);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDropWindow);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDropWindow);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStage, setIsDragging]);

  return (
    <>
      <div 
        className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-12 transition-all duration-200 ${
          isDragging ? "pointer-events-auto bg-indigo-50/90 backdrop-blur-md opacity-100" : "pointer-events-none bg-transparent opacity-0"
        }`}
      >
        <div
          className={`flex flex-col items-center justify-center border-4 border-dashed border-indigo-400 rounded-[40px] w-full h-full max-w-7xl transition-transform duration-300 ${
            isDragging ? "scale-100" : "scale-95"
          }`}
        >
          <Upload size={80} className="text-indigo-500 mb-8 animate-bounce" />
          <h2 className="text-4xl font-extrabold text-indigo-800 text-center">Отпустите файлы для загрузки</h2>
          <p className="text-indigo-600/70 mt-6 font-semibold text-lg text-center max-w-lg">
            Файлы будут добавлены в текущий раздел: {currentStage === 'spec' ? 'Спецификация' : currentStage === 'invoice' ? 'Счета' : 'Проект'}
          </p>
        </div>
      </div>
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
