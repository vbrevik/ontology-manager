/**
 * Test Mode Utilities
 * 
 * Similar to firefighter mode, test mode allows users to temporarily
 * enter a mode where all entities they create are automatically marked
 * as test data.
 */

export interface TestModeSession {
  id: string;
  user_id: string;
  test_suite: string;
  test_run_id: string | null;
  justification: string;
  activated_at: string;
  expires_at: string;
  ended_at: string | null;
  entities_marked: number;
}

export interface TestModeStatus {
  is_active: boolean;
  session: TestModeSession | null;
  minutes_remaining: number | null;
}

export interface ActivateTestModeRequest {
  test_suite?: string;
  test_run_id?: string;
  justification: string;
  duration_minutes?: number;
}

export interface ActivateTestModeResponse {
  session: TestModeSession;
  message: string;
}

export interface DeactivateTestModeResponse {
  message: string;
  entities_marked: number;
  duration_minutes: number;
}

/**
 * Get current test mode status
 */
export async function getTestModeStatus(): Promise<TestModeStatus | null> {
  try {
    const response = await fetch('/api/test-mode/status', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to get test mode status:', error);
    return null;
  }
}

/**
 * Activate test mode
 */
export async function activateTestMode(
  request: ActivateTestModeRequest
): Promise<ActivateTestModeResponse | null> {
  try {
    const response = await fetch('/api/test-mode/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to activate test mode:', error);
    throw error;
  }
}

/**
 * Deactivate test mode
 */
export async function deactivateTestMode(): Promise<DeactivateTestModeResponse | null> {
  try {
    const response = await fetch('/api/test-mode/deactivate', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to deactivate test mode:', error);
    throw error;
  }
}

/**
 * List all active test mode sessions (admin only)
 */
export async function listActiveTestModeSessions(): Promise<TestModeSession[]> {
  try {
    const response = await fetch('/api/test-mode/active-sessions', {
      credentials: 'include',
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('Failed to list active test mode sessions:', error);
    return [];
  }
}
