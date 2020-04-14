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

### Work with next.js

After install the package, just change the start script from `next start` to `next-boost`. All `next start`'s command line arguments, like `-p` for specifing the port, are compatible.

```
 "scripts": {
    ...
    "start": "next-boost",
    ...
  },
```

### Programmatical Usage

```javascript
const http = require('http')
const CachedHandler = require('../dist/handler').default

// a sluggish page
const handler = (_, res) => setTimeout(() => res.end(new Date().toISOString()), 2000)
const port = 3000
const opts = { port, rules: [{ regex: '.*', ttl: 1 }] }
const cached = new CachedHandler(handler, opts)
const server = new http.Server(cached.handler)
server.listen(port, () => {
  console.log(`> Server on http://localhost:${port}`)
})
```

The server log will be something like:

```
> Cache located at ./.cache.db
> Server on http://localhost:3000
> Cache manager inited, will start to purge in 3600s
```

After the server started, try to access the server serveral times with your browser or `curl http://localhost:3000`. With the cache layer, only the first response is sluggish and the rests are super fast.

```
2s6.9ms | miss: /
  0.1ms | hit   : /
  0.1ms | stale : /
2s3.9ms | update: /
```

The first one takes more than 2 seconds and the second request is fetch from cache and only takes 2.6ms.


## Warnings on next.js custom server

## Why SQLite

## How the cache works