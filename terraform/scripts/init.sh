#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get upgrade -y

apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  python3-dev \
  build-essential \
  nginx \
  certbot \
  python3-certbot-nginx \
  git \
  curl \
  unzip

# Node.js 20 LTS (needed to build the Vite frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

mkdir -p /home/lifeline-AI
chown ubuntu:ubuntu /home/lifeline-AI

tee /etc/nginx/sites-available/app > /dev/null << 'NGINX'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

# WorkingDirectory points to backend/ — FastAPI mounts frontend/dist/ from there.
# Single worker required: app uses in-memory WebSocket state (registry.py).
tee /etc/systemd/system/app.service > /dev/null << 'SYSTEMD'
[Unit]
Description=Ambulance Dispatch API
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/lifeline-AI/backend
EnvironmentFile=/home/lifeline-AI/backend/.env
ExecStart=/home/lifeline-AI/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
