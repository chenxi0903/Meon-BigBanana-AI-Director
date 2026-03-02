# Rename Prompts for Consistency Spec

## Why
The user reported that `buildDetailedKeyframeOptPrompt` and `buildDetailedActionSugPrompt` cannot sync with Supabase. Investigation revealed a naming mismatch: the frontend (`PromptManager.tsx`) uses these shortened IDs, but the backend logic (`prompts.ts`) and database (`sync_prompts.sql`) use the full names `buildDetailedKeyframeOptimizationPrompt` and `buildDetailedActionSuggestionPrompt`. This mismatch prevents the system from correctly identifying and syncing these specific prompts.

## What Changes
- Update `components/Settings/PromptManager.tsx` to use the full function names as IDs for the affected prompts.
- Ensure the IDs match exactly with the export names in `services/ai/prompts.ts` and the `name` column in the `prompt_templates` table in Supabase.

## Impact
- **Affected code**: `components/Settings/PromptManager.tsx`
- **User Impact**: Users will be able to see, edit, and sync these prompts correctly in the Settings panel. Previously saved user overrides for the *short* IDs (if any exist locally or in DB) might become orphaned, but since sync wasn't working, this is likely acceptable. The system will now correctly load the default system prompts.

## MODIFIED Requirements
### Requirement: Prompt ID Consistency
The frontend Prompt Manager SHALL use prompt IDs that strictly match the backend function names and database record names to ensure successful synchronization.

#### Scenario: Syncing System Prompts
- **WHEN** user clicks "Sync System Prompts"
- **THEN** the system SHALL successfully retrieve and match `buildDetailedKeyframeOptimizationPrompt` and `buildDetailedActionSuggestionPrompt` from the database.
