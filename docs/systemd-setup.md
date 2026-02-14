# Systemd Setup Guide

This guide explains how to configure the AI Phone Receptionist to start automatically on boot using systemd on Linux.

## Prerequisites

- Linux system with systemd (Ubuntu, Debian, CentOS, etc.)
- Node.js installed
- Project deployed to a permanent location (e.g., `/opt/ai-phone-receptionist` or `/home/user/ai-phone-receptionist`)
- `.env` file configured with your credentials

## Step 1: Make the Startup Script Executable

Navigate to your project directory and make the startup script executable:

```bash
cd /path/to/ai-phone-receptionist
chmod +x start.sh
```

## Step 2: Create a Systemd Service File

Create a new service file for systemd:

```bash
sudo nano /etc/systemd/system/ai-phone-receptionist.service
```

Add the following content (replace `/path/to/ai-phone-receptionist` with your actual project path and `your-username` with your Linux username):

```ini
[Unit]
Description=AI Phone Receptionist
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/ai-phone-receptionist
ExecStart=/usr/bin/node /path/to/ai-phone-receptionist/src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ai-phone-receptionist

# Environment variables (optional - if not using .env file)
# Environment="PORT=3000"
# Environment="TWILIO_ACCOUNT_SID=your_sid"
# Environment="TWILIO_AUTH_TOKEN=your_token"
# Environment="OPENROUTER_API_KEY=your_key"

[Install]
WantedBy=multi-user.target
```

### Configuration Notes:

- **User**: Replace `your-username` with the user account that should run the service
- **WorkingDirectory**: Full path to your project directory
- **ExecStart**: Full path to node and your server.js file
- **Restart=on-failure**: Automatically restart if the service crashes
- **RestartSec=10**: Wait 10 seconds before restarting

## Step 3: Reload Systemd and Enable the Service

Reload systemd to recognize the new service:

```bash
sudo systemctl daemon-reload
```

Enable the service to start on boot:

```bash
sudo systemctl enable ai-phone-receptionist
```

## Step 4: Start the Service

Start the service immediately:

```bash
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

