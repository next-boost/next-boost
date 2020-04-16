# next-boost with Next.js

A simple Next.js with the following 2 routes:

- /apple
- /orange

Both routes will response in around 500ms purposely.

In .next-boost.js, `/apple` is cached with ttl of 5 seconds, and `/orange` is not cached at all.

## Run

```
$ npm install
$ npm run build
$ npm start

> with-next@1.0.0 start /Users/jyo/projects/coinjinja/next-boost/examples/with-next
> next-boost

> Loaded next-boost config from .next-boost.js
> Cache located at ./.cache.db
> Server on http://localhost:3000
> Cache manager inited, will start to purge in 86400s
526.6ms | miss  : /apple
  0.5ms | hit   : /apple
  0.3ms | stale : /apple
504.1ms | update: /apple
```

## Benchmark

You can compare the 2 routes below with `ab`:

```
$ ab -n 50 -c 4 http://127.0.0.1:3000/apple

...
Requests per second:    2097.93 [#/sec] (mean)
Time per request:       1.907 [ms] (mean)
Time per request:       0.477 [ms] (mean, across all concurrent requests)
Transfer rate:          1735.30 [Kbytes/sec] received
...

$ ab -n 50 -c 4 http://127.0.0.1:3000/orange

...
Requests per second:    7.01 [#/sec] (mean)
Time per request:       570.622 [ms] (mean)
Time per request:       142.655 [ms] (mean, across all concurrent requests)
Transfer rate:          14.33 [Kbytes/sec] received
...
```