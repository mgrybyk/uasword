#!/bin/bash

set -e

cd /opt/uasword
/usr/bin/git pull --rebase
/usr/bin/npm i
/usr/bin/npx playwright install chromium
/usr/bin/node index
