import type { NextConfig } from "next";
import os from "os";

/**
 * Hostnames (IPv4 / IPv6 sin zona) de todas las interfaces no internas.
 * Next 15+ bloquea `/_next` en dev si el `Origin` / host no coinciden con `allowedDevOrigins`.
 * Incluir IPv6 evita 403 al abrir `http://[2001:…]:4178` o redes solo‑IPv6.
 */
function localAllExternalInterfaceHosts(): string[] {
  const out = new Set<string>();
  for (const list of Object.values(os.networkInterfaces())) {
    if (!list) continue;
    for (const n of list) {
      if (n.internal) continue;
      const fam = n.family as string | number;
      const is4 = fam === "IPv4" || fam === 4;
      const is6 = fam === "IPv6" || fam === 6;
      if (!n.address) continue;
      if (is4) {
        out.add(n.address);
      } else if (is6) {
        out.add(n.address.split("%")[0]!.toLowerCase());
      }
    }
  }
  return [...out];
}

/** Hostnames extra: mDNS (.local), nombre del equipo, loopback (Next bloquea /_next si el host no coincide). */
function extraAllowedDevHosts(): string[] {
  const out = new Set<string>(["127.0.0.1", "*.local"]);
  const h = os.hostname()?.trim().toLowerCase();
  if (h && h !== "localhost") {
    out.add(h);
    out.add(`${h}.local`);
  }
  return [...out];
}

const fromEnv = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  /** Prisma + SQLite deben ejecutarse desde Node; si no, Turbopack puede romper el cliente y fallar ventas. */
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Evita 403 en /_next/* al abrir http://TU_IP:4178 desde el teléfono (misma red).
  allowedDevOrigins: [
    ...localAllExternalInterfaceHosts(),
    ...extraAllowedDevHosts(),
    ...fromEnv,
    "10.0.2.2", // emulador Android → máquina anfitriona
  ],
};

export default nextConfig;
