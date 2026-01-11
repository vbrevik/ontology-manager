
// Define types for our authentication state
export interface UserRoleClaim {
  role_name: string;
  resource_id: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles?: UserRoleClaim[];
  permissions?: string[];
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
  ip_address: string | null;
  is_current: boolean;
}

// Get user from cookie (access token)
export async function getUserFromToken(): Promise<AuthUser | null> {
  return getUserInfo();
}

// Check if user is authenticated (by checking if we have a valid access token cookie)
// Check if user is authenticated (by checking if we have a valid access token cookie)
export function isAuthenticated(): boolean {
  // Since we use HttpOnly cookies, we can't check document.cookie.
  // We return true here to optimistically trigger the API check in useAuth.
  // The API check will be the source of truth.
  return true;
}

// Validate CSRF token exists
export function hasCsrfToken(): boolean {
  return !!getCsrfToken();
}

// Get user info from API endpoint
export async function getUserInfo(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/auth/user', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    return null;
  }
}

// Login function
export async function login(identifier: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password, remember_me: rememberMe }),
      // Include credentials to send cookies
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Login failed (${response.status} ${response.statusText}): ${errorText}` };
    }

    // Tokens are now stored in HttpOnly cookies by the backend
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

// Register function
export async function register(username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
      // Include credentials to send cookies
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Registration failed (${response.status} ${response.statusText}): ${errorText}` };
    }

    // Tokens are now stored in HttpOnly cookies by the backend
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

// Helper to get CSRF token from cookie
export function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
  return match ? match[2] : null;
}

// Change password
export async function changePassword(email: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch('/api/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
      body: JSON.stringify({ email, current_password: currentPassword, new_password: newPassword }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { success: false, error: err || 'Change password failed' }
    }

    // Try parse json message
    try {
      const json = await response.json()
      return { success: true, error: json.message }
    } catch {
      return { success: true }
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' }
  }
}

// Update profile
export async function updateProfile(username: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { success: false, error: err || 'Update profile failed' }
    }

    const user = await response.json()
    return { success: true, user }
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' }
  }
}

// Logout function
export function logout(): void {
  const csrfToken = getCsrfToken();
  // Send logout request to backend to invalidate tokens
  fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken || '',
    },
    credentials: 'include',
  }).finally(() => {
    // Navigate to login page after logout
    window.location.href = '/login';
  });
}

// Refresh access token (this is now handled automatically by the backend)
export async function refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
  // With HttpOnly cookies, token refresh is handled automatically by the backend
  // This function can be used for additional logic if needed
  return { success: true };
}

// Refresh session to extend timeout
export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Session refresh failed:', error);
    return false;
  }
}

// List active sessions
export async function listSessions(): Promise<Session[]> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch('/api/auth/sessions', {
      method: 'GET',
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    return [];
  }
}

// Revoke a session
export async function revokeSession(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch(`/api/auth/sessions/${id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err || 'Revoke session failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

export interface AdminSessionResponse {
  id: string;
  user_id: string;
  username: string;
  email: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

export async function listAllSessions(): Promise<AdminSessionResponse[]> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch('/api/auth/sessions/all', {
      method: 'GET',
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to list sessions", error);
    return [];
  }
}

export async function revokeAdminSession(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch(`/api/auth/sessions/admin/${id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err || 'Revoke session failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

