# query-url-p 

## Installation

- make sure to have NodeJS 16 installed
- clone the repo
- run `npm install`

## Running

In the repo folder run `node index`

## Adjust servers list

See `list.json` file. Add/remove servers there. The second array item is a number of max concurrent connections per site. The more urls you have the lower value should be used. 

You might have experience performance issues with slow hardware/networks. In such a case remove some urls from the json file, lower down number from 100 to 50 or 10.
