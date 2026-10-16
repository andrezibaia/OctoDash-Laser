#!/bin/bash

if [ ! -f "/etc/debian_version" ]; then
   echo ""
   echo "OctoDash-Laser is only compatible with Debian-based Linux installations!"
   echo ""
   exit 1
fi

REPO="andrezibaia/OctoDash-Laser"
arch=$(dpkg --print-architecture)
case $arch in
  armhf) pattern="armv7l.deb" ;;
  arm64) pattern="arm64.deb" ;;
  amd64) pattern="amd64.deb" ;;
  *) echo "Unsupported architecture: $arch"; exit 1 ;;
esac
releaseURL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url.*$pattern" | cut -d '"' -f 4)
if [ -z "$releaseURL" ]; then
  echo "No OctoDash-Laser release found for $arch at https://github.com/$REPO/releases"
  exit 1
fi

echo "Updating OctoDash-Laser"

cd ~
wget -O octodash-laser.deb "$releaseURL" -q --show-progress
cp -n ~/.config/octodash-laser/config.json ~/.config/octodash-laser/config.json.before-update 2>/dev/null
sudo apt install -y ./octodash-laser.deb
rm octodash-laser.deb

echo "Done. Restart the screen (or the Raspberry Pi) to start the new version!"
