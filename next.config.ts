import type { NextConfig } from "next";
import os from "os";

/** Orígenes permitidos en desarrollo cuando entras desde la IP local (móvil en la misma Wi‑Fi). */
function localIPv4Hosts(): string[] {
  const out = new Set<string>();
  for (const list of Object.values(os.networkInterfaces())) {
    if (!list) continue;
    for (const n of list) {
      const fam = n.family as string | number;
      const v4 = fam === "IPv4" || fam === 4;
      if (!v4 || n.internal) continue;
      if (n.address) out.add(n.address);
    }
  }
  return [...out];
}

const fromEnv = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Evita 403 en /_next/* al abrir http://TU_IP:4178 desde el teléfono (misma red).
  allowedDevOrigins: [
    ...localIPv4Hosts(),
    ...fromEnv,
    "10.0.2.2", // emulador Android → máquina anfitriona
  ],
};

export default nextConfig;
