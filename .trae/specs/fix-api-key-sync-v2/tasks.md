# Tasks

- [x] Task 1: Fix `loadRegistry` function in `services/modelRegistry.ts` to preserve API keys for built-in models.
  - [ ] Update merge logic to include `apiKey` from `existing` model state.
  - [ ] Ensure `providerId` and other user-configurable fields are preserved if necessary.
- [x] Task 2: Verify the fix.
  - [ ] Check if `apiKey` is correctly loaded from `localStorage` after reloading the application.
  - [ ] Verify that `syncSettingsToCloud` sends the correct data with API keys.

# Task Dependencies
- Task 2 depends on Task 1.
