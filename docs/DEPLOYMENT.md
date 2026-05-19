# Deployment Guide

How to run the AI Phone Receptionist on a Linux VPS or droplet with auto-start on boot.

> For the full production setup including nginx, DNS, SSL, and multi-install management, see the [Production Deployment](../README.md#production-deployment) section of the README.

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
