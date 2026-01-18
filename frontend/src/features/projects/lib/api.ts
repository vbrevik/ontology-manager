// Projects API client

export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    tenant_id: string | null;
    owner_id: string | null;
    parent_project_id: string | null;
    permissions?: string[];
}

export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    start_date: string | null;
    due_date: string | null;
    estimated_hours: number | null;
    created_at: string;
    updated_at: string;
    tenant_id: string | null;
    project_id: string | null;
    assignee_id: string | null;
}

export interface ProjectMember {
    user_id: string;
    username: string;
    email: string | null;
    role: string;
}

export interface CreateProjectInput {
    name: string;
    description?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    parent_project_id?: string;
}

export interface UpdateProjectInput {
    name?: string;
    description?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    parent_project_id?: string;
}

export interface CreateTaskInput {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    start_date?: string;
    due_date?: string;
    estimated_hours?: number;
    assignee_id?: string;
}

export interface UpdateTaskInput {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    start_date?: string;
    due_date?: string;
    estimated_hours?: number;
    assignee_id?: string;
}

const API_BASE = '/api/projects';

// Helper to get CSRF token from cookie
function getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
    return match ? match[2] : null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const csrfToken = getCsrfToken();
    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.details || error.error || 'Request failed');
    }

    return response.json();
}

// Projects API
export async function listProjects(): Promise<{ projects: Project[] }> {
    return fetchWithAuth(API_BASE);
}

export async function getProject(id: string): Promise<Project> {
    return fetchWithAuth(`${API_BASE}/${id}`);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
    return fetchWithAuth(API_BASE, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    return fetchWithAuth(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
}

export async function deleteProject(id: string): Promise<void> {
    await fetchWithAuth(`${API_BASE}/${id}`, { method: 'DELETE' });
}

export async function listSubProjects(id: string): Promise<{ projects: Project[] }> {
    return fetchWithAuth(`${API_BASE}/${id}/sub-projects`);
}


// Tasks API
export async function getProjectTasks(projectId: string): Promise<{ tasks: Task[] }> {
    return fetchWithAuth(`${API_BASE}/${projectId}/tasks`);
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
    return fetchWithAuth(`${API_BASE}/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function updateTask(projectId: string, taskId: string, input: UpdateTaskInput): Promise<Task> {
    return fetchWithAuth(`${API_BASE}/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE}/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
}

// Members API
export async function getProjectMembers(projectId: string): Promise<{ members: ProjectMember[] }> {
    return fetchWithAuth(`${API_BASE}/${projectId}/members`);
}

export async function addProjectMember(projectId: string, userId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE}/${projectId}/members/${userId}`, { method: 'POST' });
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE}/${projectId}/members/${userId}`, { method: 'DELETE' });
}

// Dependencies API
export async function getTaskDependencies(projectId: string, taskId: string): Promise<{ dependencies: string[] }> {
    return fetchWithAuth(`${API_BASE}/${projectId}/tasks/${taskId}/dependencies`);
}

export async function addTaskDependency(projectId: string, taskId: string, dependsOnId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE}/${projectId}/tasks/${taskId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ depends_on_id: dependsOnId }),
    });
}

export async function removeTaskDependency(projectId: string, taskId: string, dependsOnId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE}/${projectId}/tasks/${taskId}/dependencies/${dependsOnId}`, {
        method: 'DELETE',
    });
}

