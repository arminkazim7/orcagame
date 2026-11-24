# Universal Rules for Every Agent

1. Work only on assigned files; never overwrite another agent's files.
2. Follow the lead architect's versioned interface contracts.
3. Do not create competing versions of shared systems.
4. Use the shared event bus for cross-module communication.
5. Do not hardcode state owned by another module.
6. Use original graphics and audio; no copyrighted assets.
7. Include error handling and tests.
8. Never claim tests passed unless they were executed.
9. Do not silently omit requirements.
10. Inform the lead before changing public APIs.
11. Deliver complete source files, not fragments or pseudocode.

Every handoff includes source files, public API documentation, dependencies, setup/test instructions, actual test results, known bugs/limitations, implemented requirements, and integration notes.

If a dependency is unavailable, create a documented mock interface for isolated testing, not an alternative production implementation. Lead architect has final authority over shared interfaces and integration decisions.
