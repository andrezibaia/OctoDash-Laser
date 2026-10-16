#!/bin/bash

echo "Removing OctoDash-Laser ..."
pkill -f "octodash-laser --no-sandbox"

sudo apt purge -y octodash-laser

rm -rf ~/.config/octodash-laser/

sed -i '/octodash-laser --no-sandbox/d' ~/.xinitrc

echo "OctoDash-Laser has been removed. Please review your ~/.xinitrc and ~/.bashrc files to make sure everything got removed properly!"
