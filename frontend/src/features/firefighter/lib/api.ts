import { getCsrfToken } from "../../auth/lib/auth";

export interface FirefighterSession {
    id: string;
    user_id: string;
    elevated_role_id: string;
    justification: string;
    activated_at: string;
    expires_at: string;
    deactivated_at: string | null;
    deactivated_by: string | null;
    deactivation_reason: string | null;
    ip_address: string | null;
    user_agent: string | null;
}

export interface FirefighterStatus {
    is_active: boolean;
    session: FirefighterSession | null;
}

export async function requestElevation(password: string, justification: string, durationMinutes?: number): Promise<{ success: boolean; session?: FirefighterSession; error?: string }> {
    try {
        const csrfToken = getCsrfToken();
        const response = await fetch('/api/firefighter/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || '',
            },
            credentials: 'include',
            body: JSON.stringify({ password, justification, duration_minutes: durationMinutes }),
        });

        if (!response.ok) {
            const err = await response.json();
            return { success: false, error: err.error || 'Elevation request failed' };
        }

        const session = await response.json();
        return { success: true, session };
    } catch (error: any) {
        return { success: false, error: error.message || 'Network error' };
    }
}

export async function getFirefighterStatus(): Promise<FirefighterStatus> {
    try {
        const response = await fetch('/api/firefighter/status', {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            return { is_active: false, session: null };
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get firefighter status:', error);
        return { is_active: false, session: null };
    }
}

export async function deactivateFirefighter(reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const csrfToken = getCsrfToken();
        const response = await fetch('/api/firefighter/deactivate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || '',
            },
            credentials: 'include',
            body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
            const err = await response.json();
            return { success: false, error: err.error || 'Deactivation failed' };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Network error' };
    }
}

export async function listFirefighterSessions(): Promise<FirefighterSession[]> {
    try {
        const response = await fetch('/api/firefighter/sessions', {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to list firefighter sessions:', error);
        return [];
    }
}
