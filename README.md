[![CI](https://github.com/rjyo/next-boost/workflows/CI/badge.svg)](https://github.com/rjyo/next-boost/actions) [![Coverage Status](https://coveralls.io/repos/github/rjyo/next-boost/badge.svg?branch=master&service=github)](https://coveralls.io/github/rjyo/next-boost?branch=master) [![Maintainability](https://api.codeclimate.com/v1/badges/358f0b96e0b3b5cc55ab/maintainability)](https://codeclimate.com/github/rjyo/next-boost/maintainability)

# next-boost

`next-boost` adds a cache layer to your SSR (Server-Side Rendering) applications. It was built originally for `Next.js` and should work with any node.js `http.Server` based application.

`next-boost` achieves [great performance](#performance) by rendering webpages on `worker_threads` while serving the cached on the main thread.

If you are familiar with `Next.js`, `next-boost` can be considered as an implementation of Incremental Static Regeneration which works with `getServerSideProps`. And it's not meant to be used with `getStaticProps`, in which Next.js will do the cache for you.

```bash
$ npm install next-boost --save
```

## Features

- Drop-in replacement for Next.js's production mode: `next start`
- Greatly reducing the server TTFB (time-to-first-byte)
- Non-blocking main process for cache-serving and using `worker_threads` for SSR
- Simultaneous requests with the first one rendered and the rest served from the cache
- Small footprint with [less than 200 LOC](https://coveralls.io/github/rjyo/next-boost?branch=master)
- Used in production with 300K pages cached
- As a [database-disk-hybrid cache](https://github.com/rjyo/hybrid-disk-cache)
    - no memory capacity limit, and works great on cheap VPSs
    - no need to add a cache layer server like varnish, nginx Cache and etc.
    - great performance, and may even have [better performace than pure file system](https://www.sqlite.org/fasterthanfs.html) cache
    - portability on major platforms

## Use `next-boost` cli with Next.js

After install the package, just change the start script from `next start` to `next-boost`. All `next start`'s command line arguments, like `-p` for specifing the port, are compatible.

```
 "scripts": {
    ...
    "start": "next-boost", // previously `next start`
    ...
  },
```

## Examples

There's an example under `examples/nodejs`, which works with a plain `http.Server`.

To use it with `express.js` and `next.js`, please check `examples/with-express`.


## Performance

By using `worker_threads`, the CPU-heavy SSR rendering will not blocking the main process from serving the cache.

Here are the comparision of using `ApacheBench` on a blog post fetched from database. HTML prerendered and the db operation takes around 10~20ms. The page takes around 200ms for Next.js to render.

```
$ /usr/local/bin/ab -n 200 -c 8 http://127.0.0.1:3000/blog/posts/2020/3/postname
```

Not a scientific benchmark, but the improvements are visibly huge.

with `next start` (data fetched with `getServerSideProps`):

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

with the drop-in `next-boost` cli:

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

It even outperforms next.js's static generated page (`getStaticProps`), handling 2~2.5x requests per seconds in my environment.

## How it works

`next-boost` implements a server-side cache in the manner of [stale-while-revalidate](https://web.dev/stale-while-revalidate/). When an expired (`stale`) page is accessed, the cache will be served and at the same time, a background process will fetch the latest version (`revalidate`) of that page and save it to the cache.

The following config will cache URIs matching `^/blog.*`. Only pages match `rules` will be handled by `next-boost` and there's no `exclude` rules.

```javascript
module.exports = {
  rules: [
    { regex: '^/blog.*', ttl: 300 },
  ],
}
```

There are 2 parameters to control the behavior of the cache:

- `ttl (time-to-live)`: After `ttl` seconds, the cache will be revalidated. And a cached page's `ttl` will be updated when a page is revalidated.
- `tbd (time-before-deletion)`: When a page is not hit again in `ttl + tbd` seconds, it will be completely remove from cache.


Above: only caching pages with URL start with `/blog`.


## Advanced Usages

### Deleting/Revalidating a Single URL

By sending a GET with header `x-cache-status:update` to the URL, the cache will be revalidated. And if the page doesn't exists anymore, the cache will be deleted.

    curl -H x-cache-status:update https://the_server_name.com/path_a

### Batch Deleting/Revalidating

If you want to delete mutiple pages at once, you can run SQL on the cache directly:

```bash
sqlite3 /cache_path/cache.db "update cache set ttl=0 where key like '%/url/a%';"
```

This will force all urls containing `/url/a` to be revalidated when next time accessed.

Deleting `cache_path` will remove all the caches.

### Filtering Query Parameters

By default, each page with different URLs will be cached separately. But in some cases you would like, `/path_a?utm_source=twitter` to be served with the same contents of `/path_a`. `paramFilter` is for filtering the query parameters.

```javascript
// in .next-boost.js
{
  ...
  paramFilter: (p) => p !== 'utm_source'
}
```

### Changing the cache key

By default, the URL will be used as the key for cached pages. If you want to server pages from different domains or by different user-agent, you can use this function to custom the cache key.

Notes:
- If there's any exception thrown from this function, or the returned value is not a `string`, your server will crash.

```javascript
// in .next-boost.js
{
  ...
  cacheKey: (req) => (req.headers.host || '') + ':' + req.url
}
```

## All Configurable Options

If available, `.next-boost.js` at project root will be used. If you use next-boost programmatically, the filename can be changed in options you passed to `CachedHandler`.

tips: If you are using `next-boost` cli with Next.js, you may want to use the config file.

And here's an example [`.next-boost.sample.js`](https://github.com/rjyo/next-boost/blob/master/.next-boost.sample.js) in the repo.


```typescript
interface HandlerConfig {
  filename?: string
  quiet?: boolean
  cache?: {
    ttl?: number
    tbd?: number
    path?: string
  }
  rules?: Array<URLCacheRule>
  paramFilter?: ParamFilter
  cacheKey?: CacheKeyBuilder
}

interface URLCacheRule {
  regex: string
  ttl: number
}

type ParamFilter = (param: string) => boolean
type CacheKeyBuilder = (req: IncomingMessage) => string
```

### Logging

Logging is enabled by default. If you use `next-boost` programmatically, you can disable logs by passing the `quiet` boolean flag as an option to `CachedHandler`.


```javascript
...
const cached = await CachedHandler(args, { quiet: true });
...
```

There's also a `--quiet` flag if you are using the command line.

## Limitations

- For architecture with multiple load-balanced rendering servers, the benefit of using `next-boost` is limited. Until the url is hit on every backend server, it can still miss the cache. Use reverse proxy with cache support (nginx, varnish etc) for that.
- `GET` and `HEAD` requests only.
- `worker_threads` is used and it is a node.js 12+ feature.

## FAQs

### Notice about Next.js's custom server

`next-boost` works as an in-place replacement for `next start` by using Next.js's [custom server](https://nextjs.org/docs/advanced-features/custom-server) feature.

On the linked page above, you can see the following notice:

> Before deciding to use a custom server please keep in mind that it should only be used when the integrated router of Next.js can't meet your app requirements. A custom server will remove important performance optimizations, like serverless functions and Automatic Static Optimization.

next-boost is meant to be used on cloud VPS or containers, so serverless function is not an issue here. As to `Automatic Static Optimization`, because we are not doing any `app.render` here, it still works, as perfect as always.

### Why SQLite

Here's the article about [when not to use SQLite](https://www.sqlite.org/whentouse.html). And for next-boost's main purpuse: super faster SSR on low-cost VPSs, as far as I know, it is the best choice.

## License

MIT. Copyright 2020 Rakuraku Jyo.
