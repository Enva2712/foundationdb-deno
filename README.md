# Deno FoundationDB Bindings

## Installation

`deno add @enva2712/fdb`

This package depends the
[FoundationDB client binaries](https://apple.github.io/foundationdb/api-general.html#installing-client-binaries)
and requires the `--allow-ffi` and `--unstable-ffi` flags in order to load the
shared library

## Basic Usage

```typescript
import FDB from "@enva2712/fdb";
const db = new FDB();
const tx = db.createTransaction();
const someval = await tx.get("foo");
tx.set("bar", someval);
await tx.commit();
```

## Watches

```typescript
import FDB from "@enva2712/fdb";
const db = new FDB();
for await (const value of await db.watch("somekey")) doStuffWith(value);
```
