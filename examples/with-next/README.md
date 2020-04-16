# next-boost with Next.js

A simple Next.js with the following 2 routes:

- /apple
- /orange

Both routes will response in around 500ms purposely.

In .next-boost.js, `/apple` is cached with ttl of 5 seconds, and `/orange` is not cached at all.

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
