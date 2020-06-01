/// <reference types="node" />

import { Worker } from 'worker_threads'

declare type Handler<T, R> = (args?: T) => R | Promise<R>

declare type Runner<T, R> = (sub: Worker) => Handler<T, R>

export declare const launch: (filename: string) => Worker

export declare const createHandler: <T, R>(
  name: string,
  handler: Handler<T, R>
) => Runner<T, R>

export {}
