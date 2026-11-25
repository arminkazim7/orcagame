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

## Enemy and collectible field guide

### Regular enemies

| Enemy | Visual design | Behavior | Contact damage |
|---|---|---|---|
| Walker | Rounded purple armored body, eyes and orange feet | Ground patrol; turns at platform boundaries | **Yes**; a successful downward stomp defeats it |
| Flyer | Pink diamond body with wing accents and eyes | Flying patrol with hover motion | **Yes**; can be stomped from above |
| Shooter | Green armored body with raised cannon and muzzle | Ground patrol; fires green projectiles when player is within range | **Yes**, plus projectile damage |

### Bosses

| Boss | World | Visual shape / attack |
|---|---:|---|
| Coral Warden | 1 — Coral Cove | Brute form; fireball attacks |
| Kelp Guardian | 2 — Kelp Forest | Crystal form; shard attacks |
| Ice Leviathan | 3 — Arctic Depths | Serpent form; charging attacks |
| Ruin Colossus | 4 — Sunken Ruins | Warden form; radial attacks and minions |
| Abyss Emperor | 5 — Abyssal Reach | Sovereign form; teleporting barrages |

### Collectibles and power-ups

| Item | Distinct design | Effect |
|---|---|---|
| Sea Berry | Pink berry silhouette with green leaf and shine | Enlarges player; absorbs one hit |
| Golden Krill | Gold angular krill badge | Enlarges player and boosts jump; absorbs one hit |
| Bubble Shell | Cyan shell/bubble with ribs and highlight | Standard size; absorbs one hit |
| Bonus Life | Yellow diamond with plus | Adds one life |
| Checkpoint | White ring with teal center marker | Sets recovery checkpoint |

Collectibles use unique silhouettes rather than a shared generic circle. Regular enemies have separate silhouettes and detailing. All regular enemies are damaging on contact, except a successful downward stomp defeats them instead of hurting the player.
