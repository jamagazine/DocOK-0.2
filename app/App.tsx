import React, { useState } from 'react';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { CenterPanel } from './components/CenterPanel';
import type { Stage, UploadedFile } from './types';

export default function App() {
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

  // Mock files based on stage
  const files: Record<Stage, UploadedFile[]> = {
    spec: [
      { id: '1', name: 'Спецификация_электрика.xlsx', status: 'ok', method: 'Local', uploadTime: '10:45 12.03.2026' },
      { id: '2', name: 'План_освещения.pdf', status: 'loading', method: 'AI', uploadTime: '11:20 12.03.2026' },
      { id: '3', name: 'Ошибочный_файл.docx', status: 'error', method: 'Local', uploadTime: '09:15 12.03.2026' },
    ],
    request: [
      { id: '4', name: 'Шаблон_запроса_поставщикам.xlsx', status: 'ok', method: 'Local', uploadTime: '15:30 13.03.2026' },
    ],
    invoice: [
      { id: '5', name: 'Счет_СветПромОпт_№45.pdf', status: 'ok', method: 'AI', uploadTime: '08:10 15.03.2026' },
      { id: '6', name: 'Счет_КабельТорг_№122.jpg', status: 'ok', method: 'AI', uploadTime: '09:05 15.03.2026' },
    ],
    estimate: []
  };

  return (
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
        files={files[currentStage]}
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
  );
}
