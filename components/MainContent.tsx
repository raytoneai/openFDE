import React from 'react';
import { ProjectState, ChatMessage, AISettings } from '../types';
import { WorkflowTab, projectPhaseTabs } from '../lib/navigation';
import { AnalysisResult } from '../services/aiAnalysisService';
import { useAppTranslation } from '../hooks/useAppTranslation';
import ErrorBoundary from './ErrorBoundary';
import ArchetypeViewer from './ArchetypeViewer';
import {
  ProjectsPage,
  QuickStartPage,
  ScoutingPage,
} from '../pages';

// Lazy-loaded pages
const AcademyPage = React.lazy(() => import('../pages/AcademyPage'));
const ArchetypesPage = React.lazy(() => import('../pages/ArchetypesPage'));
const AIEnhancementPage = React.lazy(() => import('../pages/AIEnhancementPage'));
const DeliveryPage = React.lazy(() => import('../pages/DeliveryPage'));
const PricingPage = React.lazy(() => import('../components/PricingPage').then(m => ({ default: m.default })));
const ModelingPage = React.lazy(() => import('../pages/ModelingPage').then(m => ({ default: m.ModelingPage })));
const IntegrationPage = React.lazy(() => import('../pages/IntegrationPage').then(m => ({ default: m.IntegrationPage })));

const PageLoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div
      className="w-8 h-8 border-2 rounded-full animate-spin"
      style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
    />
  </div>
);

interface MainContentProps {
  activeTab: WorkflowTab | 'archetypeViewer';
  setActiveTab: (tab: any) => void;
  lang: 'en' | 'cn';
  project: ProjectState;
  setProject: (update: ProjectState | ((prev: ProjectState) => ProjectState)) => void;
  chatMessages: ChatMessage[];
  chatHistoryRef: React.MutableRefObject<ChatMessage[]>;
  isChatLoading: boolean;
  isDesigning: boolean;
  onCancelDesign: () => void;
  activeProviderApiKey: string | undefined;
  aiSettings: AISettings;
  // Archetype
  selectedArchetypeId: string | null;
  onSelectArchetype: (id: string) => void;
  onApplyArchetype: (id: string, skipConfirm?: boolean) => void;
  // AI Analysis
  aiAnalysisResult: AnalysisResult | null;
  setAiAnalysisResult: (r: AnalysisResult | null) => void;
  isAiAnalyzing: boolean;
  setIsAiAnalyzing: (v: boolean) => void;
  aiAnalysisError: string | null;
  setAiAnalysisError: (e: string | null) => void;
  // Design
  onDesignTrigger: () => void;
  onOpenSettings: () => void;
  onOpenQualityPanel: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeTab, setActiveTab, lang, project, setProject,
  chatMessages, chatHistoryRef, isChatLoading, isDesigning,
  onCancelDesign,
  activeProviderApiKey, aiSettings,
  selectedArchetypeId, onSelectArchetype, onApplyArchetype,
  aiAnalysisResult, setAiAnalysisResult,
  isAiAnalyzing, setIsAiAnalyzing,
  aiAnalysisError, setAiAnalysisError,
  onDesignTrigger, onOpenSettings, onOpenQualityPanel,
}) => {
  const { t } = useAppTranslation('nav');

  return (
    <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--color-bg-elevated)]">
      {isDesigning && (
        <div className="absolute inset-0 bg-[var(--color-bg-base)]/80 z-50 flex flex-col items-center justify-center">
          <div
            className="w-12 h-12 border-2 rounded-full animate-spin mb-4"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
          />
          <h2 className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>{t('app.synthesizing')}</h2>
          <p className="text-muted mt-2 text-sm">{t('app.mapping')}</p>
          <button
            type="button"
            onClick={onCancelDesign}
            className="mt-5 px-4 py-2 rounded-md text-sm transition-colors hover:bg-[var(--color-bg-hover)]"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            {t('app.cancel')}
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${projectPhaseTabs.includes(activeTab as WorkflowTab) ? 'pb-20' : ''}`}>
        <ErrorBoundary onReset={() => setActiveTab('projects')}>
          {activeTab === 'projects' && <ProjectsPage onOpenProject={() => setActiveTab('scouting')} />}
          {activeTab === 'quickStart' && <QuickStartPage lang={lang} project={project} onNavigate={setActiveTab} />}
          {activeTab === 'academy' && <React.Suspense fallback={<PageLoadingFallback />}><AcademyPage lang={lang} /></React.Suspense>}
          {activeTab === 'archetypes' && (
            <React.Suspense fallback={<PageLoadingFallback />}>
              <ArchetypesPage aiSettings={aiSettings} onSelectArchetype={onSelectArchetype} onApplyArchetype={onApplyArchetype} />
            </React.Suspense>
          )}
          {activeTab === 'pricing' && <React.Suspense fallback={<PageLoadingFallback />}><PricingPage /></React.Suspense>}
          {activeTab === 'archetypeViewer' && selectedArchetypeId && (
            <ArchetypeViewer
              archetypeId={selectedArchetypeId}
              onBack={() => { setActiveTab('archetypes'); }}
              onApply={() => onApplyArchetype(selectedArchetypeId)}
            />
          )}
          {activeTab === 'scouting' && (
            <ScoutingPage
              messages={chatMessages}
              project={project}
              isLoading={isChatLoading}
              hasApiKey={!!activeProviderApiKey}
              onDesignTrigger={onDesignTrigger}
              onOpenSettings={onOpenSettings}
            />
          )}
          {(activeTab === 'workbench' || activeTab === 'ontology' || activeTab === 'actionDesigner') && (
            <React.Suspense fallback={<PageLoadingFallback />}>
              <ModelingPage
                project={project}
                setProject={setProject}
                chatMessages={chatHistoryRef}
                onNavigateToScouting={() => setActiveTab('scouting')}
                onNavigateToArchetypes={() => setActiveTab('archetypes')}
              />
            </React.Suspense>
          )}
          {(activeTab === 'systemMap' || activeTab === 'overview') && (
            <React.Suspense fallback={<PageLoadingFallback />}>
              <IntegrationPage lang={lang} project={project} setProject={setProject} />
            </React.Suspense>
          )}
          {(activeTab === 'aiEnhancement' || activeTab === 'aip') && (
            <React.Suspense fallback={<PageLoadingFallback />}>
              <AIEnhancementPage
                project={project}
                setProject={setProject}
                aiSettings={aiSettings}
                analysisResult={aiAnalysisResult}
                onAnalysisResult={setAiAnalysisResult}
                isAnalyzing={isAiAnalyzing}
                onIsAnalyzingChange={setIsAiAnalyzing}
                analysisError={aiAnalysisError}
                onAnalysisError={setAiAnalysisError}
              />
            </React.Suspense>
          )}
          {activeTab === 'deliver' && (
            <React.Suspense fallback={<PageLoadingFallback />}>
              <DeliveryPage project={project} onOpenQualityPanel={onOpenQualityPanel} />
            </React.Suspense>
          )}
        </ErrorBoundary>
      </div>
    </main>
  );
};

export default MainContent;
