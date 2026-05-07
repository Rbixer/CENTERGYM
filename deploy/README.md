# Despliegue en DigitalOcean (Ubuntu)

## 1. Servidor

- Droplet Ubuntu 22.04/24.04, al menos **1 GB RAM** (2 GB recomendado para `npm run build`).
- Instala Node.js **LTS** (20 o 22): [NodeSource](https://github.com/nodesource/distributions) o `nvm`.

## 2. Código y build

```bash
sudo mkdir -p /var/www/gymcenter_app
sudo chown "$USER":"$USER" /var/www/gymcenter_app
cd /var/www/gymcenter_app
git clone <tu-repo> .
cp .env.example .env
nano .env   # DATABASE_URL absoluto, ADMIN_*, NEXT_PUBLIC_APP_URL=https://tu-dominio
npm ci
npx prisma db push
npm run build
sudo chown -R www-data:www-data /var/www/gymcenter_app
```

`DATABASE_URL` en producción debe ser una ruta **absoluta** estable, por ejemplo:

`file:/var/www/gymcenter_app/prisma/production.db?busy_timeout=10000`

## 3. systemd

```bash
sudo cp deploy/gymcenter.service /etc/systemd/system/gymcenter.service
sudo nano /etc/systemd/system/gymcenter.service   # User, WorkingDirectory si difieren
sudo systemctl daemon-reload
sudo systemctl enable --now gymcenter
sudo systemctl status gymcenter
```

## 4. Nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-gymcenter.conf /etc/nginx/sites-available/gymcenter
sudo nano /etc/nginx/sites-available/gymcenter   # server_name
sudo ln -sf /etc/nginx/sites-available/gymcenter /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tu-dominio.com
```

Activa el bloque `listen 443` del archivo de ejemplo y la redirección HTTP→HTTPS cuando Certbot termine (o deja que Certbot modifique la config).

## 5. PWA en producción

Define `NEXT_PUBLIC_APP_URL=https://tu-dominio.com` para metadatos, Open Graph y enlaces absolutos. Las cookies de admin requieren **HTTPS** (`secure` en producción).

Tras cada despliegue, como usuario `www-data` (NO como root, para no dejar archivos con dueño incorrecto en `.next/`):

```bash
cd /var/www/gymcenter_app
sudo -u www-data git pull
sudo -u www-data npm ci
sudo -u www-data npx prisma generate
sudo -u www-data npx prisma db push --accept-data-loss   # solo si hubo cambios de schema
# Forzar build limpio + heap ampliado: ver nota de RAM más abajo
sudo rm -rf .next
sudo -u www-data NODE_OPTIONS="--max-old-space-size=1536" npm run build
sudo systemctl restart gymcenter
```

## 6. Notas operativas (lecciones del despliegue real)

- **RAM**: aunque DigitalOcean reporte 1 GB, el droplet por defecto tiene ~458 MB de RAM real (el resto es overhead del kernel/agente). El build de Next.js con TypeScript checking se queda **sin heap** y muere con `JavaScript heap out of memory`. Soluciones (cualquiera vale):
  - Build con heap ampliado vía swap: `NODE_OPTIONS="--max-old-space-size=1536" npm run build` (asegúrate de que `swapon --show` reporte ≥ 1 GB de swap).
  - O escala el droplet a 2 GB (recomendado a largo plazo).
- **Permisos de `.next/` y caché npm**:
  - El servicio corre como `www-data`, así que **todo el árbol** debe ser de `www-data:www-data`. Si en algún momento corriste un build como `root`, el `.next/` quedará con archivos de root y un build posterior como `www-data` fallará con `EACCES: permission denied, unlink ...`.
  - Arregla con: `sudo chown -R www-data:www-data /var/www/gymcenter_app /var/www/.npm`.
  - El cache global de npm vive en `/var/www/.npm` (HOME de www-data). Si no existe o es de root: `sudo mkdir -p /var/www/.npm && sudo chown -R www-data:www-data /var/www/.npm`.
- **El servicio queda caído mientras se hace el build** (porque `.next/` se borra al inicio). Si quieres minimizar downtime, deja el `.next` viejo, haz el build en `.next-new/` y muévelo al final, o simplemente avisa antes de desplegar.
- **Errores `Failed to find Server Action "x"` en `journalctl -u gymcenter`** son benignos: vienen de clientes con bundle JavaScript viejo (PWA instalada / pestañas abiertas). Desaparecen cuando los usuarios recargan tras el deploy.

