# DigitalOcean Deployment Guide

This guide walks you through deploying the AI Phone Receptionist to your DigitalOcean droplet.

## Server Information
- **IP Address**: `138.68.51.142`
- **Domain**: `phone.rtcbellevue.com` (DNS configured in Squarespace)
- **OS**: Ubuntu 22.04
- **SSH User**: `guyarie`
- **Service User**: `receptionist` (runs the Node.js process)
- **Project Location**: `/home/guyarie/receptionist_prod/Receptionist`
- **Port**: 443 (HTTPS with SSL certificates)
- **Node.js Version**: v20.20.0

## Prerequisites

Before deploying, ensure you have:
- SSH access to the droplet (`ssh guyarie@138.68.51.142`)
- Your code pushed to a git repository
- SSL certificates configured on the server
- `.env` file with `PORT=443`, `SSL_CERT_PATH`, and `SSL_KEY_PATH` configured

## Initial Server Setup (One-Time)

If this is your first deployment, follow these steps:

### 1. Install Node.js

```bash
ssh guyarie@138.68.51.142

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs git

# Verify installation
node --version  # Should show v20.20.0 or similar
npm --version

exit
```

### 2. Clone Repository

```bash
ssh guyarie@138.68.51.142

# Create project directory
mkdir -p ~/receptionist_prod
cd ~/receptionist_prod

# Clone your repository
git clone <YOUR_REPO_URL> Receptionist

# Or if already cloned, just pull latest
cd Receptionist
git pull

exit
```

### 3. Upload Environment Variables

```bash
# Copy your .env file from local machine
scp .env guyarie@138.68.51.142:~/receptionist_prod/Receptionist/.env
```

Make sure your `.env` includes:
```
PORT=443
SSL_CERT_PATH=/path/to/your/cert.pem
SSL_KEY_PATH=/path/to/your/key.pem
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number
OPENROUTER_API_KEY=your_openrouter_key
OPENAI_API_KEY=your_openai_key
```

### 4. Upload Data Files (If Not in Git)

```bash
# Copy provider profiles and practice data
scp -r data/* guyarie@138.68.51.142:~/receptionist_prod/Receptionist/data/
```

### 5. Install Dependencies

```bash
ssh guyarie@138.68.51.142

cd ~/receptionist_prod/Receptionist

# Install npm dependencies
npm install --production

# Create necessary directories
mkdir -p call-summaries
mkdir -p data/providers
mkdir -p data/practice
mkdir -p data/availability

exit
```

### 6. Install Systemd Service

```bash
ssh guyarie@138.68.51.142

cd ~/receptionist_prod/Receptionist

# Run the installation script
bash deployment/install-service.sh

# The script will:
# - Create the 'receptionist' user if it doesn't exist
# - Set proper file permissions
# - Install the systemd service
# - Enable auto-start on boot

exit
```

### 7. Start the Service

```bash
ssh guyarie@138.68.51.142

# Start the service
sudo systemctl start ai-phone-receptionist

# Check status
sudo systemctl status ai-phone-receptionist

# View logs
sudo journalctl -u ai-phone-receptionist -f

exit
```

### 8. Configure Firewall

```bash
ssh guyarie@138.68.51.142

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall (if not already enabled)
sudo ufw --force enable

# Check firewall status
sudo ufw status

exit
```

### 9. Update Twilio Webhook URL

