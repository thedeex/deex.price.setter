#!/usr/bin/env bash

pathToKey=""
userNameOnServer=""
ServerRopsten=""
ServerMainNet=""

#Server=$ServerRopsten
Server=$ServerMainNet

scp -i $pathToKey ./on.server.before.deploy.sh $Server:/home/$userNameOnServer/on.server.before.deploy.sh
scp -i $pathToKey ./on.server.after.deploy.sh $Server:/home/$userNameOnServer/on.server.after.deploy.sh
ssh -i $pathToKey $Server "chmod +x *.sh"
ssh -i $pathToKey $Server sh ./on.server.before.deploy.sh
# https://serverfault.com/questions/264595/can-scp-copy-directories
scp -rp -i $pathToKey ./contracts/ $Server:/home/$userNameOnServer/server/
scp -rp -i $pathToKey ./app.js $Server:/home/$userNameOnServer/server/
scp -rp -i $pathToKey ./package.json $Server:/home/$userNameOnServer/server/
scp -rp -i $pathToKey ./telegram $Server:/home/$userNameOnServer/server/

# see: http://stackoverflow.com/questions/305035/how-to-use-ssh-to-run-shell-script-on-a-remote-machine
ssh -i $pathToKey $Server "echo $(date "+%FT%T%Z") : $(whoami)  >> /home/$userNameOnServer/deployment.log"
# see: https://stackoverflow.com/a/1930732/1697878
ssh -i $pathToKey $Server sh ./on.server.after.deploy.sh
