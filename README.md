# uasword 

[![Test](https://github.com/mgrybyk/uasword/actions/workflows/test.yml/badge.svg)](https://github.com/mgrybyk/uasword/actions/workflows/test.yml)

> Multitarget DDoS tool based on [uashield](https://github.com/opengs/uashield) and [db1000n](https://github.com/Arriven/db1000n) lists.

![stats](docs/stats.png)
- run in Docker, Termux or anywhere with Nodejs installed.
- attacks multiple targets in parallel
- DNS flood
- uses browser to overcome any antiddos protection (real browser detection)
- IT ARMY of Ukraine lists are included as well
- targets list updates automatically, run once and let it work

## Installation and Running

- make sure to have [NodeJS 16](https://nodejs.org/en/download/) installed
- clone the repo with [git](https://git-scm.com/download) `git clone https://github.com/mgrybyk/uasword.git`
- `cd uasword`
- install modules `npm install`
- download chromium `npx playwright install --with-deps chromium`
- run `node index`

## Targets

Several target lists is used, see [data/config.json](https://github.com/mgrybyk/uasword/blob/master/data/config.json). As for now uashield and db1000n lists are enabled.

## Docker

Docker image published to https://hub.docker.com/r/atools/uasword

## Azure Custom Data

![Azure Custom data](docs/azure_custom_data.png)

Install:
```
sudo mkdir -p /opt && sudo git clone https://github.com/mgrybyk/uasword.git /opt/uasword && sudo /opt/uasword/setup.sh
```

### See Logs in Azure

`journalctl -xe -u uasword.service -f`
