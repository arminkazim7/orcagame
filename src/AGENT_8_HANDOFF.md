# Agent 8 Handoff — Save and Load

**Owned area:** `src/save/`

## Delivered

- `src/save/SaveManager.js`
- `src/save/index.js`
- `docs/SAVE_API.md`
- `tests/save.test.mjs`
- `test-scene/index.html`
- `README.md`

## Runtime integration

Create one `SaveManager` with the live Agent 5 managers and Agent 2 player. Supply the profile object and game-specific state callbacks. Save uses manager `serialize()` methods; load uses `deserialize()` methods. The `gameplayState` callbacks extend the save to include scene/world state owned by other agents.

The browser UI should call `saveManager.downloadSave()` for manual export and `saveManager.pickAndLoadSave()` for manual import. The returned load result must be checked; only show a successful-load state when `loaded === true`.

## Safety behavior

Validation precedes mutation. Unknown versions, malformed JSON, invalid IDs, impossible level/record/Gold/boss combinations, invalid score milestones, and invalid power-up state are rejected. Manager application errors trigger best-effort rollback. The module does not use local storage.

## Test command

```bash
npm test
```

The test suite covers round-trip JSON, File-like loading, malformed JSON, incompatible versions, unknown IDs, progression consistency, score/power-up invariants, and rejection without mutation.

## Integration boundary

This is a standalone module and isolated harness. It has not been merged into the assembled game runtime because the complete application shell and its UI wiring are not present in this agent workspace.
