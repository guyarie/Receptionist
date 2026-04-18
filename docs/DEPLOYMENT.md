# Deployment Guide

How to run the AI Phone Receptionist on a Linux server with auto-start on boot.

## Prerequisites

- Linux server with systemd (Ubuntu 22.04 recommended)
- Node.js 20+ installed
- A domain name with DNS pointed at your server
- SSL certificate (Let's Encrypt recommended)
- `.env` file configured (copy from `.env.example`)

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should show v20.x.x
```

## Initial Server Setup

```bash
# Clone the repo
git clone <YOUR_REPO_URL> ~/ai-phone-receptionist
cd ~/ai-phone-receptionist

# Install dependencies
npm install --production

# Copy and configure environment
cp .env.example .env
nano .env  # fill in your API keys, domain, SSL paths

# Create runtime directories
mkdir -p runtime/call-summaries runtime/agent-logs data/providers data/practice data/availability
```

### Key `.env` values for production

```env
PORT=443
PUBLIC_URL=https://your-domain.com
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
ADMIN_PASSWORD=your-secure-password
```

### Get an SSL certificate (Let's Encrypt)

```bash
sudo apt-get install certbot
sudo certbot certonly --standalone -d your-domain.com
```

## Install as a Systemd Service

The easiest way — run the provided script:

```bash
chmod +x deployment/install-service.sh
./deployment/install-service.sh
```

It auto-detects your username, project path, and Node.js location, then installs and enables the service.

**Or manually** — copy the template and edit the placeholders:

```bash
sudo cp deployment/ai-phone-receptionist.service.template \
        /etc/systemd/system/ai-phone-receptionist.service
sudo nano /etc/systemd/system/ai-phone-receptionist.service
# Replace YOUR_USERNAME and YOUR_PROJECT_PATH

sudo systemctl daemon-reload
sudo systemctl enable ai-phone-receptionist
sudo systemctl start ai-phone-receptionist
```

## Service Management

```bash
sudo systemctl status ai-phone-receptionist
sudo systemctl start ai-phone-receptionist
sudo systemctl stop ai-phone-receptionist
sudo systemctl restart ai-phone-receptionist

# View logs
sudo journalctl -u ai-phone-receptionist -f          # follow live
sudo journalctl -u ai-phone-receptionist -n 50       # last 50 lines
```

## Connect Twilio

1. Go to [Twilio Console](https://console.twilio.com/) → Phone Numbers → your number
2. Under **Voice & Fax → A Call Comes In**:
   - Type: **Webhook**
   - URL: `https://your-domain.com/incoming-call`
   - Method: **POST**
3. Save

## Deploying Updates

```bash
# On the server
cd ~/ai-phone-receptionist
git pull
npm install --production
sudo systemctl restart ai-phone-receptionist
sudo systemctl status ai-phone-receptionist
```

## Firewall

```bash
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

## Troubleshooting

**Service won't start**
```bash
sudo journalctl -u ai-phone-receptionist -n 100
```
Common causes: missing `.env`, invalid SSL paths, port 443 already in use.

**Port 443 in use**
```bash
sudo lsof -i :443
```

**Permission errors**
```bash
sudo chown -R receptionist:receptionist ~/ai-phone-receptionist
sudo chmod -R 755 ~/ai-phone-receptionist
chmod 600 ~/ai-phone-receptionist/.env
```

**Git pull fails (local changes on server)**
```bash
git stash && git pull && git stash pop
```

## Backup

```bash
# Call summaries
cp -r runtime/call-summaries ~/backup/

# Configuration and data
cp .env ~/backup/.env.production
cp -r data ~/backup/
```

## Alternative: PM2

If you prefer PM2 over systemd:

```bash
npm install -g pm2
pm2 start src/server.js --name ai-phone-receptionist
pm2 save
pm2 startup
```

## Security Notes

- Run the service as a non-root user (`receptionist` user created by the install script)
- `AmbientCapabilities=CAP_NET_BIND_SERVICE` lets it bind to port 443 without root
- Only `runtime/` and `data/` are writable by the service process
- All traffic is encrypted via SSL
