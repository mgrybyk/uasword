#!/bin/bash

set -e

cd /opt/uasword
/usr/bin/git reset --hard
/usr/bin/git pull --rebase
/usr/bin/npm i --omit dev --no-fund --no-audit
/usr/bin/npx playwright install --with-deps chromium
/usr/bin/node index
