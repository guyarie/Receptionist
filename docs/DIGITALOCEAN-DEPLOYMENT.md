# DigitalOcean Deployment Guide

This guide walks you through deploying the AI Phone Receptionist to your DigitalOcean droplet.

## Server Information
- IP Address: `138.68.51.142`
- Domain: `phone.rtcbellevue.com` (DNS configured in Squarespace)
- OS: Ubuntu (recommended)
- SSH Access: Configured with your SSH key
- Project Location: `/home/guyarie/receptionist_prod/Receptionist`
- Service User: `receptionist`
- Port: 443 (HTTPS direct binding)

## Step 1: Install Node.js on Server

SSH into your server and install Node.js:

```bash
ssh root@138.68.51.142

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# Verify installation
node --version
npm --version

# Exit SSH session
exit
```

## Step 2: Clone Repository from GitHub

First, make sure your code is pushed to GitHub. Then on the server:

```bash
ssh root@138.68.51.142

# Clone your repository
cd /opt
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git ai-phone-receptionist

# Or if you haven't pushed to GitHub yet, we'll use scp for now
# (see Alternative Method below)

exit
```

**Alternative Method (if not using GitHub yet):**

```bash
# Create app directory on server
ssh root@138.68.51.142 "mkdir -p /opt/ai-phone-receptionist"

# Upload application files (this will take a minute)
scp -r src prompts public deployment package.json package-lock.json vitest.config.js root@138.68.51.142:/opt/ai-phone-receptionist/
```

## Step 3: Upload Environment Variables

```bash
# Copy your .env file
scp .env root@138.68.51.142:/opt/ai-phone-receptionist/.env
```

## Step 4: Upload Data Files

```bash
# Copy provider profiles and practice data
scp -r data root@138.68.51.142:/opt/ai-phone-receptionist/
```

## Step 5: Install Dependencies on Server

```bash
ssh root@138.68.51.142

cd /opt/ai-phone-receptionist

# Install npm dependencies
npm install --production

# Create necessary directories
mkdir -p call-summaries
mkdir -p examples/availability
mkdir -p examples/data

exit
```

## Step 6: Install and Start Service

```bash
ssh root@138.68.51.142

cd /opt/ai-phone-receptionist

# Run the installation script
bash deployment/install-service.sh

# Check service status
systemctl status ai-phone-receptionist

# View logs
journalctl -u ai-phone-receptionist -f
```

## Step 7: Configure Firewall

```bash
ssh root@138.68.51.142

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# Enable firewall (if not already enabled)
ufw --force enable

exit
```

## Step 8: Update Twilio Webhook URL

1. Go to your Twilio Console
2. Navigate to Phone Numbers → Active Numbers
3. Click on your phone number
4. Under "Voice & Fax", set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://phone.rtcbellevue.com/incoming-call` (or your domain)
   - **HTTP**: POST
5. Save changes

**Important:** If using a custom domain with SSL, ensure:
- Your `.env` has `PORT=443` (for direct HTTPS binding)
- SSL certificates are configured: `SSL_CERT_PATH` and `SSL_KEY_PATH`
- The systemd service has `AmbientCapabilities=CAP_NET_BIND_SERVICE` to bind to port 443

## Step 9: Test the Deployment

```bash
# Test the health endpoint
curl http://138.68.51.142:3000/

# Should return: "AI Phone Receptionist is running!"
```

Call your Twilio number to test!

## Useful Commands

### View Logs
```bash
ssh root@138.68.51.142 "journalctl -u ai-phone-receptionist -f"
```

### Restart Service
```bash
ssh root@138.68.51.142 "systemctl restart ai-phone-receptionist"
```

### Stop Service
```bash
ssh root@138.68.51.142 "systemctl stop ai-phone-receptionist"
```

### Update Application

**If using git:**
```bash
ssh root@138.68.51.142 "cd /opt/ai-phone-receptionist && git pull && npm install --production && systemctl restart ai-phone-receptionist"
```

**If using scp:**
```bash
# Upload new files
scp -r src root@138.68.51.142:/opt/ai-phone-receptionist/

# Restart service
ssh root@138.68.51.142 "systemctl restart ai-phone-receptionist"
```

## Setting Up HTTPS (Optional but Recommended)

For production, you should use HTTPS. Install Caddy (easiest) or nginx:

### Using Caddy (Recommended)

```bash
ssh root@138.68.51.142

# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy

# Create Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
receptionist.yourdomain.com {
    reverse_proxy localhost:3000
}
EOF

# Restart Caddy
systemctl restart caddy
```

Then update your Twilio webhook to use `https://receptionist.yourdomain.com/incoming-call`

## Troubleshooting

### Service won't start
```bash
# Check logs for errors
ssh root@138.68.51.142 "journalctl -u ai-phone-receptionist -n 50"

# Check if port 3000 is in use
ssh root@138.68.51.142 "lsof -i :3000"
```

### Can't connect to server
```bash
# Test SSH connection
ssh root@138.68.51.142 "echo 'Connected'"

# Check firewall
ssh root@138.68.51.142 "ufw status"
```

### Environment variables not loaded
```bash
# Verify .env file exists
ssh root@138.68.51.142 "cat /opt/ai-phone-receptionist/.env"
```
