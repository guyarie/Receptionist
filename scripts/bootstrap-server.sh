#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 22.04+ server for AI Phone Receptionist.
# Run as your admin user (with sudo access), not as root.
#
# Usage: bash scripts/bootstrap-server.sh

set -euo pipefail

echo "==> Node.js 22 LTS"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version

echo "==> nginx + certbot"
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
nginx -v

echo "==> PM2 (global)"
sudo npm install -g pm2
pm2 --version

echo "==> Project dependencies"
npm install --production

echo ""
echo "Done. Next steps:"
echo "  1. Create the receptionist service user:"
echo "       sudo useradd --system --shell /bin/bash --create-home --home-dir /home/receptionist receptionist"
echo "       sudo chown -R receptionist:receptionist installs/"
echo "  2. Copy and fill in installs/_defaults.env.example → installs/_defaults.env"
echo "  3. Create an install: node manage.js create <name>"
echo "  4. Start as service user and persist:"
echo "       sudo su - receptionist"
echo "       cd $(pwd)"
echo "       node manage.js start all && pm2 save && pm2 startup"
echo "       # copy the printed command, exit, run it as $(whoami)"
echo "       sudo systemctl start pm2-receptionist"
echo "  5. SSL: sudo certbot --nginx -d your-domain.com"
echo "  See docs/DEPLOYMENT.md for the full walkthrough."
