/**
 * Libera el puerto 4178 (SIGTERM → breve espera → SIGKILL) para evitar
 * EADDRINUSE y procesos next-server colgados que dejan el navegador cargando sin fin.
 */
const { execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

function pidsFromLsof() {
  try {
    const out = execFileSync("lsof", ["-ti", ":4178"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return [...new Set(out.trim().split(/\s+/).filter(Boolean))];
  } catch {
    return [];
  }
}

function killPid(pid, sig) {
  try {
    process.kill(parseInt(pid, 10), sig);
  } catch {
    /* proceso ya terminó o no es nuestro */
  }
}

async function main() {
  for (const pid of pidsFromLsof()) {
    killPid(pid, "SIGTERM");
  }
  await delay(500);
  for (const pid of pidsFromLsof()) {
    killPid(pid, "SIGKILL");
  }
  await delay(800);

  try {
    execFileSync("fuser", ["-k", "-9", "4178/tcp"], {
      stdio: "ignore",
    });
  } catch {
    /* fuser ausente o nadie en el puerto */
  }
  await delay(300);
}

main().catch(() => {});
