# Lint Fix Plan

- [x] Run linter to identify problems
- [x] Analyze lint errors
- [x] Fix identified lint issues
- [x] Verify fixes with linter

## Fix Applied

Fixed the `react-hooks/set-state-in-effect` error in `components/ActivityFeedWrapper.tsx` by removing the synchronous `setLoading(false)` call when there's no authenticated user. The component already handles this case by returning `null` when `!user`, so the loading state update was unnecessary and caused the lint error.
