
import { type AuthResponse } from './auth';

export interface MfaSetupResponse {
    secret: string;
    qr_code: string; // Base64 PNG
}

export interface MfaStatusResponse {
    enabled: boolean;
    method?: string;
}

export interface MfaBackupCodesResponse {
    backup_codes: string[];
}

export async function getMfaStatus(userId: string): Promise<MfaStatusResponse | null> {
    try {
        const response = await fetch(`/api/auth/mfa/status?user_id=${userId}`, {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

export async function setupMfa(userId: string, email: string): Promise<MfaSetupResponse> {
    const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email }),
        credentials: 'include',
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Failed to setup MFA');
    }
    return await response.json();
}

export async function verifyMfaSetup(userId: string, code: string): Promise<void> {
    const response = await fetch('/api/auth/mfa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code }),
        credentials: 'include',
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Failed to verify MFA setup');
    }
}

// Ensure AuthResponse type is used.
// This function completes the login process.
export async function verifyMfaLogin(userId: string, code: string, rememberMe: boolean): Promise<AuthResponse> {
    const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code, remember_me: rememberMe }),
        credentials: 'include',
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'MFA Verification failed');
    }

    return await response.json();
}

export async function disableMfa(userId: string): Promise<void> {
    const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to disable MFA');
}

export async function regenerateBackupCodes(userId: string): Promise<string[]> {
    const response = await fetch('/api/auth/mfa/backup-codes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to regenerate codes');
    const data = await response.json();
    return data.backup_codes;
}
