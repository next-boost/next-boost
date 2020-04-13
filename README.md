# next-boost

[![Coverage Status](https://coveralls.io/repos/github/rjyo/next-boost/badge.svg?branch=master&service=github)](https://coveralls.io/github/rjyo/next-boost?branch=master)

`next-boost` is a middleware which adds a disk cache layer to your SSR applications. It was built originally for `next.js` SSR applications and can be used in any node.js `http.Server` based application.

It implements a server-side cache in the manner of [stale-while-revalidate](https://web.dev/stale-while-revalidate/), When an expired (`stale`) page is accessed, the cache will be served and at the same time, a background process will fetch the latest version (`revalidate`) of that page and save it to the cache.

There are 2 parameters to control the behavior of the cache:

- `ttl (time-to-live)`: After `ttl`, the cache will be revalidated. And a cached page's `ttl` will be updated when a page is revalidated.
- `tbd (time-before-deletion)`: When a page is not hit again in `ttl + tbd` seconds, it will be completely remove from cache.

## Installation

```bash
$ npm install next-boost --save
```

## Basic Usage

```javascript
const http = require('http')
const { createCachedHandler } = require('next-boost')

// a sluggish page
const handler = (req, res) => setTimeout(() => res.end('Mr. Slow'), 2000)
const port = 3000
const opts = { port }
const cached = createCachedHandler(handler, opts)
const server = new http.Server(cached)
server.listen(port, () => {
  console.log(`> Server on http://localhost:${port}`)
})
```

The server log will be something like:

```
> Cache located at ./.cache.db
> Server on http://localhost:3000
> Cache manager inited, will start to purge in 3600s
2s4.2ms | mis: /blog
  2.6ms | hit: /blog
```

The first one takes more than 2 seconds and the second request is fetch from cache and only takes 2.6ms.

### Work with next.js

`next start`

### Programmatical Usage

## Warnings on next.js custom server

## Why SQLite

## How the cache works