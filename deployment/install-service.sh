#!/bin/bash

# AI Phone Receptionist - Systemd Service Installation Script
# This script automates the setup of the systemd service for auto-start on boot

set -e  # Exit on any error

echo "🚀 AI Phone Receptionist - Systemd Service Installer"
echo "===================================================="
echo ""

# Get the directory where this script is located (deployment folder)
DEPLOYMENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get the project root directory (parent of deployment folder)
PROJECT_DIR="$(dirname "$DEPLOYMENT_DIR")"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please do not run this script as root or with sudo"
   echo "   The script will ask for sudo password when needed"
   exit 1
fi

# Get current user
CURRENT_USER=$(whoami)

# Detect node path
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "❌ Error: Node.js not found in PATH"
    echo "   Please install Node.js first (see docs/systemd-setup.md)"
    exit 1
fi

echo "✅ Detected Node.js at: $NODE_PATH"
echo "✅ Current user: $CURRENT_USER"
echo "✅ Project directory: $PROJECT_DIR"
echo ""

# Check if .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "   You'll need to create it before starting the service"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "⚠️  Warning: node_modules not found!"
    echo "   Run 'npm install' before starting the service"
    echo ""
fi

# Create service file from template
SERVICE_FILE="/tmp/ai-phone-receptionist.service"
echo "📝 Creating systemd service file..."

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AI Phone Receptionist
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$NODE_PATH $PROJECT_DIR/src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ai-phone-receptionist

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created"
echo ""

# Show the service file content
echo "📄 Service file content:"
echo "------------------------"
cat "$SERVICE_FILE"
echo "------------------------"
echo ""

# Ask for confirmation
read -p "Install this service? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Installation cancelled"
    rm "$SERVICE_FILE"
    exit 0
fi

# Copy service file to systemd directory
echo "📋 Installing service file..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/ai-phone-receptionist.service
rm "$SERVICE_FILE"

# Reload systemd
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable service
echo "✅ Enabling service for auto-start on boot..."
sudo systemctl enable ai-phone-receptionist

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Ensure .env file is configured: nano .env"
echo "  2. Install dependencies if needed: npm install"
echo "  3. Start the service: sudo systemctl start ai-phone-receptionist"
echo "  4. Check status: sudo systemctl status ai-phone-receptionist"
echo "  5. View logs: sudo journalctl -u ai-phone-receptionist -f"
echo ""
echo "To uninstall:"
echo "  sudo systemctl stop ai-phone-receptionist"
echo "  sudo systemctl disable ai-phone-receptionist"
echo "  sudo rm /etc/systemd/system/ai-phone-receptionist.service"
echo "  sudo systemctl daemon-reload"
echo ""
