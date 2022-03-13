# query-url-p 

## Installation

- make sure to have NodeJS 16 installed
- clone the repo
- run `npm install`

## Running

In the repo folder run `node index`

## Targets

The list of targets is provided by [uashield](https://github.com/opengs/uashield), see the [sites.json](https://raw.githubusercontent.com/opengs/uashieldtargets/v2/sites.json)

## Azure Custom Data

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

mkdir -p /opt
cd /opt
git clone https://github.com/mgrybyk/query-url-p.git
cd query-url-p
npm install

node index >log.log 2>&1
```

### See Logs in Azure

`sudo tail -f /opt/query-url-p/log.log`
