# Systemd Setup Guide

This guide explains how to configure the AI Phone Receptionist to start automatically on boot using systemd on Linux.

## Prerequisites

- Linux system with systemd (Ubuntu, Debian, CentOS, etc.)
- Node.js and npm installed (see installation steps below)
- Cloudflare Tunnel installed (for exposing server to Twilio webhooks)
- Project deployed to a permanent location (e.g., `/opt/ai-phone-receptionist` or `/home/user/ai-phone-receptionist`)
- `.env` file configured with your credentials

## Step 0: Install Node.js and Cloudflare Tunnel

### Install Node.js 20 LTS (Recommended)

The default `apt install nodejs` often installs an outdated version. Use NodeSource for the latest LTS:

```bash
# Download and run the NodeSource setup script for Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js and npm
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x or higher
```

**Alternative: Install Node.js 22 (Latest Stable)**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**For other Linux distributions:**
- **RHEL/CentOS/Fedora**: Replace `apt-get` with `yum` or `dnf`
- **Arch Linux**: `sudo pacman -S nodejs npm`

### Install Cloudflare Tunnel

Cloudflare Tunnel exposes your local server to the internet so Twilio can send webhook requests.

**Option 1: Install via Package Manager (Recommended)**

```bash
# Add Cloudflare GPG key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# Add Cloudflare repository
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Update and install
sudo apt-get update
sudo apt-get install cloudflared

# Verify installation
cloudflared --version
```

**Option 2: Download Binary Directly**

```bash
# Download the latest cloudflared binary
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

# Make it executable
chmod +x cloudflared-linux-amd64

# Move to system path
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Verify installation
cloudflared --version
```

**Start Cloudflare Tunnel (for testing)**

```bash
# Run tunnel pointing to your local server
cloudflared tunnel --url http://localhost:3000
```

This will output a public URL (e.g., `https://random-name.trycloudflare.com`) that you can use for Twilio webhooks.

**Note**: For production, consider setting up a named Cloudflare Tunnel with authentication. See [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) for details.

## Quick Setup (Automated)

The easiest way to set up the systemd service is using the provided installation script:

```bash
cd /path/to/ai-phone-receptionist

# Make scripts executable
chmod +x deployment/start.sh deployment/install-service.sh

# Run the installation script
./deployment/install-service.sh
```

The script will:
- Auto-detect your username and project path
- Find the Node.js installation path
- Create the systemd service file with correct paths
- Install and enable the service
- Show you the next steps

After running the script, start the service:

```bash
sudo systemctl start ai-phone-receptionist
```

## Manual Setup (Alternative)

If you prefer to set up manually or need to customize the service:

### Step 1: Make the Startup Script Executable

```bash
cd /path/to/ai-phone-receptionist
chmod +x deployment/start.sh
```

### Step 2: Create Service File from Template

A template service file is provided at `deployment/ai-phone-receptionist.service.template`. Copy and customize it:

```bash
# Copy the template
sudo cp deployment/ai-phone-receptionist.service.template /etc/systemd/system/ai-phone-receptionist.service

# Edit the service file
sudo nano /etc/systemd/system/ai-phone-receptionist.service
```

Replace these placeholders:
- **YOUR_USERNAME**: Your Linux username (e.g., `ubuntu`, `admin`)
- **YOUR_PROJECT_PATH**: Full path to project (e.g., `/home/ubuntu/ai-phone-receptionist`)

### Step 3: Reload Systemd and Enable the Service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable ai-phone-receptionist

# Start the service
sudo systemctl start ai-phone-receptionist
```

## Managing the Service

### Check Service Status

```bash
sudo systemctl status ai-phone-receptionist
```

### View Logs

View recent logs:

```bash
sudo journalctl -u ai-phone-receptionist -n 50
```

Follow logs in real-time:

```bash
sudo journalctl -u ai-phone-receptionist -f
```

### Stop the Service

```bash
sudo systemctl stop ai-phone-receptionist
```

### Restart the Service

```bash
sudo systemctl restart ai-phone-receptionist
```

### Disable Auto-Start on Boot

```bash
sudo systemctl disable ai-phone-receptionist
```

## Troubleshooting

### Service Fails to Start

1. Check the service status for error messages:
   ```bash
   sudo systemctl status ai-phone-receptionist
   ```

2. View detailed logs:
   ```bash
   sudo journalctl -u ai-phone-receptionist -n 100
   ```

3. Verify file permissions:
   ```bash
   ls -la /path/to/ai-phone-receptionist
   ```

4. Test the server manually:
   ```bash
   cd /path/to/ai-phone-receptionist
   node src/server.js
   ```

### Common Issues

**Permission Denied**
- Ensure the user specified in the service file has read access to the project directory
- Check that the `.env` file is readable by the service user

**Module Not Found**
- Ensure `node_modules` is installed: `npm install`
- Verify the `WorkingDirectory` path is correct

**Port Already in Use**
- Check if another service is using port 3000: `sudo lsof -i :3000`
- Change the PORT in your `.env` file if needed

**Environment Variables Not Loaded**
- Ensure `.env` file exists in the project root
- Verify the `dotenv` package is installed
- Check that `config.js` is loading the `.env` file correctly

## Alternative: Using PM2

If you prefer a process manager with more features, consider using PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start src/server.js --name ai-phone-receptionist

# Save the process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

PM2 provides additional features like automatic restarts, log management, and monitoring.

## Security Considerations

1. **Run as Non-Root User**: Always run the service as a non-privileged user
2. **File Permissions**: Ensure `.env` file is not world-readable:
   ```bash
   chmod 600 .env
   ```
3. **Firewall**: Configure firewall rules to restrict access to the server port
4. **HTTPS**: Use Cloudflare Tunnel or reverse proxy with SSL for production

## Next Steps

After setting up auto-start:

1. Test the service by rebooting your system
2. Verify the service starts automatically after boot
3. Monitor logs for any issues
4. Set up the admin UI at `http://your-server:3000/admin`
5. Configure Cloudflare Tunnel to expose the server to Twilio webhooks

