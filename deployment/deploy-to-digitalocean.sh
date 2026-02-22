#!/bin/bash
# Deployment script for DigitalOcean droplet
# Updates the production deployment via git pull

set -e  # Exit on error

SERVER_IP="138.68.51.142"
SERVER_USER="guyarie"
APP_DIR="/home/guyarie/receptionist_prod/Receptionist"
SERVICE_NAME="ai-phone-receptionist"

echo "🚀 Deploying AI Phone Receptionist to DigitalOcean..."
echo ""

# Pull latest changes from git
echo "📥 Pulling latest changes from git..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
cd $APP_DIR

# Pull latest code
git pull

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production

echo "✅ Code updated successfully"
ENDSSH

# Restart the service
echo ""
echo "🔄 Restarting service..."
ssh $SERVER_USER@$SERVER_IP "sudo systemctl restart $SERVICE_NAME"

# Check service status
echo ""
echo "📊 Checking service status..."
ssh $SERVER_USER@$SERVER_IP "sudo systemctl status $SERVICE_NAME --no-pager"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Useful commands:"
echo "  View logs: ssh $SERVER_USER@$SERVER_IP 'sudo journalctl -u $SERVICE_NAME -f'"
echo "  Check status: ssh $SERVER_USER@$SERVER_IP 'sudo systemctl status $SERVICE_NAME'"
echo "  Test endpoint: curl https://phone.rtcbellevue.com/"
