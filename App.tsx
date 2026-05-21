
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import i18next from './lib/i18n';
import { useAppTranslation } from './hooks/useAppTranslation';
import { ProjectState, ChatMessage, Language } from './types';
import { WorkflowTab, projectPhaseTabs, loadLastActiveTab, emptyProjectState, tabToPhase } from './lib/navigation';
import { runQualityCheck } from './utils/qualityChecker';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { storage } from './lib/storageFacade';
import { AuthModal } from './components/auth';
import UnifiedSettings from './components/UnifiedSettings';
import GlobalChatBar from './components/GlobalChatBar';
import { Sidebar } from './components/Sidebar';
import ReviewPanel from './components/ReviewPanel';
import MainContent from './components/MainContent';
import { useAppSettings } from './hooks/useAppSettings';
import { useAIAnalysis } from './hooks/useAIAnalysis';
import { useCloudSync } from './hooks/useCloudSync';
import { useDesignOrchestration } from './hooks/useDesignOrchestration';

const AppContent: React.FC = () => {
  const { t, lang, i18nLang } = useAppTranslation('nav');
  const setLang = useCallback((newLang: Language) => { i18next.changeLanguage(newLang); }, []);
  const [activeTab, setActiveTab] = useState<WorkflowTab | 'archetypeViewer'>(loadLastActiveTab);

  // Project context
  const { currentChat: chatMessages, setChatMessages, activeProjectId, currentOntology, setCurrentOntology } = useProject();
  const chatHistoryRef = useRef<ChatMessage[]>(chatMessages);
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  const project = currentOntology || emptyProjectState;

  const setProject = useCallback((update: ProjectState | ((prev: ProjectState) => ProjectState)) => {
    if (typeof update === 'function') {
      setCurrentOntology(prev => update(prev || emptyProjectState));
    } else {
      setCurrentOntology(update);
    }
  }, [setCurrentOntology]);

  useEffect(() => { chatHistoryRef.current = chatMessages; }, [chatMessages]);

  // Extracted hooks
  const {
    aiSettings, aiService, showSettings, setShowSettings,
    currentTheme, setCurrentTheme, handleSettingsChange,
    getCurrentModelName, activeProviderApiKey,
  } = useAppSettings();

  const {
    aiAnalysisResult, setAiAnalysisResult,
    isAiAnalyzing, setIsAiAnalyzing,
    aiAnalysisError, setAiAnalysisError,
    clearAnalysis,
  } = useAIAnalysis(activeProjectId);

  const { isAuthenticated } = useAuth();
  useCloudSync(isAuthenticated, activeProjectId, currentOntology);

  const {
    isDesigning, selectedArchetypeId, setSelectedArchetypeId,
    cancelAutoDesign,
    triggerAutoDesign, handleSelectArchetype, handleApplyArchetype, handleNewSession,
  } = useDesignOrchestration({
    aiService, chatHistoryRef, activeProjectIdRef,
    activeProjectId, project, setProject, setChatMessages, setCurrentOntology,
    clearAnalysis, setActiveTab, t, i18nLang,
    modelConfigured: !!aiSettings.model,
  });

  // UI state
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'ai' | 'account'>('ai');
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  const [reviewTab, setReviewTab] = useState<'quality' | 'readiness'>('quality');
  const canShowQualityPanel = !!activeProjectId && projectPhaseTabs.includes(activeTab as WorkflowTab);

  // Auth-related effects
  const handleOpenAccountSettings = useCallback(() => {
    setSettingsInitialTab('account');
    setShowSettings(true);
  }, [setShowSettings]);

  useEffect(() => { storage.setAuthCheck(() => isAuthenticated); }, [isAuthenticated]);
  useEffect(() => {
    if (isAuthenticated) {
      storage.migrateLocalToCloud().then((projectId) => {
        if (projectId) console.log('Migrated local project to cloud:', projectId);
      });
    }
  }, [isAuthenticated]);

  // Navigation guards
  useEffect(() => {
    if (!activeProjectId && projectPhaseTabs.includes(activeTab as WorkflowTab)) {
      setActiveTab('projects');
    }
  }, [activeProjectId, activeTab]);

  useEffect(() => {
    if (showQualityPanel && !canShowQualityPanel) setShowQualityPanel(false);
  }, [canShowQualityPanel, showQualityPanel]);

  // Persist active tab
  useEffect(() => {
    if (activeTab !== 'archetypeViewer') {
      try { localStorage.setItem('ontology-last-tab', activeTab); } catch (e) { /* ignore */ }
    }
  }, [activeTab]);

  // Phase readiness for sidebar badges
  const phaseReadiness = useMemo(() => {
    const hasObjects = project.objects.length > 0;
    const p2 = hasObjects ? { sublabel: t('app.readiness_objects', { count: project.objects.length }) } : {};

    const intCount = project.integrations?.length || 0;
    const unconfiguredInt = intCount > 0 ? (project.integrations || []).filter(int =>
      !int.targetObjectId || !project.objects.some(o => o.id === int.targetObjectId || o.name === int.targetObjectId)
    ).length : 0;
    let p3: { sublabel?: string; sublabelColor?: string } = {};
    if (intCount > 0 && unconfiguredInt > 0) {
      p3 = { sublabel: t('app.readiness_integrationsPending', { count: intCount, pending: unconfiguredInt }), sublabelColor: 'var(--color-warning)' };
    } else if (intCount > 0) {
      p3 = { sublabel: t('app.readiness_integrations', { count: intCount }) };
    }

    let p4: { sublabel?: string; sublabelColor?: string } = {};
    if (hasObjects && aiAnalysisResult) {
      p4 = { sublabel: t('app.readiness_aiComplete') };
    } else if (hasObjects && !aiAnalysisResult) {
      p4 = { sublabel: t('app.readiness_aiPending'), sublabelColor: 'var(--color-warning)' };
    }

    let p5: { sublabel?: string; sublabelColor?: string } = {};
    if (hasObjects) {
      const qr = runQualityCheck(project);
      const gradeKey: Record<string, string> = { A: 'readiness_qualityExcellent', B: 'readiness_qualityGood', C: 'readiness_qualityFair', D: 'readiness_qualityNeedsWork', F: 'readiness_qualityNeedsWork' };
      p5 = {
        sublabel: t(`app.${gradeKey[qr.grade] || 'readiness_qualityNeedsWork'}`),
        ...(qr.grade === 'D' || qr.grade === 'F' ? { sublabelColor: 'var(--color-warning)' } : {}),
      };
    }

    return { p2, p3, p4, p5 };
  }, [project, aiAnalysisResult, t]);

  return (
    <div className="flex h-screen overflow-hidden text-secondary" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProjectId={activeProjectId}
        hasObjects={project.objects.length > 0}
        phaseReadiness={phaseReadiness}
        activeProviderApiKey={activeProviderApiKey}
        getCurrentModelName={getCurrentModelName}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onResetArchetype={() => setSelectedArchetypeId(null)}
        onOpenAccountSettings={handleOpenAccountSettings}
      />

      <MainContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        project={project}
        setProject={setProject}
        chatMessages={chatMessages}
        chatHistoryRef={chatHistoryRef}
        isChatLoading={isChatLoading}
        isDesigning={isDesigning}
        onCancelDesign={cancelAutoDesign}
        activeProviderApiKey={activeProviderApiKey}
        aiSettings={aiSettings}
        selectedArchetypeId={selectedArchetypeId}
        onSelectArchetype={handleSelectArchetype}
        onApplyArchetype={handleApplyArchetype}
        aiAnalysisResult={aiAnalysisResult}
        setAiAnalysisResult={setAiAnalysisResult}
        isAiAnalyzing={isAiAnalyzing}
        setIsAiAnalyzing={setIsAiAnalyzing}
        aiAnalysisError={aiAnalysisError}
        setAiAnalysisError={setAiAnalysisError}
        onDesignTrigger={triggerAutoDesign}
        onOpenSettings={() => setShowSettings(true)}
        onOpenQualityPanel={() => { setReviewTab('quality'); setShowQualityPanel(true); }}
      />

      {showQualityPanel && canShowQualityPanel && (
        <ReviewPanel
          project={project}
          reviewTab={reviewTab}
          setReviewTab={setReviewTab}
          onClose={() => setShowQualityPanel(false)}
          onNavigate={(tab) => { setShowQualityPanel(false); setActiveTab(tab as any); }}
        />
      )}

      {showSettings && (
        <UnifiedSettings
          aiSettings={aiSettings}
          currentTheme={currentTheme}
          onAISettingsChange={handleSettingsChange}
          onThemeChange={setCurrentTheme}
          onLanguageChange={setLang}
          onReset={handleNewSession}
          onClose={() => { setShowSettings(false); setSettingsInitialTab('ai'); }}
          initialTab={settingsInitialTab}
        />
      )}

      {projectPhaseTabs.includes(activeTab as WorkflowTab) && (
        <GlobalChatBar
          lang={lang}
          project={project}
          setProject={setProject}
          aiSettings={aiSettings}
          aiService={aiService.current}
          currentPhase={tabToPhase(activeTab as WorkflowTab)}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
          isExpanded={isChatExpanded}
          onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
          messagesInMainArea={activeTab === 'scouting'}
          onLoadingChange={setIsChatLoading}
          historyRef={chatHistoryRef}
          activeProjectId={activeProjectId}
          onNavigateToProjects={() => setActiveTab('projects')}
          onOpenQualityPanel={canShowQualityPanel ? () => setShowQualityPanel(true) : undefined}
        />
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} lang={lang} />
    </div>
  );
};

// Wrapper component with providers
const App: React.FC = () => (
  <AuthProvider>
    <SyncProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </SyncProvider>
  </AuthProvider>
);

export default App;
