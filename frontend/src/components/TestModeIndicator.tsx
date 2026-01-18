import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TestTube, X, Clock } from 'lucide-react';
import {
  getTestModeStatus,
  deactivateTestMode,
  type TestModeStatus,
} from '@/lib/testMode';

export function TestModeIndicator() {
  const [status, setStatus] = useState<TestModeStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    const currentStatus = await getTestModeStatus();
    setStatus(currentStatus);
  }

  async function handleDeactivate() {
    setLoading(true);
    try {
      await deactivateTestMode();
      await checkStatus();
    } catch (error) {
      console.error('Failed to deactivate test mode:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!status?.is_active || !status.session) {
    return null;
  }

  const minutesRemaining = Math.floor(status.minutes_remaining || 0);

  return (
    <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <TestTube className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-orange-900 dark:text-orange-100">
                Test Mode Active
              </span>
              <Badge variant="outline" className="text-xs">
                {status.session.test_suite}
              </Badge>
            </div>
            <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
              All entities you create will be marked as test data
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
            <Clock className="h-3 w-3" />
            <span>{minutesRemaining} min remaining</span>
            <span className="text-muted-foreground">•</span>
            <span>{status.session.entities_marked} entities marked</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDeactivate}
          disabled={loading}
          className="text-orange-700 hover:text-orange-900 hover:bg-orange-100"
        >
          <X className="h-4 w-4 mr-1" />
          End Session
        </Button>
      </AlertDescription>
    </Alert>
  );
}
