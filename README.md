# Meridian Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wenwijaya/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wenwijaya/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Meridian Courier is a chase-view flight game over a procedural valley: thread sky rings, reach rescue beacons across high ridges, or bring her home onto runway 27 at dusk. A complete arcade flight model — throttle, pitch, roll, stalls, wind gusts, fuel and airframe damage — with a lit HUD (altitude and airspeed tapes, compass, artificial horizon, throttle/fuel/airframe gauges) and synthesised engine, wind and chime audio. All art and sound are drawn and generated in code; the game runs from static files with no network request.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` through any static server — every file the game loads lives under `game/`.

## How to fly

- **Arrow keys / WASD** — pitch and roll (hold the mouse on open sky and drag to steer, too)
- **Shift / Ctrl** — throttle up / down
- **P** — pause · **M** — mute · **1 / 2 / 3** — pick a mission · **R** — fly again

## Missions

1. **Ring Run** — thread all eight sky rings over the valley before the fuel runs low.
2. **Ridge Rescue** — reach three beacons in the high valley, where the ridges bite.
3. **Dusk Landing** — depart Meridian Field, fly the circuit, and land on runway 27: slow, level, inside the markers.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `game/index.html` — the game page; `game/src/` holds one file per job (`config`, `random`, `input`, `world`, `flight`, `render`, `audio`, `shots`, `main`).
- `screenshots/` — three real renders of the game's own code (takeoff, ring pass, dusk final).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `serve.ts` — a tiny static server for local play-testing.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
