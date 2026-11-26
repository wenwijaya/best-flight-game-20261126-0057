// Meridian Courier — the hand-in program (Node 22, standard library only).
// It copies the playable game and its screenshots into the grader's output
// directory and writes the dossier the judge reads, using the kit's vendored
// make.fun library. It runs twice and must write the same bytes both times,
// so it does nothing time-dependent: a plain copy plus a deterministic build.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else cpSync(src, dst);
  }
}

function handIn() {
  mkdirSync(outDir, { recursive: true });
  // The game: plain static files, no build step, no network request.
  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  // The screenshots: real renders of the game's own code, first by name
  // is the cover. An absent screenshots/ folder is tolerated here so the
  // program stays runnable during development; the gate requires 3-4.
  const shots = join(repoRoot, 'screenshots');
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shots)) copyTree(shots, join(outDir, 'screenshots'));

  // The dossier, byte for byte what the vendored library writes from the
  // files above. Caps are the gate's own: 160 KiB of source text, at most
  // 4 screenshots of 256 KiB, game/ within 993 files and 48 MiB.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
