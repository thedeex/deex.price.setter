#!/usr/bin/env bash

#start on.server.before.deploy.sh

echo "start: on.server.before.deploy.sh"

screen -S NodeJS -X quit

# (!) geth is still running

mkdir ./logs.backups
cp ./server/logs/log.txt ./logs.backups/$(date "+%s").log.txt

rm -rf ./server
mkdir ./server


echo "end: on.server.before.deploy.sh"