# Code Review: Section 07 - Inline Editing

## High-Priority Issues

### 1. Missing toast notifications on mutation errors (CONSTRAINT VIOLATION)
useClassDetail mutations perform cache rollback but never call toast(). Users see optimistic changes silently revert with no feedback.

### 2. Dialog cannot be closed via overlay click or Escape key
`<Dialog open={open}>` without `onOpenChange` handler. Users can only close via Cancel button.

### 3. Missing Parent Class selector in CreateClassDialog
Plan specifies parent class field; implementation has none.

## Medium-Priority Issues

### 4. createProperty optimistic update missing `description` field
Temp property object missing description field.

### 5. EditableText handleSave does not handle async onSave
Plan says to track internal loading state for async saves.

### 6. EditableText loading test doesn't test disabled input
Test checks for spinner but not disabled input.

### 7. `ref={inputRef as any}` type cast
Type suppression in EditableText.

## Low-Priority Issues

### 8-10. Minor: maxLength validation message, custom trigger wrapping, ClassTree test mock minimal.
