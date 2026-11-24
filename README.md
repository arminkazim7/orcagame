# Orca Adventure — Multi-Agent Development Pack

This package divides the game into independent specialist assignments. Give Agent 0 to the lead architect first. Once the shared interfaces are frozen, assign Agents 1–8 to separate coding agents. Agent 9 independently tests the integrated result.

## Recommended workflow
1. Lead architect defines and versions shared interfaces.
2. Engine, audio, and save schema work can start once the initial contracts are published.
3. Player, worlds, enemies, progression, and UI agents work in parallel against those contracts.
4. Lead integrates modules and resolves incompatibilities.
5. QA runs the acceptance checklist; specialists fix defects in their own files.
6. Build `dist/orca-adventure.html` as one self-contained HTML file and test opening it directly.

See `agents/` for copy-ready prompts, `architecture/` for shared contracts and handoff templates, and `project/` for project structure and acceptance criteria.
