/**
 * Test Data Marker Utilities
 * 
 * Helpers for marking test data in E2E tests so it can be filtered
 * from production views.
 */

const TEST_MARKER_ID = 'a1b2c3d4-e5f6-7890-abcd-900000000002';

export interface MarkTestDataOptions {
  testSuite?: string;
  testName?: string;
}

/**
 * Mark an entity as test data via API
 */
export async function markEntityAsTestData(
  entityId: string,
  options: MarkTestDataOptions = {}
): Promise<boolean> {
  try {
    const response = await fetch('/api/test/mark-test-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        entity_id: entityId,
        test_suite: options.testSuite || 'e2e',
        test_name: options.testName,
      }),
    });

    return response.ok;
  } catch (error) {
    console.warn('Failed to mark entity as test data:', error);
    return false;
  }
}

/**
 * Mark current user as test user
 * This will automatically mark all entities they create as test data
 */
export async function markCurrentUserAsTest(
  testName: string = 'e2e-test'
): Promise<boolean> {
  try {
    const response = await fetch('/api/test/mark-current-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        test_suite: 'e2e',
        test_name: testName,
      }),
    });

    return response.ok;
  } catch (error) {
    console.warn('Failed to mark current user as test:', error);
    return false;
  }
}

/**
 * Check if an entity is marked as test data
 */
export async function isTestData(entityId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/test/is-test-data/${entityId}`, {
      credentials: 'include',
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.is_test_data === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get test marker entity ID (for creating relationships directly)
 */
export function getTestMarkerId(): string {
  return TEST_MARKER_ID;
}
