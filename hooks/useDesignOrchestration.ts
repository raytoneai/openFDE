import React, { useState, useCallback, useRef } from 'react';
import { ProjectState, ChatMessage, Language } from '../types';
import { AIService } from '../services/aiService';
import { isAbortLikeError } from '../services/ai/request';
import { normalizeLinks } from '../lib/cardinality';
import { getMergedArchetypeById } from '../content/archetypes';
import { emptyProjectState } from '../lib/navigation';

interface DesignOrchestrationDeps {
  aiService: React.MutableRefObject<AIService>;
  chatHistoryRef: React.MutableRefObject<ChatMessage[]>;
  activeProjectIdRef: React.MutableRefObject<string | null>;
  activeProjectId: string | null;
  project: ProjectState;
  setProject: (update: ProjectState | ((prev: ProjectState) => ProjectState)) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setCurrentOntology: (state: ProjectState) => void;
  clearAnalysis: () => void;
  setActiveTab: (tab: any) => void;
  t: (key: string, options?: any) => string;
  i18nLang: Language;
  modelConfigured: boolean;
}

/**
 * Encapsulates triggerAutoDesign and archetype application logic.
 * Extracted from App.tsx to reduce its size.
 */
export function useDesignOrchestration(deps: DesignOrchestrationDeps) {
  const {
    aiService, chatHistoryRef, activeProjectIdRef,
    activeProjectId, project, setProject, setChatMessages, setCurrentOntology,
    clearAnalysis, setActiveTab, t, i18nLang, modelConfigured,
  } = deps;

  const [isDesigning, setIsDesigning] = useState(false);
  const designGenerationIdRef = useRef(0);
  const designAbortControllerRef = useRef<AbortController | null>(null);

  // Archetype state
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string | null>(null);

  const triggerAutoDesign = useCallback(async () => {
    if (designAbortControllerRef.current) return;

    if (!modelConfigured) {
      alert(t('app.alertSelectModel'));
      return;
    }

    if (!chatHistoryRef.current || chatHistoryRef.current.length === 0) {
      alert(t('app.alertNoChatHistory'));
      return;
    }

    const requestProjectId = activeProjectIdRef.current;
    const thisGenerationId = ++designGenerationIdRef.current;
    const controller = new AbortController();
    designAbortControllerRef.current = controller;

    setIsDesigning(true);
    try {
      const readiness = await aiService.current.validateReadiness(chatHistoryRef.current, {
        lang: i18nLang,
        signal: controller.signal,
      });

      if (!readiness.ready) {
        alert(readiness.suggestion || t('app.alertNoChatHistory'));
        return;
      }

      const result = await aiService.current.designOntology(chatHistoryRef.current, {
        lang: i18nLang,
        signal: controller.signal,
      });

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI返回的数据格式无效');
      }

      const objects = Array.isArray(parsed.objects) ? parsed.objects : [];
      const links = Array.isArray(parsed.links) ? parsed.links : [];
      const integrations = Array.isArray(parsed.integrations) ? parsed.integrations : [];

      if (objects.length === 0) {
        console.warn('AI未能识别出业务对象，可能需要更多对话信息');
        alert(t('app.alertNoObjects'));
        return;
      }

      const validObjects = objects.filter((obj: any) =>
        obj && typeof obj === 'object' && obj.id && obj.name
      );

      if (validObjects.length === 0) {
        throw new Error('AI返回的对象结构无效');
      }

      const normalizedObjects = validObjects.map((obj: any) => ({
        ...obj,
        properties: Array.isArray(obj.properties) ? obj.properties : [],
        actions: Array.isArray(obj.actions) ? obj.actions : [],
        aiFeatures: Array.isArray(obj.aiFeatures) ? obj.aiFeatures : [],
      }));

      // Guard: project changed during async call
      if (activeProjectIdRef.current !== requestProjectId) {
        console.warn('Project changed during design generation, discarding result');
        alert(t('app.alertProjectChanged'));
        return;
      }

      setProject(prev => ({
        ...prev,
        objects: normalizedObjects,
        links: links,
        integrations: integrations,
        status: 'designing' as const,
      }));

      // Fire async LLM summary (non-blocking)
      const totalActions = normalizedObjects.reduce((sum: number, obj: any) => sum + (obj.actions?.length || 0), 0);

      const snapshot = normalizedObjects.map((o: any) => ({
        name: o.name,
        properties: (o.properties || []).length,
        actions: (o.actions || []).map((a: any) => a.name),
      }));
      const linksSummary = links.map((l: any) => `${l.source} → ${l.target} (${l.label || l.type || ''})`).join('; ');
      const integSummary = integrations.map((i: any) => i.name || i.type || '').filter(Boolean).join(', ');

      const summaryPrompt = `${t('app.summaryPromptIntro')}\n\n` +
        `${t('app.summaryPromptObjects', { objects: JSON.stringify(snapshot) })}\n` +
        `${t('app.summaryPromptLinks', { links: linksSummary || t('app.none') })}\n` +
        `${t('app.summaryPromptIntegrations', { integrations: integSummary || t('app.none') })}\n\n` +
        t('app.summaryPromptInstruction');

      const appendSummary = (msg: ChatMessage) => {
        if (activeProjectIdRef.current !== requestProjectId) return;
        if (designGenerationIdRef.current !== thisGenerationId) return;
        setChatMessages(prev => [...prev, msg]);
        chatHistoryRef.current = [...chatHistoryRef.current, msg];
      };

      aiService.current.chat(chatHistoryRef.current, summaryPrompt, { lang: i18nLang }).then(summary => {
        appendSummary({
          role: 'assistant',
          content: summary,
          metadata: { type: 'milestone', timestamp: new Date().toISOString() }
        });
      }).catch(() => {
        appendSummary({
          role: 'assistant',
          content: t('app.ontologyGenerated', { objects: normalizedObjects.length, actions: totalActions, links: links.length, integrations: integrations.length }),
          metadata: { type: 'milestone', timestamp: new Date().toISOString() }
        });
      });

      clearAnalysis();
      setActiveTab('ontology');
    } catch (error) {
      if (controller.signal.aborted || isAbortLikeError(error)) return;
      console.error('Design failed:', error);
      alert(t('app.alertDesignFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      if (designAbortControllerRef.current === controller) {
        designAbortControllerRef.current = null;
      }
      setIsDesigning(false);
    }
  }, [t, i18nLang, modelConfigured, setProject, clearAnalysis, setActiveTab, aiService, chatHistoryRef, activeProjectIdRef, setChatMessages]);

  const cancelAutoDesign = useCallback(() => {
    designAbortControllerRef.current?.abort(new DOMException('Design generation cancelled', 'AbortError'));
  }, []);

  const handleSelectArchetype = useCallback((archetypeId: string) => {
    setSelectedArchetypeId(archetypeId);
    setActiveTab('archetypeViewer');
  }, [setActiveTab]);

  const handleApplyArchetype = useCallback(async (archetypeId: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm(t('app.applyArchetype'))) return;

    const archetype = await getMergedArchetypeById(archetypeId);
    if (!archetype) {
      console.error('Archetype not found:', archetypeId);
      return;
    }

    const objects = archetype.ontology.objects.map(obj => ({
      ...obj,
      actions: obj.actions || [],
      properties: obj.properties || [],
      aiFeatures: obj.aiFeatures || [],
    }));

    const links = normalizeLinks(archetype.ontology.links || []);

    const integrations = archetype.connectors.flatMap(connector => {
      const systemName = connector.sourceSystem || connector.name || connector.id || '';

      let mechanism: string;
      if (connector.sync?.frequency) {
        mechanism = connector.sync.frequency === 'realtime' || connector.sync.frequency === 'streaming'
          ? 'Webhook' : 'API';
      } else if (connector.configuration?.connectionType) {
        mechanism = connector.configuration.connectionType;
      } else if (connector.syncFrequency) {
        mechanism = connector.syncFrequency === 'real-time' || connector.syncFrequency === 'realtime'
          ? 'Webhook' : 'API';
      } else {
        mechanism = 'API';
      }

      const dataPoints = connector.mappedObjects
        ? connector.mappedObjects.map((m: any) => m.sourceEntity).filter(Boolean)
        : (connector.fieldMapping || []).map((fm: any) => fm.source).filter(Boolean);

      const targetIds: string[] = connector.mappedObjects
        ? connector.mappedObjects.map((m: any) => m.objectId).filter(Boolean)
        : (connector.targetObjects || []);

      if (targetIds.length === 0) {
        return [{
          systemName,
          dataPoints: dataPoints.length > 0 ? dataPoints : [],
          mechanism,
          targetObjectId: '',
        }];
      }

      return targetIds.map((targetId: string) => ({
        systemName,
        dataPoints: dataPoints.length > 0 ? dataPoints : [targetId],
        mechanism,
        targetObjectId: targetId,
      }));
    });

    const systemMessage: ChatMessage = {
      role: 'system',
      content: `${t('app.archetypeImportTitle', { name: archetype.metadata.name })}\n\n` +
        `${t('app.archetypeImportDetails', { industry: archetype.metadata.industry, domain: archetype.metadata.domain, count: objects.length })}\n\n` +
        t('app.archetypeImportNote'),
      metadata: {
        type: 'archetype_import',
        archetypeId: archetypeId,
        archetypeName: archetype.metadata.name,
        timestamp: new Date().toISOString()
      }
    };

    setChatMessages(prev => [...prev, systemMessage]);
    chatHistoryRef.current = [...chatHistoryRef.current, systemMessage];

    clearAnalysis();

    setCurrentOntology({
      ...project,
      projectName: archetype.metadata.name,
      industry: archetype.metadata.industry,
      useCase: archetype.metadata.domain,
      objects,
      links,
      integrations,
      status: 'designing'
    });

    setActiveTab('ontology');
  }, [t, project, setChatMessages, chatHistoryRef, clearAnalysis, setCurrentOntology, setActiveTab]);

  const handleNewSession = useCallback(() => {
    if (window.confirm(t('app.confirmNewSession'))) {
      setChatMessages([]);
      setCurrentOntology({
        ...emptyProjectState,
        projectName: project.projectName,
      });
      chatHistoryRef.current = [];
      setActiveTab('quickStart');
    }
  }, [t, project.projectName, setChatMessages, setCurrentOntology, chatHistoryRef, setActiveTab]);

  return {
    isDesigning,
    selectedArchetypeId,
    setSelectedArchetypeId,
    cancelAutoDesign,
    triggerAutoDesign,
    handleSelectArchetype,
    handleApplyArchetype,
    handleNewSession,
  };
}
