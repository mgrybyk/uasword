# uasword 

Browser-only version!

## Installation and Running

- make sure to have [NodeJS 16](https://nodejs.org/en/download/) installed
- clone the repo with [git](https://git-scm.com/download) `git clone -b pw-only https://github.com/mgrybyk/uasword.git`
- `cd uasword`
- install modules `npm install`
- download chromium `npx playwright install --with-deps chromium`
- run `node index`

## Targets

https://raw.githubusercontent.com/mgrybyk/uasword/pw-only/data/sites.json

## Azure Custom Data

![Azure Custom data](docs/azure_custom_data.jpg)[]

```
#!/bin/sh

sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    build-essential

curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

mkdir -p /opt && cd /opt
git clone -b pw-only https://github.com/mgrybyk/uasword.git && cd uasword
npm install
npx playwright install --with-deps chromium

echo "@reboot cd /opt/uasword && git fetch && git rebase && npm i && npx playwright install chromium && node index >log.log 2>&1" > /opt/cronjob
crontab /opt/cronjob

node index >log.log 2>&1
```

### See Logs in Azure

`sudo tail -f /opt/uasword/log.log`
