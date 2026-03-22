# Code Review Interview: Section 01

## Auto-fixes Applied
- Changed `prebuild` script from `npm run clean` to `pnpm run clean` for consistency in a pnpm workspace

## Let Go
- .npmrc file omission — plan-level gap, not critical for local workspace
- Root engines field — plan-level gap, core package has it
- Test title change (symlinked → linked) — cosmetic, justified by pnpm behavior
