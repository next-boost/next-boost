# CHANGELOGS

## 0.8.5

- Refactor
- Add back the `quiet` flag

## 0.8.4

- Add `Sync Lock`. When handling simultaneous requests, the first one will be rendered and the rest served from the cache.
- `quiet` flag removed

## 0.7.4

- Use `http.Server` to render the result. No more need to mock the `ServerResponse`.

## 0.7.3

- Upgrade npm packages

## 0.7.2

- Using `worker_threads` to render the page off the main thread

## 0.7.1

- Add support for `paramFilter`

## 0.6.x

- As next-boost switch to use hybrid-disk-cache, the `dbPath` in cache config has been changed to `path`. Under the path, the index file `cache.db` and subdirectories for large values will be created.