1. Go to your [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Active Numbers**
3. Click on your phone number
4. Under **Voice & Fax**, set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://phone.rtcbellevue.com/incoming-call`
   - **HTTP**: POST
5. Save changes

### 10. Test the Deployment

```bash
# Test the health endpoint
curl https://phone.rtcbellevue.com/

# Should return: "AI Phone Receptionist is running!"
```

Call your Twilio number to test the voice interaction!

## Deploying Updates

Once the initial setup is complete, deploying updates is simple:

### Option 1: Use the Deployment Script (Recommended)

From your local machine:

```bash
# Make sure your changes are committed and pushed to git
git push

# Run the deployment script
bash deployment/deploy-to-digitalocean.sh
```

The script will:
1. SSH into the server
2. Pull latest changes from git
3. Install/update dependencies
4. Restart the service
5. Show service status

### Option 2: Manual Deployment

```bash
ssh guyarie@138.68.51.142

cd ~/receptionist_prod/Receptionist

# Pull latest changes
git pull

# Install/update dependencies
npm install --production

# Restart service
sudo systemctl restart ai-phone-receptionist

# Check status
sudo systemctl status ai-phone-receptionist

exit
```

## Useful Commands

### View Real-Time Logs
```bash
ssh guyarie@138.68.51.142 "sudo journalctl -u ai-phone-receptionist -f"
```

### View Recent Logs (Last 50 Lines)
```bash
ssh guyarie@138.68.51.142 "sudo journalctl -u ai-phone-receptionist -n 50"
```

### Check Service Status
```bash
ssh guyarie@138.68.51.142 "sudo systemctl status ai-phone-receptionist"
```

### Restart Service
```bash
ssh guyarie@138.68.51.142 "sudo systemctl restart ai-phone-receptionist"
```

### Stop Service
```bash
ssh guyarie@138.68.51.142 "sudo systemctl stop ai-phone-receptionist"
```

### Start Service
```bash
ssh guyarie@138.68.51.142 "sudo systemctl start ai-phone-receptionist"
```

### Reload Prompts Without Restart
```bash
curl https://phone.rtcbellevue.com/reload-prompts
```

### View Call Summaries
```bash
# In browser
https://phone.rtcbellevue.com/call-summaries

# Or via SSH
ssh guyarie@138.68.51.142 "ls -lh ~/receptionist_prod/Receptionist/call-summaries/"
```

## Troubleshooting

### Service Won't Start

Check the logs for errors:
```bash
ssh guyarie@138.68.51.142 "sudo journalctl -u ai-phone-receptionist -n 100"
```

Common issues:
- Missing `.env` file
- Invalid SSL certificate paths
- Port 443 already in use
- Missing environment variables

### Port 443 Already in Use

Check what's using port 443:
```bash
ssh guyarie@138.68.51.142 "sudo lsof -i :443"
```

### Permission Errors

Ensure the `receptionist` user has proper permissions:
```bash
ssh guyarie@138.68.51.142

cd ~/receptionist_prod/Receptionist
sudo chown -R receptionist:receptionist .
sudo chmod -R 755 .

exit
```

### SSL Certificate Issues

Verify your SSL certificate paths in `.env`:
```bash
ssh guyarie@138.68.51.142 "cat ~/receptionist_prod/Receptionist/.env | grep SSL"
```

Make sure the files exist and are readable:
```bash
ssh guyarie@138.68.51.142 "ls -l /path/to/your/cert.pem /path/to/your/key.pem"
```

### Can't Connect to Server

Test SSH connection:
```bash
ssh guyarie@138.68.51.142 "echo 'Connected'"
```

Check firewall:
```bash
ssh guyarie@138.68.51.142 "sudo ufw status"
```

### Environment Variables Not Loaded

Verify `.env` file exists and has correct values:
```bash
ssh guyarie@138.68.51.142 "cat ~/receptionist_prod/Receptionist/.env"
```

### Git Pull Fails

If you have local changes on the server:
```bash
ssh guyarie@138.68.51.142

cd ~/receptionist_prod/Receptionist

# Stash local changes
git stash

# Pull latest
git pull

# Reapply local changes if needed
git stash pop

exit
```

## Monitoring

### Check Service Health
```bash
# Health check endpoint
curl https://phone.rtcbellevue.com/

# Model info
curl https://phone.rtcbellevue.com/api/model-info
```

### Monitor System Resources
```bash
ssh guyarie@138.68.51.142

# Check CPU and memory usage
top

# Check disk space
df -h

# Check service memory usage
sudo systemctl status ai-phone-receptionist

exit
```

### View Active Connections
```bash
ssh guyarie@138.68.51.142 "sudo netstat -tulpn | grep :443"
```

## Security Notes

- The service runs as the `receptionist` user (not root) for security
- `AmbientCapabilities=CAP_NET_BIND_SERVICE` allows binding to port 443 without root
- Security hardening enabled: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`, `ProtectHome`
- Only `call-summaries` and `data` directories are writable by the service
- SSL/TLS encryption for all HTTPS traffic
- Firewall configured to only allow necessary ports

## Backup Recommendations

### Backup Call Summaries
```bash
# Download call summaries to local machine
scp -r guyarie@138.68.51.142:~/receptionist_prod/Receptionist/call-summaries ./backup/
```

### Backup Data Files
```bash
# Download data files to local machine
scp -r guyarie@138.68.51.142:~/receptionist_prod/Receptionist/data ./backup/
```

### Backup Environment Variables
```bash
# Download .env file to local machine
scp guyarie@138.68.51.142:~/receptionist_prod/Receptionist/.env ./backup/.env.production
```

## Additional Resources

- [Twilio Console](https://console.twilio.com/)
- [OpenRouter Dashboard](https://openrouter.ai/)
- [Systemd Service Documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- Project Documentation: `docs/` directory
