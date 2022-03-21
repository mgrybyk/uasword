#!/bin/bash

DISTRO=$(/bin/grep '^ID=' /etc/os-release | cut -d = -f 2)
if [[ "$DISTRO" != "ubuntu" ]]; then
	echo "Not supported distro. Only Ubuntu is currently supported. Exiting..."
	exit 61
fi

if [[ $(/bin/whoami) != "root" ]]; then
	echo "Please run this under the root account or in sudo"
	exit 62
fi

/usr/bin/apt update
/usr/bin/apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    build-essential

/usr/bin/curl -fsSL https://deb.nodesource.com/setup_16.x | /usr/bin/bash -
/usr/bin/apt install -y nodejs

cat > /etc/systemd/system/uasword.service << EOF
[Unit]
Description=uaswrod service
After=network.target
StartLimitIntervalSec=0

[Service]
Type=exec
Restart=always
RestartSec=1
ExecStart=/opt/uasword/uasword_start.sh
RuntimeMaxSec=7200
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable uasword.service
systemctl start uasword.service
