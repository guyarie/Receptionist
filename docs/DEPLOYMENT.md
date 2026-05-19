# Deployment Guide

How to run the AI Phone Receptionist on a Linux VPS or droplet with auto-start on boot.

> For the full production setup including nginx, DNS, SSL, and multi-install management, see the [Production Deployment](../README.md#production-deployment) section of the README.

## Quick bootstrap

On a fresh Ubuntu 22.04+ server, one script installs everything (Node.js 22, nginx, certbot, PM2):

```bash
bash scripts/bootstrap-server.sh
```

Then follow the printed next-steps or continue reading below.

## Service user setup

Run installs under a dedicated `receptionist` user so that file ownership stays clean and the process never runs as root.

```bash
# Create the user (if it doesn't exist)
sudo useradd --system --shell /bin/bash --create-home --home-dir /home/receptionist receptionist

# If the user already exists as a no-login system account, fix home dir and shell:
sudo usermod -d /home/receptionist -s /bin/bash receptionist
sudo mkdir -p /home/receptionist
sudo chown receptionist:receptionist /home/receptionist

# Give receptionist ownership of the install files
sudo chown -R receptionist:receptionist /path/to/Receptionist/installs
```

> Verify with `getent passwd receptionist` — the home field must not be `/nonexistent`.

## Port 443 without root

Linux blocks ports below 1024 for unprivileged processes. Two options:

**Option A — nginx (recommended for multi-install)**: Run each install on an unprivileged port (3100, 3200, …) and let nginx terminate SSL on 443. See [nginx setup](../README.md#4-nginx) in the README.

**Option B — setcap (simpler for a single install on a dedicated machine)**:
```bash
sudo setcap cap_net_bind_service=+ep $(which node)
getcap $(which node)   # verify: /usr/bin/node = cap_net_bind_service+ep
```

> `setcap` is lost if Node.js is updated via apt or npm. Re-run after any Node upgrade.

## Install PM2

```bash
sudo npm install -g pm2
```

## Start installs under the service user

```bash
sudo su - receptionist
cd /path/to/Receptionist
node manage.js start all     # or: node manage.js start <name>
pm2 save                     # persist the process list to ~/.pm2/dump.pm2
pm2 startup                  # prints a command — copy it, then exit
exit
```

Paste and run the printed command as your admin user:
```bash
# Example — exact command comes from `pm2 startup` output above
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u receptionist --hp /home/receptionist
```

Start and verify the systemd service:
```bash
sudo systemctl start pm2-receptionist
sudo systemctl status pm2-receptionist
# Should show: Active: active (running), and "Process restored" in the logs
```

## Viewing logs

```bash
# Tail live (stdout + stderr)
sudo su - receptionist -c "pm2 logs receptionist-<name>"

# Errors only
sudo su - receptionist -c "pm2 logs receptionist-<name> --err"

# Last 100 lines without following
sudo su - receptionist -c "pm2 logs receptionist-<name> --lines 100 --nostream"

# Or read log files directly
sudo tail -f /home/receptionist/.pm2/logs/receptionist-<name>-out.log
sudo tail -f /home/receptionist/.pm2/logs/receptionist-<name>-error.log
```

## Service management

```bash
# Process status
sudo su - receptionist -c "pm2 status"

# Restart one install
sudo su - receptionist -c "pm2 restart receptionist-<name>"

# The systemd unit that owns PM2 itself
sudo systemctl status pm2-receptionist
sudo systemctl restart pm2-receptionist
```

## Enabling Meta Admin on an existing server

Meta Admin is a browser-based install manager (port 3099). To enable it on a server where the main installs are already running:

**1 — Set the domain in `installs/_defaults.env`**
```env
META_ADMIN_DOMAIN=admin.phone.yourdomain.com
META_ADMIN_PASSWORD=your-secure-password
META_ADMIN_SESSION_SECRET=a-random-string
```

**2 — Point DNS** — create an A record for `admin.phone.yourdomain.com` → server IP and wait for propagation.

**3 — Deploy the updated nginx config** (now includes the meta admin block)
```bash
node manage.js nginx          # verify the meta admin block shows the right domain
sudo node manage.js deploy-nginx
```

**4 — Add SSL for the new domain**
```bash
sudo certbot --nginx -d phone.yourdomain.com -d admin.phone.yourdomain.com
```

**5 — Start meta admin under the service user and persist it**
```bash
sudo su - receptionist
cd /path/to/Receptionist
node manage.js meta-admin start
pm2 save
exit
```

**6 — Verify**
```bash
sudo su - receptionist -c "pm2 status"
# Should show both receptionist-<name> and receptionist-meta-admin as online
curl -sk https://admin.phone.yourdomain.com/
```

## Deploying updates

```bash
cd /path/to/Receptionist
git pull
npm install --production
sudo su - receptionist -c "pm2 restart all"
```

## Firewall

```bash
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp    # for certbot HTTP challenge
sudo ufw --force enable
sudo ufw status
```

## Troubleshooting

**PM2 daemon version mismatch after upgrade**
```bash
sudo su - receptionist -c "pm2 update && pm2 save && pm2 kill"
sudo systemctl restart pm2-receptionist
```

**Port 443 already in use**
```bash
sudo lsof -i :443
```

**setcap lost after Node upgrade**
```bash
sudo setcap cap_net_bind_service=+ep $(which node)
sudo su - receptionist -c "pm2 restart all"
```

**`cd ~` fails for the receptionist user**

The user's home in `/etc/passwd` is wrong (common for accounts created as system users):
```bash
getent passwd receptionist        # check the home field
sudo usermod -d /home/receptionist receptionist
sudo mkdir -p /home/receptionist
sudo chown receptionist:receptionist /home/receptionist
```

**PM2 resurrect finds nothing on reboot**

`pm2 save` was not run, or ran before all processes were started. Fix:
```bash
sudo su - receptionist -c "cd /path/to/Receptionist && node manage.js start all && pm2 save"
sudo systemctl restart pm2-receptionist
```

**Permission errors on install files**
```bash
sudo chown -R receptionist:receptionist /path/to/Receptionist/installs
```
