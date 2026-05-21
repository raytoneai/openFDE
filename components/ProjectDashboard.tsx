/**
 * Project Dashboard Component
 * 项目工作台组件
 *
 * 展示项目列表，支持创建、切换、删除项目
 */

import React, { useState, useMemo } from 'react';


import { useProject } from '../contexts/ProjectContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  FolderOpen, Plus, Search, Trash2, Clock, Package,
  GitBranch, Layers, Zap, MoreVertical, Star, Edit2,
  ArrowRight, AlertCircle, Users, History
} from 'lucide-react';
import NewProjectDialog from './NewProjectDialog';
import ProjectMembers from './ProjectMembers';

interface Props {
  onOpenProject?: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'var(--color-text-muted)',
  active: 'var(--color-success)',
  archived: 'var(--color-warning)',
  completed: 'var(--color-info)',
};

export default function ProjectDashboard({ onOpenProject }: Props) {
  const { t } = useAppTranslation('nav');
  const {
    projects,
    activeProjectId,
    switchProject,
    deleteProject,
    updateProject,
    isLoading
  } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);

  const handleOpenCreateDialog = () => {
    setShowNewDialog(true);
  };

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.industry.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('projectDashboard.justNow');
    if (diffMins < 60) return t('projectDashboard.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('projectDashboard.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('projectDashboard.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  const handleOpenProject = async (projectId: string) => {
    await switchProject(projectId);
    onOpenProject?.();
  };

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId);
    setDeleteConfirmId(null);
  };

  const handleRenameProject = (projectId: string, currentName: string) => {
    const nextName = window.prompt(t('projectDashboard.renamePrompt'), currentName);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) {
      alert(t('projectDashboard.renameEmpty'));
      return;
    }
    updateProject(projectId, { name: trimmed });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <FolderOpen style={{ color: 'var(--color-accent)' }} />
            {t('projectDashboard.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('projectDashboard.subtitle')}
          </p>
        </div>
        <button
          onClick={handleOpenCreateDialog}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg-base)'
          }}
        >
          <Plus size={18} />
          {t('projectDashboard.newProject')}
        </button>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2"
            size={18}
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder={t('projectDashboard.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <div
          className="text-center py-16 rounded-xl border-2 border-dashed"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)'
          }}
        >
          <FolderOpen
            className="mx-auto mb-4"
            size={48}
            style={{ color: 'var(--color-text-muted)' }}
          />
          <h3
            className="text-lg font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {t('projectDashboard.noProjects')}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            {t('projectDashboard.noProjectsHint')}
          </p>
          <button
            onClick={handleOpenCreateDialog}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-bg-base)'
            }}
          >
            <Plus size={18} />
            {t('projectDashboard.createFirst')}
          </button>
        </div>
      )}

      {/* Search Empty State */}
      {projects.length > 0 && filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Search
            className="mx-auto mb-4"
            size={32}
            style={{ color: 'var(--color-text-muted)' }}
          />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('projectDashboard.emptySearch')}</p>
        </div>
      )}

      {/* Project Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => {
          const isActive = project.id === activeProjectId;
          return (
            <div
              key={project.id}
              className="relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg flex flex-col"
              style={{
                backgroundColor: isActive
                  ? 'var(--color-bg-elevated)'
                  : 'var(--color-bg-surface)',
                borderColor: isActive
                  ? 'var(--color-accent)'
                  : 'var(--color-border)',
              }}
              onClick={() => handleOpenProject(project.id)}
            >
              {/* Current Badge */}
              {isActive && (
                <div
                  className="absolute -top-2 -right-2 px-2 py-0.5 text-xs rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-bg-base)'
                  }}
                >
                  <Star size={10} fill="currentColor" />
                  {t('projectDashboard.current')}
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {project.name}
                  </h3>
                  {project.description && (
                    <p
                      className="text-sm truncate mt-0.5"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {project.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusColors[project.status] }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {t(`projectDashboard.${project.status}`)}
                  </span>
                </div>
              </div>

              {/* Industry & Template */}
              <div className="flex flex-wrap gap-2 mb-3">
                {project.industry && (
                  <span
                    className="px-2 py-0.5 text-xs rounded"
                    style={{
                      backgroundColor: 'var(--color-bg-hover)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    {project.industry}
                  </span>
                )}
                {project.baseArchetypeName && (
                  <span
                    className="px-2 py-0.5 text-xs rounded flex items-center gap-1"
                    style={{
                      backgroundColor: 'var(--color-accent-secondary)',
                      color: 'var(--color-bg-base)',
                      opacity: 0.9
                    }}
                  >
                    <Package size={10} />
                    {project.baseArchetypeName}
                  </span>
                )}
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div
                  className="flex justify-between text-xs mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <span>{t('projectDashboard.completeness')}</span>
                  <span>{project.progress.completeness}%</span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--color-bg-hover)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${project.progress.completeness}%`,
                      backgroundColor: 'var(--color-accent)'
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div
                className="flex items-center gap-4 text-xs mb-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span className="flex items-center gap-1">
                  <Layers size={12} />
                  {project.progress.objectCount} {t('projectDashboard.objects')}
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch size={12} />
                  {project.progress.linkCount} {t('projectDashboard.links')}
                </span>
                <span className="flex items-center gap-1">
                  <Zap size={12} />
                  {project.progress.actionCount} {t('projectDashboard.actions')}
                </span>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between pt-3 mt-auto"
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <Clock size={12} />
                  {formatRelativeTime(project.updatedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharingProjectId(project.id);
                    }}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    title={t('sharing.title')}
                  >
                    <Users size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameProject(project.id, project.name);
                    }}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    title={t('projectDashboard.rename')}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(project.id);
                    }}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    title={t('projectDashboard.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProject(project.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-bg-base)'
                    }}
                  >
                    {t('projectDashboard.open')}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === project.id && (
                <div
                  className="absolute inset-0 rounded-xl flex flex-col items-center justify-center p-4 z-10"
                  style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    opacity: 0.98
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertCircle
                    className="mb-2"
                    size={32}
                    style={{ color: 'var(--color-error)' }}
                  />
                  <p
                    className="text-sm text-center mb-4"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {t('projectDashboard.deleteConfirm')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-4 py-1.5 text-sm rounded transition-colors"
                      style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      {t('projectDashboard.cancel')}
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="px-4 py-1.5 text-sm rounded transition-colors hover:opacity-90"
                      style={{
                        backgroundColor: 'var(--color-error)',
                        color: '#fff'
                      }}
                    >
                      {t('projectDashboard.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Project Dialog */}
      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onCreated={() => {
            setShowNewDialog(false);
            onOpenProject?.();
          }}
        />
      )}

      {/* Sharing / Members Modal */}
      {sharingProjectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4" onClick={() => setSharingProjectId(null)}>
          <div
            className="w-full max-w-md max-h-[70vh] rounded-xl overflow-auto"
            style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('sharing.title')}</h3>
                <button onClick={() => setSharingProjectId(null)} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>✕</button>
              </div>
            </div>
            <ProjectMembers projectId={sharingProjectId} isOwner={true} />
          </div>
        </div>
      )}
    </div>
  );
}
