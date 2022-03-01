# query-url-p 

## Installation

- make sure to have NodeJS 16 installed
- clone the repo
- run `npm install`

## Running

In the repo folder run `node index`

## Adjust servers list

See `list.json` file. Add/remove servers there. The second array item is a number of max concurrent connections per site. The more urls you have the lower value should be used.  
Please start with very low values. Concurrent connections will adopt based on the error rate.

To use your own list while keeping the list.json unchanged set env variable pointing to your own list `URL_LIST=./list.json`
