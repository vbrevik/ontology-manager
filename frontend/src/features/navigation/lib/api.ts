import { getCsrfToken } from '@/features/auth/lib/auth';

export interface NavItemVisibility {
  id: string;
  label: string;
  href: string;
  icon?: string | null;
  visible: boolean;
  missing_permissions: string[];
  reasons: string[];
  children: NavItemVisibility[];
}

export interface NavSectionVisibility {
  id: string;
  label: string;
  visible: boolean;
  items: NavItemVisibility[];
}

export async function evaluateNavigation(): Promise<NavSectionVisibility[]> {
  const csrfToken = getCsrfToken();
  const res = await fetch('/api/navigation/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error('Failed to evaluate navigation');
  }

  return res.json();
}

export interface NavItemSummary {
  id: string;
  label: string;
  href: string;
  section_id: string;
  section_label: string;
}

export interface NavigationSimulation {
  added_items: NavItemSummary[];
  removed_items: NavItemSummary[];
  unchanged_items: NavItemSummary[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

export async function simulateNavigation(
  baselinePermissions: string[],
  proposedPermissions: string[],
): Promise<NavigationSimulation> {
  const csrfToken = getCsrfToken();
  const res = await fetch('/api/navigation/simulate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken || '',
    },
    credentials: 'include',
    body: JSON.stringify({
      baseline_permissions: baselinePermissions,
      proposed_permissions: proposedPermissions,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to simulate navigation');
  }

  return res.json();
}
