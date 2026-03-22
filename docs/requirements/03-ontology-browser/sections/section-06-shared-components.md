Now I have all the context I need to write the section.

# Section 06: Shared Components

## Overview

This section implements three small, reusable UI components used throughout the Ontology Browser: `SourceBadge`, `ConflictBadge`, and `ClassLink`. These components live in `frontend/src/features/ontology/components/shared/` and are consumed by the tree component (section-04) and the detail panel (section-05).

## Dependencies

- **section-01-infrastructure**: Directory structure must exist (`frontend/src/features/ontology/components/shared/`)
- **Existing Shadcn/UI components**: `Badge` at `@/components/ui/badge`, `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider` at `@/components/ui/tooltip`
- **Lucide React**: `AlertTriangle` icon (already available in the project)
- **`cn()` utility**: from `@/lib/utils`

The `OntologyBrowserContext` (section-03) is used by `ClassLink` and optionally by `SourceBadge` for source filter activation. These components should accept callbacks as props rather than directly importing the context, so they can be tested in isolation and remain decoupled.

## File Paths

All files to create:

```
frontend/src/features/ontology/components/shared/SourceBadge.tsx
frontend/src/features/ontology/components/shared/SourceBadge.test.tsx
frontend/src/features/ontology/components/shared/ConflictBadge.tsx
frontend/src/features/ontology/components/shared/ConflictBadge.test.tsx
frontend/src/features/ontology/components/shared/ClassLink.tsx
frontend/src/features/ontology/components/shared/ClassLink.test.tsx
```

---

## Tests First

Write all test files before implementing the components. The testing stack is Vitest 3.0.5 + jsdom + @testing-library/react + @testing-library/jest-dom. The setup file at `src/test/setup.ts` imports `@testing-library/jest-dom`.

### SourceBadge Tests (`SourceBadge.test.tsx`)

File: `frontend/src/features/ontology/components/shared/SourceBadge.test.tsx`

Test cases to implement:

1. **Renders badge with abbreviated source name** -- Given `sourceId="abc-123"` and `sourceName="SystemCore"`, renders a badge element containing the text "SYST" (first 4 characters uppercased). If `sourceName` is not provided, derive abbreviated text from the sourceId instead.

2. **Generates consistent color from sourceId hash** -- Render with a specific `sourceId`, assert the badge element has an inline `backgroundColor` style set. The color should be an HSL value derived from hashing the sourceId string.

3. **Same sourceId always produces same color** -- Render the component twice with the same `sourceId`, assert both produce identical background color styles. This validates determinism of the hash function.

4. **Renders nothing when sourceId is null/undefined** -- Render with `sourceId={null}` or `sourceId={undefined}`. Assert the component returns null (container is empty).

5. **Clicking badge triggers source filter callback** -- Render with an `onSourceClick` callback prop. Click the badge. Assert the callback was called with the `sourceId`.

### ConflictBadge Tests (`ConflictBadge.test.tsx`)

File: `frontend/src/features/ontology/components/shared/ConflictBadge.test.tsx`

Test cases to implement:

1. **Renders AlertTriangle icon** -- Render the component and assert an SVG element is present (the Lucide AlertTriangle icon). Use `role` or `data-testid` to locate it.

2. **Shows tooltip on hover** -- Render wrapped in a `TooltipProvider`. Hover over the trigger element. Assert tooltip content appears with text "This class has conflicting definitions from multiple sources."

### ClassLink Tests (`ClassLink.test.tsx`)

File: `frontend/src/features/ontology/components/shared/ClassLink.test.tsx`

Test cases to implement:

1. **Renders class name as link text** -- Render with `classId="123"` and `className="Vehicle"`. Assert the text "Vehicle" is visible in the document.

2. **Clicking calls setSelectedClassId with correct classId** -- Render with an `onNavigate` callback prop (or `setSelectedClassId`). Click the element. Assert the callback was called with `"123"`.

3. **Has correct styling classes** -- Render and assert the element has the CSS classes `text-primary`, `underline-offset-4`, and `hover:underline` (check via className or computed class list).

---

## Implementation Details

### SourceBadge (`SourceBadge.tsx`)

**Props interface:**

```typescript
interface SourceBadgeProps {
  sourceId: string | null | undefined
  sourceName?: string
  onSourceClick?: (sourceId: string) => void
}
```

**Behavior:**

- If `sourceId` is null or undefined, return `null` (render nothing).
- Generate a background color from the `sourceId` using a simple string hash to HSL conversion. The hash function should be a basic djb2 or similar that produces a numeric hash from the string. Convert to HSL with: `hsl(hash % 360, 65%, 45%)` -- fixed saturation and lightness ensure readability against white text.
- Display an abbreviated name: take the first 3-4 characters of `sourceName` (or `sourceId` if no name provided), convert to uppercase. For example, "SystemCore" becomes "SYST".
- Render using the Shadcn `Badge` component with `variant="secondary"`. Override the background color via inline `style={{ backgroundColor: generatedColor, color: 'white' }}`.
- Attach an `onClick` handler that calls `onSourceClick(sourceId)` if the callback is provided. Add `cursor-pointer` class when clickable.

