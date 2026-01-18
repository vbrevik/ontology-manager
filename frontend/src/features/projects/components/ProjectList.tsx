import { useState, useEffect } from 'react';
import { listProjects, createProject, type Project, type CreateProjectInput } from '../lib/api';
import { useNavigate } from '@tanstack/react-router';
import './ProjectList.css';

const STATUS_COLORS: Record<string, string> = {
    planning: '#6366f1',
    active: '#10b981',
    on_hold: '#f59e0b',
    completed: '#22c55e',
    archived: '#6b7280',
};

export function ProjectList() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState<CreateProjectInput>({ name: '', description: '', status: 'planning' });
    const navigate = useNavigate();

    useEffect(() => {
        loadProjects();
    }, []);

    async function loadProjects() {
        try {
            setLoading(true);
            const data = await listProjects();
            setProjects(data.projects);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateProject(e: React.FormEvent) {
        e.preventDefault();
        try {
            await createProject(newProject);
            setShowCreateModal(false);
            setNewProject({ name: '', description: '', status: 'planning' });
            loadProjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        }
    }

    if (loading) {
        return <div className="projects-loading">Loading projects...</div>;
    }

    return (
        <div className="projects-container">
            <header className="projects-header">
                <h1>Projects</h1>
                <button className="btn-create" onClick={() => setShowCreateModal(true)}>
                    + New Project
                </button>
            </header>

            {error && <div className="projects-error">{error}</div>}

            <div className="projects-grid">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        className="project-card"
                        onClick={() => navigate({ to: `/projects/${project.id}` })}
                    >
                        <div className="project-card-header">
                            <h3>{project.name}</h3>
                            <span
                                className="status-badge"
                                style={{ backgroundColor: STATUS_COLORS[project.status] || '#6b7280' }}
                            >
                                {project.status}
                            </span>
                        </div>
                        <p className="project-description">{project.description || 'No description'}</p>
                        <div className="project-meta">
                            <span className="project-date">
                                Created: {new Date(project.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className="projects-empty">
                        <p>No projects yet. Create your first project to get started!</p>
                    </div>
                )}
            </div>

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Create New Project</h2>
                        <form onSubmit={handleCreateProject}>
                            <div className="form-group">
                                <label htmlFor="name">Project Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    placeholder="Enter project name"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">Description</label>
                                <textarea
                                    id="description"
                                    value={newProject.description || ''}
                                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                    placeholder="Enter project description"
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="status">Status</label>
                                <select
                                    id="status"
                                    value={newProject.status}
                                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                                >
                                    <option value="planning">Planning</option>
                                    <option value="active">Active</option>
                                    <option value="on_hold">On Hold</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Create Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Project Detail Modal removed in favor of dedicated page */}
        </div>
    );
}
