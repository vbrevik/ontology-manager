import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TestTube, Loader2 } from 'lucide-react';
import { activateTestMode } from '@/lib/testMode';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestModeToggleProps {
  onActivate?: () => void;
}

export function TestModeToggle({ onActivate }: TestModeToggleProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    test_suite: 'manual',
    test_run_id: '',
    justification: '',
    duration_minutes: 120,
  });

  async function handleActivate() {
    if (!formData.justification.trim()) {
      setError('Justification is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await activateTestMode({
        test_suite: formData.test_suite,
        test_run_id: formData.test_run_id || undefined,
        justification: formData.justification,
        duration_minutes: formData.duration_minutes,
      });

      setOpen(false);
      setFormData({
        test_suite: 'manual',
        test_run_id: '',
        justification: '',
        duration_minutes: 120,
      });

      onActivate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate test mode');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <TestTube className="h-4 w-4" />
          Enter Test Mode
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Activate Test Mode</DialogTitle>
          <DialogDescription>
            Enter test mode to automatically mark all entities you create as test data.
            This helps keep test data separate from production data.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="test_suite">Test Suite</Label>
            <Select
              value={formData.test_suite}
              onValueChange={(value) =>
                setFormData({ ...formData, test_suite: value })
              }
            >
              <SelectTrigger id="test_suite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Testing</SelectItem>
                <SelectItem value="e2e">E2E Testing</SelectItem>
                <SelectItem value="integration">Integration Testing</SelectItem>
                <SelectItem value="exploratory">Exploratory Testing</SelectItem>
                <SelectItem value="qa">QA Testing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test_run_id">Test Run ID (Optional)</Label>
            <Input
              id="test_run_id"
              placeholder="e.g., TEST-RUN-2026-01-18-001"
              value={formData.test_run_id}
              onChange={(e) =>
                setFormData({ ...formData, test_run_id: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Identifier to group related test data
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Select
              value={formData.duration_minutes.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, duration_minutes: parseInt(value) })
              }
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours (default)</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="480">8 hours (maximum)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justification *</Label>
            <Textarea
              id="justification"
              placeholder="e.g., Testing new project creation flow"
              value={formData.justification}
              onChange={(e) =>
                setFormData({ ...formData, justification: e.target.value })
              }
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              Required: Explain why you need test mode
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleActivate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Activate Test Mode
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