**Hash function (pure utility):**

```typescript
function hashStringToHue(str: string): number {
  /** djb2 hash, returns a hue value 0-359 */
}
```

This should be a pure function, easy to test for determinism. Keep it in the same file or extract to a small utility if preferred.

### ConflictBadge (`ConflictBadge.tsx`)

**Props interface:**

```typescript
interface ConflictBadgeProps {
  className?: string
}
```

**Behavior:**

- Render the Lucide `AlertTriangle` icon with amber/yellow coloring (`text-amber-500` or `text-yellow-500`).
- Wrap in a Shadcn `Tooltip` so hovering shows the message: "This class has conflicting definitions from multiple sources."
- The component must be wrapped in a `TooltipProvider` somewhere up the tree. The `OntologyBrowser` layout (section-03) should provide this, but for safety, the component can include its own `TooltipProvider` or document that the caller must provide one.
- Add `data-testid="conflict-badge"` for test targeting.

**Structure sketch:**

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span><AlertTriangle className="h-4 w-4 text-amber-500" /></span>
  </TooltipTrigger>
  <TooltipContent>
    This class has conflicting definitions from multiple sources.
  </TooltipContent>
</Tooltip>
```

### ClassLink (`ClassLink.tsx`)

**Props interface:**

```typescript
interface ClassLinkProps {
  classId: string
  className: string
  onNavigate?: (classId: string) => void
}
```

Note: The prop name `className` collides with the HTML `className` attribute. Use `displayName` or `label` instead if this causes issues, or handle it explicitly. A cleaner approach:

```typescript
interface ClassLinkProps {
  classId: string
  label: string  // the class name to display
  onNavigate?: (classId: string) => void
}
```

**Behavior:**

- Render a `<button>` element (not an `<a>`, since this is in-app navigation via state, not URL-based) styled to look like a link.
- Apply classes: `text-primary underline-offset-4 hover:underline cursor-pointer` plus reset classes to remove default button styling (`bg-transparent border-none p-0 font-inherit`).
- Display the `label` text as the button content.
- On click, call `onNavigate(classId)`. The consuming component (ClassHeader, ClassProperties) will wire this to `setSelectedClassId` from `OntologyBrowserContext`.

**Integration note for consumers (sections 04 and 05):**

When using `ClassLink` inside the tree or detail panel, the consumer retrieves `setSelectedClassId` from `OntologyBrowserContext` and passes it as the `onNavigate` prop:

```tsx
<ClassLink
  classId={parentClassId}
  label={parentClassName}
  onNavigate={setSelectedClassId}
/>
```

---

## Testing Notes

- All tests use `@testing-library/react`'s `render` and query utilities.
- For tooltip hover tests, use `userEvent.hover()` from `@testing-library/user-event`. The tooltip content may appear asynchronously, so use `waitFor` or `findByText`.
- The `ConflictBadge` tooltip test requires wrapping the rendered component in a `TooltipProvider` from Shadcn.
- For the SourceBadge color tests, inspect `element.style.backgroundColor` on the rendered badge element.
- No API mocking is needed for these components -- they are purely presentational with callback props.
- ConflictBadge tooltip test uses `findAllByText` instead of `findByText` because Radix renders tooltip text in both visible and aria-hidden elements.

---

## Implementation Notes

**Deviation: ClassLink uses `label` prop instead of `children`**
The plan's suggestion to rename `className` to `label` was adopted, but the component also switched from `children` to `label` for the display text. This is simpler and avoids the `className` HTML attribute collision entirely. Consumers updated: `ClassHeader.tsx`, `ClassDetail.test.tsx`, `ClassHeader.test.tsx`.

**Code Review Fix: Wired onNavigate and onSourceClick in ClassHeader**
The code review identified that `ClassLink` and `SourceBadge` in `ClassHeader` were rendered without their callback props, making them non-functional. Added `onNavigate` and `onSourceClick` props to `ClassHeaderProps` and wired `setSelectedClassId` from `OntologyBrowserContext` through `ClassDetail`.

## Test Results

- `SourceBadge.test.tsx`: 7 tests (renders, abbreviation, color hash, null handling, click callback)
- `ConflictBadge.test.tsx`: 2 tests (icon rendering, tooltip on hover)
- `ClassLink.test.tsx`: 4 tests (text rendering, click callback, styling, button element)
- All 15 component test files pass (95 total tests)