#!/bin/bash

set -e

cd /opt/uasword
/usr/bin/git pull --rebase
/usr/bin/npm i --omit dev --no-fund --no-audit
/usr/bin/npx playwright install chromium
/usr/bin/node index
