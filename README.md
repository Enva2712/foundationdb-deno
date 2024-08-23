# Deno FoundationDB Bindings

## Installation

```bash
deno add @enva2712/fdb
```

### System Dependencies

This package depends the
[FoundationDB client binaries](https://apple.github.io/foundationdb/api-general.html#installing-client-binaries)
and requires the `--allow-ffi` and `--unstable-ffi` flags in order to load the
shared library

Here's an example dockerfile:

```dockerfile
FROM denoland/deno
ADD https://github.com/apple/foundationdb/releases/download/7.3.43/foundationdb-clients_7.3.43-1_amd64.deb /opt/fdb.deb
RUN dpkg -i /opt/fdb.deb
```

## KV Operations

```typescript
import FDB from "@enva2712/fdb";
const db = new FDB("/optional/path/to/fdb.cluster"); // path optional - see https://apple.github.io/foundationdb/administration.html#default-cluster-file
const tx = db.createTransaction();
const someval = await tx.get("foo");
tx.set("bar", someval);
await tx.commit();
```

## Watching a Key for Changes

```typescript
const db = new FDB();
for await (const value of db.watch("somekey")) {
  doStuffWith(value);
}
```

### Canceling a Watch

Normally watches are cleaned up when they get garbage collected; but if you want
to explicitly close a watch before this you can call `dispose`

```typescript
const watch = db.watch("somekey");
setTimeout(() => watch.dispose(), 3000);
for await (const val of watch) {
  doStuffWith(val);
}
```
