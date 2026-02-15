#!/bin/bash
# Deployment script for DigitalOcean droplet

set -e  # Exit on error

SERVER_IP="138.68.51.142"
APP_DIR="/opt/ai-phone-receptionist"
REPO_URL="https://github.com/yourusername/ai-phone-receptionist.git"  # Update this!

echo "🚀 Deploying AI Phone Receptionist to DigitalOcean..."

# Install Node.js and dependencies on server
echo "📦 Installing Node.js and system dependencies..."
ssh root@$SERVER_IP << 'ENDSSH'
# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# Verify installation
node --version
npm --version

echo "✅ Node.js installed successfully"
ENDSSH

# Create app directory and copy files
echo "📁 Setting up application directory..."
ssh root@$SERVER_IP "mkdir -p $APP_DIR"

# Copy application files (excluding node_modules, .git, etc.)
echo "📤 Uploading application files..."
rsync -avz --exclude 'node_modules' \
           --exclude '.git' \
           --exclude 'call-summaries' \
           --exclude 'data' \
           --exclude '.env' \
           ./ root@$SERVER_IP:$APP_DIR/

# Install dependencies and set up service
echo "📦 Installing npm dependencies..."
ssh root@$SERVER_IP << ENDSSH
cd $APP_DIR

# Install dependencies
npm install --production

# Create necessary directories
mkdir -p call-summaries
mkdir -p data/providers
mkdir -p data/practice
mkdir -p data/availability

echo "✅ Dependencies installed"
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Copy your .env file to the server:"
echo "   scp .env root@$SERVER_IP:$APP_DIR/.env"
echo ""
echo "2. Copy your data files:"
echo "   scp -r data/* root@$SERVER_IP:$APP_DIR/data/"
echo ""
echo "3. Install and start the systemd service:"
echo "   ssh root@$SERVER_IP 'cd $APP_DIR && bash deployment/install-service.sh'"
echo ""
echo "4. Check service status:"
echo "   ssh root@$SERVER_IP 'systemctl status ai-phone-receptionist'"
