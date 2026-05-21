/**
 * Project Context
 * Provides multi-project management state and methods throughout the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { storage } from '../lib/storageFacade';
import { useAuth } from './AuthContext';
import type { ProjectState, ChatMessage, Project, ProjectListItem } from '../types';

interface ProjectContextType {
  // Project list
  projects: ProjectListItem[];
  activeProjectId: string | null;
  activeProject: ProjectListItem | null;

  // Current project data
  currentOntology: ProjectState | null;
  currentChat: ChatMessage[];

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Project operations
  createProject: (params: {
    name: string;
    industry: string;
    useCase: string;
    description?: string;
    baseArchetypeId?: string;
    baseArchetypeName?: string;
    initialState?: ProjectState;
  }) => Project;
  switchProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Pick<ProjectListItem, 'name' | 'description' | 'industry' | 'status' | 'tags'>>) => void;

  // Current project data operations
  setCurrentOntology: React.Dispatch<React.SetStateAction<ProjectState | null>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addChatMessage: (message: ChatMessage) => void;

  // Refresh projects list
  refreshProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentOntology, setCurrentOntologyState] = useState<ProjectState | null>(null);
  const [currentChat, setCurrentChatState] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Ref to track if we're switching projects (to prevent save during switch)
  const isSwitchingRef = useRef(false);
  const switchingLockRef = useRef<string | null>(null);
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize on mount
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isCancelled = false;

    const initialize = async () => {
      setIsLoading(true);
      try {
        // Run migration if needed
        if (storage.needsMigration()) {
          storage.migrateOldData();
        }

        // Clean up legacy global data (e.g., old ontology-chat-messages key)
        storage.cleanupLegacyData();

        // Load projects list
        const projectList = storage.listProjectsLocal();
        if (isCancelled) return;
        setProjects(projectList);

        // Get active project
        let activeId = storage.getActiveProjectId();

        // If no active project but have projects, select the first one
        if (!activeId && projectList.length > 0) {
          activeId = projectList[0].id;
          storage.setActiveProjectId(activeId);
        }

        if (activeId) {
          if (isCancelled) return;
          setActiveProjectId(activeId);
          // Load project data
          const state = storage.getProjectStateById(activeId);
          const chat = storage.getChatMessagesById(activeId);
          if (isCancelled) return;
          setCurrentOntologyState(state);
          setCurrentChatState(chat);
        } else {
          setActiveProjectId(null);
          setCurrentOntologyState(null);
          setCurrentChatState([]);
        }
      } catch (error) {
        console.error('Failed to initialize project context:', error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initialize();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isAuthLoading]);

  // Auto-save current ontology when it changes
  useEffect(() => {
    if (!isInitialized || !activeProjectId || isSwitchingRef.current) return;
    if (!currentOntology) return;

    // Cancel any pending save
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }

    // Debounce save
    saveDebounceTimerRef.current = setTimeout(() => {
      // Double-check we haven't started switching
      if (!isSwitchingRef.current && switchingLockRef.current === null) {
        storage.saveProjectStateById(activeProjectId, currentOntology);
        // Refresh projects list to update progress
        setProjects(storage.listProjectsLocal());
      }
      saveDebounceTimerRef.current = null;
    }, 500);

    return () => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
    };
  }, [currentOntology, activeProjectId, isInitialized]);

  // Auto-save chat messages when they change
  useEffect(() => {
    if (!isInitialized || !activeProjectId || isSwitchingRef.current) return;

    // Debounce save
    const timer = setTimeout(() => {
      storage.saveChatMessagesById(activeProjectId, currentChat);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentChat, activeProjectId, isInitialized]);

  // Get active project metadata
  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  // Create a new project
  const createProject = useCallback((params: {
    name: string;
    industry: string;
    useCase: string;
    description?: string;
    baseArchetypeId?: string;
    baseArchetypeName?: string;
    initialState?: ProjectState;
  }): Project => {
    const project = storage.createProject(params);

    // Refresh projects list
    setProjects(storage.listProjectsLocal());

    // Switch to new project
    setActiveProjectId(project.id);
    const state = storage.getProjectStateById(project.id);
    const chat = storage.getChatMessagesById(project.id);
    setCurrentOntologyState(state);
    setCurrentChatState(chat);

    return project;
  }, []);

  // Switch to a different project
  const switchProject = useCallback(async (projectId: string) => {
    if (projectId === activeProjectId) return;

    // Prevent concurrent switches
    if (switchingLockRef.current) {
      console.warn('[ProjectContext] Project switch already in progress:', switchingLockRef.current);
      return;
    }

    switchingLockRef.current = projectId;
    isSwitchingRef.current = true;
    setIsLoading(true);

    try {
      // Cancel any pending save
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
      }

      // Save current project data first
      if (activeProjectId && currentOntology) {
        storage.saveProjectStateById(activeProjectId, currentOntology);
        storage.saveChatMessagesById(activeProjectId, currentChat);
      }

      // Load new project data
      const state = storage.getProjectStateById(projectId);
      const chat = storage.getChatMessagesById(projectId);

      // Update state
      storage.setActiveProjectId(projectId);
      setActiveProjectId(projectId);
      setCurrentOntologyState(state);
      setCurrentChatState(chat);

      // Refresh projects list
      setProjects(storage.listProjectsLocal());
    } catch (error) {
      console.error('Failed to switch project:', error);
    } finally {
      setIsLoading(false);
      isSwitchingRef.current = false;
      switchingLockRef.current = null;
    }
  }, [activeProjectId, currentOntology, currentChat]);

  // Delete a project
  const deleteProject = useCallback((projectId: string) => {
    storage.deleteProject(projectId);

    // Update state
    const newProjects = storage.listProjectsLocal();
    setProjects(newProjects);

    // If deleted active project, switch to another
    if (projectId === activeProjectId) {
      const newActiveId = storage.getActiveProjectId();
      setActiveProjectId(newActiveId);
      if (newActiveId) {
        const state = storage.getProjectStateById(newActiveId);
        const chat = storage.getChatMessagesById(newActiveId);
        setCurrentOntologyState(state);
        setCurrentChatState(chat);
      } else {
        setCurrentOntologyState(null);
        setCurrentChatState([]);
      }
    }
  }, [activeProjectId]);

  // Update project metadata
  const updateProject = useCallback((
    projectId: string,
    updates: Partial<Pick<ProjectListItem, 'name' | 'description' | 'industry' | 'status' | 'tags'>>
  ) => {
    storage.updateProject(projectId, updates);
    setProjects(storage.listProjectsLocal());
  }, []);

  // Set current ontology (for external updates)
  const setCurrentOntology = useCallback((state: React.SetStateAction<ProjectState | null>) => {
    setCurrentOntologyState(state);
  }, []);

  // Set chat messages
  const setChatMessages = useCallback((messages: React.SetStateAction<ChatMessage[]>) => {
    setCurrentChatState(messages);
  }, []);

  // Add a single chat message
  const addChatMessage = useCallback((message: ChatMessage) => {
    setCurrentChatState(prev => [...prev, message]);
  }, []);

  // Refresh projects list
  const refreshProjects = useCallback(() => {
    setProjects(storage.listProjectsLocal());
  }, []);

  const value: ProjectContextType = {
    projects,
    activeProjectId,
    activeProject,
    currentOntology,
    currentChat,
    isLoading,
    isInitialized,
    createProject,
    switchProject,
    deleteProject,
    updateProject,
    setCurrentOntology,
    setChatMessages,
    addChatMessage,
    refreshProjects,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export { ProjectContext };
