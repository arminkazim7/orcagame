# Orca Adventure

A browser-based underwater platform game built with HTML5 Canvas and JavaScript ES modules.

## Play locally

Requires Python 3 and Node.js 20+.

From the repository root, start a local server:

```bash
py -m http.server 8000        # Windows
python3 -m http.server 8000   # macOS / Linux
```

Open [http://localhost:8000/demo/orca-adventure.html](http://localhost:8000/demo/orca-adventure.html). Keep the server running while playing; ES modules should not be opened through `file://`.

## Develop and verify

The integrated application package and its scripts are in `src/`:

```bash
cd src
npm test
npm run check
npm run build
```

The tests live in the repository-level `tests/` directory. The build produces `dist/orca-adventure.html` (under `src/`) and CI uploads it as an artifact. Browser playtesting remains a separate acceptance requirement; passing unit tests is not proof of visual/gameplay acceptance.

## Repository guide

- `src/` — integrated game runtime and production source
- `tests/` — automated tests for the integrated project
- `demo/` — browser entry points and demos
- `docs/` — current public module/API documentation
- `architecture/` — shared contracts and integration status
- `agents/` — original specialist work briefs, retained as historical planning material
- `project/` — project-wide rules and acceptance checklist

The `src/AGENT_*_HANDOFF.md` files are historical specialist handoffs, not authoritative current status. Use `architecture/INTEGRATION_STATUS.md`, the source code, and the latest CI run for current integration state. Keep documentation changes aligned with implementation and tests.
