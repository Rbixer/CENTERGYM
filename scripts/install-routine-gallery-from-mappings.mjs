#!/usr/bin/env node
/**
 * Copia imágenes de galería de rutinas a public/images/routines/gallery/
 * (routine-gallery-01…27), en orden fijo. Origen por defecto: ~/Descargas/gym
 * Uso: node scripts/install-routine-gallery-from-mappings.mjs [carpeta_origen]
 */
import { mkdir, copyFile, unlink } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "images", "routines", "gallery");
const defaultSrc = path.join(homedir(), "Descargas", "gym");
const srcDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultSrc;

/** Cada ruta: nombre bajo `srcDir` (índice 0 → routine-gallery-01). */
const MAPPING = [
  "_.gif",
  "_ (1).gif",
  "_ (2).gif",
  "_ (3).jpeg",
  "_ (3).gif",
  "_ (4).gif",
  "_ (4).jpeg",
  "_ (5).gif",
  "_ (6).gif",
  "_ (7).gif",
  "_ (8).gif",
  "_ (9).gif",
  "_ (10).gif",
  "_ (11).gif",
  "_ (12).gif",
  "_ (13).gif",
  "_ (14).gif",
  "Cable Crossover Triceps Extension _ Form, Tips, Benefits.gif",
  "Dumbbell Lying Rear Lateral Raise » Fitness Programer.gif",
  "Dumbbell Seated Shoulder Press Parallel Grip_ ilustración de stock 419477194 _ Shutterstock.jpeg",
  "f15216ce06438b9ee776941c4f74dc6e.gif",
  "https___fitnessprogramer_com_wp-content_uploads_2021_09_Standing-Cable-Crunch.gif",
  "https___menspower_nl_wp-content_uploads_2018_04_leg-extension.gif",
  "Lying Chest Press Machine_ A Step-by-Step Tutorial.gif",
  "Elevaciones Laterales Agarre Cerrado con Barra Z.gif",
  "Manual Treadmill » Fitness Programer.gif",
  "Stationary Bike Workout Guide For Cardio And Strength.gif",
];

function destNameForIndex(i, fromName) {
  const base = `routine-gallery-${String(i + 1).padStart(2, "0")}`;
  if (/\.(jpe?g|jpeg)$/i.test(fromName)) {
    return `${base}.jpeg`;
  }
  return `${base}.gif`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (let i = 0; i < MAPPING.length; i++) {
    const fromName = MAPPING[i];
    const from = path.join(srcDir, fromName);
    const to = path.join(outDir, destNameForIndex(i, fromName));
    await copyFile(from, to);
    console.log(`${path.basename(to)}  ←  ${fromName}`);
  }
  for (const n of [28, 29, 30, 31]) {
    const s = `routine-gallery-${n}`;
    for (const ex of [".gif", ".jpeg", ".jpg"]) {
      const p = path.join(outDir, s + ex);
      await unlink(p).catch(() => {});
    }
  }
  const onDisk = await readdir(outDir);
  for (const name of onDisk) {
    const m = name.match(/^routine-gallery-(\d{2,})\./);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n > 27) {
      await unlink(path.join(outDir, name)).catch(() => {});
    }
  }
  console.log(`\nListo. Destino: ${outDir} (${MAPPING.length} archivos).`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
