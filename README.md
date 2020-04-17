[![CI](https://github.com/rjyo/next-boost/workflows/CI/badge.svg)](https://github.com/rjyo/next-boost/actions) [![Coverage Status](https://coveralls.io/repos/github/rjyo/next-boost/badge.svg?branch=master&service=github)](https://coveralls.io/github/rjyo/next-boost?branch=master) [![Maintainability](https://api.codeclimate.com/v1/badges/358f0b96e0b3b5cc55ab/maintainability)](https://codeclimate.com/github/rjyo/next-boost/maintainability)

# next-boost

`next-boost` is a middleware which adds a disk cache layer to your SSR applications. It was built originally for `Next.js` SSR applications and can be used in any node.js `http.Server` based application.

## Features

- In-place replacement for Next.js's production mode: `next start`
- Greatly reducing the server TTFB (time-to-first-byte)
- By using diskcache based on SQLite3, `next-boost`
    - has no memory capacity limit, and works on cheap VPS
    - has high performance (100K+ pages in production), and may even have [better performace than pure file system](https://www.sqlite.org/fasterthanfs.html) cache
    - works on major platforms
- Small footprint: [200 LOC](https://coveralls.io/github/rjyo/next-boost?branch=master) and 1 npm dependency for SQLLite3 (`better-sqlite3`)

## How it works

`next-boost` implements a server-side cache in the manner of [stale-while-revalidate](https://web.dev/stale-while-revalidate/). When an expired (`stale`) page is accessed, the cache will be served and at the same time, a background process will fetch the latest version (`revalidate`) of that page and save it to the cache.

There are 2 parameters to control the behavior of the cache:

- `ttl (time-to-live)`: After `ttl`, the cache will be revalidated. And a cached page's `ttl` will be updated when a page is revalidated.
- `tbd (time-before-deletion)`: When a page is not hit again in `ttl + tbd` seconds, it will be completely remove from cache.

## Installation

```bash
$ npm install next-boost --save
```

## Basic Usage

### In-place replacement for Next.js

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
const handler = (req, res) => setTimeout(() => res.end(new Date().toISOString()), 2000)
const port = 3000
// revalidate all pages after 1 second
const opts = { port, rules: [{ regex: '.*', ttl: 1 }] }
const cached = new CachedHandler(handler, opts)
const server = new http.Server(cached.handler)
server.listen(port, () => {
  console.log(`> Server on http://localhost:${port}`)
})
```

The handler is just a pure [NodeJS requestListener](https://nodejs.org/api/http.html#http_http_createserver_options_requestlistener). And if you are using Next.js's custom server, it will be `app.getRequestHandler()`. Check next-boost's [cli implementation](https://github.com/rjyo/next-boost/blob/master/src/next/server.ts) here.

The server log will be something like:

```
> Cache located at /tmp
> Server on http://localhost:3000
> Cache manager inited, will start to purge in 3600s
```

After the server started, try to access the server serveral times with your browser or `curl http://localhost:3000`. With the cache layer, only the first response is sluggish and the rests are super fast.

```bash
2s6.9ms | miss  : /    # The first one takes more than 2 seconds
  0.1ms | hit   : /    # The second request only takes 0.1ms
  0.1ms | stale : /    # As we set ttl to 1 seconds, revalidating process has kicked in
  0.1ms | stale : /    # Until updated, the stale result is always served
2s3.9ms | update: /    # It took 2s+ to update on background
```

### Options

If available, `.next-boost.js` at project root will be loaded. If you use next-boost programmatically, the filename can be changed in options you passed to `CachedHandler`.

Type is defined as below:

```typescript
interface HandlerConfig {
  hostname?: string
  port?: number
  quiet?: boolean
  filename?: string
  cache?: {
    ttl?: number
    tbd?: number
    path?: string
  }
  rules?: Array<URLCacheRule>
}

interface URLCacheRule {
  regex: string
  ttl: number
}
```

tips: If you are using `next-boost` with Next.js directly, you may want to use the config file.

And here's an example [`.next-boost.sample.js`](https://github.com/rjyo/next-boost/blob/master/.next-boost.sample.js) in the repo.

## Performance

Here are the comparision of using `ApacheBench` on a blog post fetched from database. HTML prerendered and the db operation takes around 10~20ms. The page takes around 200ms for Next.js to render.

```
$ /usr/local/bin/ab -n 200 -c 8 http://127.0.0.1:3000/blog/posts/2020/3/postname
```

Not a scientific benchmark, but the improvements are visibly huge.

with `next-boost`:

```
Document Length:        78557 bytes
Concurrency Level:      8
Time taken for tests:   0.149 seconds
Complete requests:      200
Failed requests:        0
Total transferred:      15747600 bytes
HTML transferred:       15711400 bytes
Requests per second:    1340.48 [#/sec] (mean)
Time per request:       5.968 [ms] (mean)
Time per request:       0.746 [ms] (mean, across all concurrent requests)
Transfer rate:          103073.16 [Kbytes/sec] received
```

with `next start`:

```
Document Length:        76424 bytes
Concurrency Level:      8
Time taken for tests:   41.855 seconds
Complete requests:      200
Failed requests:        0
Total transferred:      15325600 bytes
HTML transferred:       15284800 bytes
Requests per second:    4.78 [#/sec] (mean)
Time per request:       1674.185 [ms] (mean)
Time per request:       209.273 [ms] (mean, across all concurrent requests)
Transfer rate:          357.58 [Kbytes/sec] received
```

## Limitations

- For architecture with multiple load-balanced rendering servers, the benefit of using `next-boost` is limited. Until the url is hit on every backend server, it can still miss the cache. Though sharing the cache on network file systems with servers might help.
- For session/cookie based pages, like user's dashboard and etc, next-boost is not a good choice as the page is updated in the background and the user might ha.

## FAQs

### Notice about Next.js's custom server

`next-boost` works as an in-place replacement for `next start` by using Next.js's [custom server](https://nextjs.org/docs/advanced-features/custom-server) feature.

On the linked page above, you can see the following notice:

> Before deciding to use a custom server please keep in mind that it should only be used when the integrated router of Next.js can't meet your app requirements. A custom server will remove important performance optimizations, like serverless functions and Automatic Static Optimization.

next-boost is meant to be used on cloud VPS or containers, so serverless function is not an issue here. As to `Automatic Static Optimization`, because we are not doing any `app.render` here, it still works, as perfect as always.

### Why SQLite

Here's the article about [when not to use SQLite](https://www.sqlite.org/whentouse.html). And for next-boost's main purpuse: super faster SSR on low-cost VPSs, as far as I know, it is the best choice.
