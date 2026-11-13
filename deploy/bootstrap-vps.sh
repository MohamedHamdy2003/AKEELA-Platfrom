#!/usr/bin/env bash
set -euo pipefail
[[ "$EUID" == 0 ]] || { echo 'Run as root on the new VPS.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo 'This bootstrap targets Ubuntu 24.04 LTS.' >&2; exit 1; }
user="${1:-akeela}"
[[ "$user" =~ ^[a-z_][a-z0-9_-]*$ && "$user" != root ]] || exit 1
if ! command -v docker >/dev/null; then
 apt-get update
 apt-get install -y ca-certificates curl
 install -m 0755 -d /etc/apt/keyrings
 curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
 chmod a+r /etc/apt/keyrings/docker.asc
 arch="$(dpkg --print-architecture)"
 printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: noble\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$arch" > /etc/apt/sources.list.d/docker.sources
 apt-get update
 apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
apt-get install -y curl util-linux
timedatectl set-timezone Africa/Cairo
id "$user" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$user"
usermod -aG docker "$user"
install -d -m 0750 -o "$user" -g "$user" /opt/akeela /opt/akeela/releases
install -d -m 0700 -o "$user" -g "$user" "/home/$user/.ssh"
systemctl enable --now docker
printf 'Prepared Docker and /opt/akeela. Add your deploy SSH public key and private production environment file manually. No application or secrets were deployed.\n'
