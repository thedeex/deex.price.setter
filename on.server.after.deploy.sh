#!/usr/bin/env bash

# on.server.after.deploy.sh

echo "start: on.server.after.deploy.sh"

cd ${HOME}/server

mkdir ./logs/
touch ./logs/log.txt
echo $(date "+%FT%T%Z") : $(whoami)  >> /home/ubuntu/server/logs/log.txt

npm install
screen -dmS NodeJS nodejs ./app.js

echo "end: on.server.after.deploy.sh"