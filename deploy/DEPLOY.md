# ArenaX — Deployment Guide

## Prerequisites
- Ubuntu 22.04 / 24.04 server
- Node.js >= 18 (use nvm)
- MySQL 8.0+
- Nginx
- PM2 (`npm install -g pm2`)
- Certbot (`apt install certbot python3-certbot-nginx`)

---

## 1. Server Setup

```bash
# Create app user
adduser arenaX --disabled-password
mkdir -p /var/www/arenaX /var/log/arenaX
chown -R arenaX:arenaX /var/www/arenaX /var/log/arena/
---

## 2. Database

```bash
mysql -u root -p
CREATE DATABASE esports_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'arenaX_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE, DELETE ON esports_platform.* TO 'arenaX_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema
mysql -u arenaX_user -p esports_platform < /var/www/arenaX/backend/database/arenaX_schema_mysql.sql
```

---

## 3. Backend

```bash
cd /var/www/arenaX/backend
npm install --omit=dev

# Create .env from .env.example — FILL IN ALL VALUES
cp .env.example .env
nano .env

# Required changes:
#   DB_USER=arenaX_user
#   DB_HOST=localhost
#   DB_PASSWORD=STRONG_PASSWORD_HERE
#   JWT_SECRET=$(openssl rand -hex 64)   ← run this to generate
#   ALLOWED_ORIGINS=https://yourdomain.com
#   ADMIN_EMAILS=youremail@domain.com
#   SMTP_USER / SMTP_PASS → your Gmail app password
#   HENRIKDEV_KEY / TRACKER_GG_KEY → your API keys
#   NODE_ENV is set by PM2, not .env
```

---

## 4. Frontend Build

```bash
cd /var/www/arenaX/frontend

# If backend is on a different domain, set VITE_API_URL:
# echo "VITE_API_URL=https://api.yourdomain.com/api" >> .env.production

npm install
npm run build

# dist/ is now ready to serve
```

---

## 5. Nginx

```bash
cp /var/www/arenaX/deploy/nginx.conf /etc/nginx/sites-available/arenaX
# Edit nginx.conf — replace yourdomain.com with your actual domain
nano /etc/nginx/sites-available/arenaX

ln -s /etc/nginx/sites-available/arenaX /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL via certbot
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 6. PM2

```bash
cd /var/www/arenaX/backend
# Copy the ecosystem config
cp /var/www/arenaX/deploy/ecosystem.config.cjs .

pm2 start ecosystem.config.cjs --env production
pm2 save

# Auto-start on reboot (run the generated command as root)
pm2 startup
```

---

## 7. Verify

```bash
# Check backend is running
curl http://localhost:5000/health

# Check via Nginx
curl https://yourdomain.com/health

# Check logs
pm2 logs arenaX-backend
```

---

## 8. Ongoing Maintenance

```bash
# Deploy backend update
cd /var/www/arenaX/backend && git pull && npm install --omit=dev && pm2 restart arenaX-backend

# Deploy frontend update
cd /var/www/arenaX/frontend && git pull && npm install && npm run build

# View logs
pm2 logs arenaX-backend --lines 100
tail -f /var/log/arenaX/error.log

# DB backup (add to cron)
mysqldump -u arenaX_user -p esports_platform | gzip > /backups/arenaX_$(date +%F).sql.gz
```

---

## ⚠️ Before Going Live Checklist

- [ ] Rotated ALL credentials that were in the leaked .env (C1)
- [ ] `JWT_SECRET` regenerated with `openssl rand -hex 64`
- [ ] `NODE_ENV=production` set in PM2 ecosystem config (not .env)
- [ ] `ALLOWED_ORIGINS` set to your production frontend URL only
- [ ] SSL certificate active and HTTPS working
- [ ] DB user has minimal permissions (not root)
- [ ] `profile_picture` column migration scheduled (see schema comments — H6)
- [ ] MobileLegends.png compressed to JPEG (H9/M9)
- [ ] default-avatar.jpeg replaced with SVG placeholder (M10)
- [ ] Font self-hosting implemented (H8) — currently using Google Fonts CDN as fallback
- [ ] DB backups scheduled (cron or managed DB snapshots)
- [ ] Log rotation configured for /var/log/arenaX/
