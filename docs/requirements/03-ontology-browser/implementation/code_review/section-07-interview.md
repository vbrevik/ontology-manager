# Code Review Interview: Section 07 - Inline Editing

**Date:** 2026-03-22T15:56:00+01:00

## Interview Items

### Issue 3: Missing Parent Class selector in CreateClassDialog
- **Decision:** Add now
- **Action:** FIX — Add parent class Select populated from classes list query

## Auto-fixes
- Issue 1: Add toast notifications to useClassDetail mutation onError handlers
- Issue 2: Add onOpenChange to Dialog in CreateClassDialog
- Issue 4: Add description field to createProperty optimistic temp object
- Issue 5: Add async save handling to EditableText (await onSave, internal loading)
- Issue 7: Fix ref typing in EditableText (separate refs for Input/Textarea)

## Let go
- Issues 8-10: Minor improvements, not worth the churn
- Issue 6: EditableText loading test is testing the correct behavior (static display with spinner when loading, not disabled input)
