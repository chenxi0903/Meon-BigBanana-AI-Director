# Fix API Key Sync Spec

## Why
Users reported that model API Keys are not being saved or synced correctly. Analysis revealed a bug in `loadRegistry` function in `services/modelRegistry.ts`. When built-in models are merged with stored user settings, the `apiKey` field from the user settings is explicitly ignored/overwritten by the built-in definition (which usually has no key), causing user-entered keys to be lost in memory and subsequently in storage.

## What Changes
- Modify `loadRegistry` in `services/modelRegistry.ts`:
  - When merging stored model state (`existing`) with built-in model definition (`bm`), explicitly preserve the `apiKey` field from `existing`.

## Impact
- **Affected code**: `services/modelRegistry.ts`
- **User Impact**: User-entered API keys for built-in models will now be correctly persisted across reloads and synced to the cloud.

## MODIFIED Requirements
### Requirement: Model Registry Loading
The system SHALL preserve user-configured `apiKey` when loading and merging built-in model definitions.

#### Scenario: User sets API Key for Gemini
- **WHEN** user enters an API Key for a built-in model (e.g., Gemini)
- **AND** the application reloads or syncs from cloud
- **THEN** the API Key SHALL be present in the application state
