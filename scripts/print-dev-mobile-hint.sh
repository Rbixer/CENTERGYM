#!/usr/bin/env bash
# Muestra la URL LAN para abrir la app/PWA en el móvil (misma Wi‑Fi que el PC).
set +e
PORT="${PORT:-4178}"
PRIMARY=""

# Solo rangos privados habituales (evita loopbacks raros tipo 1.0.0.127 en algunos entornos).
is_lan_ipv4() {
  case "$1" in
    192.168.* | 10.* | 172.1[6-9].* | 172.2[0-9].* | 172.3[0-1].*) return 0 ;;
    *) return 1 ;;
  esac
}

pick_lan_ip() {
  for cand in $1; do
    case "$cand" in "" | 127.* | 0.0.0.0) continue ;; esac
    if is_lan_ipv4 "$cand"; then
      echo "$cand"
      return 0
    fi
  done
  return 1
}

# Preferir la IP de la ruta por defecto (interfaz Wi‑Fi/Ethernet real). Si primero
# tomáramos la de VPN, Docker, etc., el móvil en la misma Wi‑Fi no alcanza esa IP.
if command -v ip >/dev/null 2>&1; then
  ROUTE_SRC="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{ for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit } }')"
  PRIMARY="$(pick_lan_ip "$ROUTE_SRC")"
fi

if [ -z "$PRIMARY" ] && command -v hostname >/dev/null 2>&1; then
  PRIMARY="$(pick_lan_ip "$(hostname -I 2>/dev/null)")"
fi

# Lista todas las IPv4 LAN (para copiar a ALLOWED_DEV_ORIGINS si hace falta)
ALL_LAN_CSV=""
if command -v hostname >/dev/null 2>&1; then
  for cand in $(hostname -I 2>/dev/null); do
    case "$cand" in "" | 127.* | 0.0.0.0) continue ;; esac
    if is_lan_ipv4 "$cand"; then
      if [ -n "$ALL_LAN_CSV" ]; then
        ALL_LAN_CSV="${ALL_LAN_CSV},"
      fi
      ALL_LAN_CSV="${ALL_LAN_CSV}${cand}"
    fi
  done
fi

echo ""
echo "━━━━━━━━ PWA / móvil (misma red Wi‑Fi) ━━━━━━━━"
if [ -n "$PRIMARY" ]; then
  echo "  Prueba en el móvil (misma red; datos móviles apagados, sin VPN o desactívala al probar):"
  echo "    http://${PRIMARY}:${PORT}/api/health   (debe verse JSON {\"ok\":true ...})"
  echo "  Luego la app:  http://${PRIMARY}:${PORT}"
  echo "  (usa http://, NO https://; no uses localhost en el móvil)"
  echo ""
  echo "  Si en blanco o 403 en /_next, en .env o .env.local añade y REINICIA el dev server:"
  echo "  NEXT_PUBLIC_APP_URL=\"http://${PRIMARY}:${PORT}\""
  if [ -n "$ALL_LAN_CSV" ]; then
    echo "  (opcional, si aún falla) ALLOWED_DEV_ORIGINS=\"${ALL_LAN_CSV}\""
  fi
else
  echo "  No se detectó IP LAN. En el PC ejecuta:  ip -4 route get 1.1.1.1   o   ip -4 a"
  echo "  y en el móvil abre:  http://ESA_IP:${PORT}"
fi
echo ""
echo "  No carga el health = cortafuegos o red (no el código). En Ubuntu suele ser:"
echo "    sudo ufw allow ${PORT}/tcp && sudo ufw reload"
echo "  También: Wi‑Fi de invitados con aislamiento, o móvil en otra red; revisa la IP (DHCP cambia)."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
