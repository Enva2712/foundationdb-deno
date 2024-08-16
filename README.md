# Deno FDB

## Installation
`deno add @enva2712/fdb`

## Basic Usage
```typescript
import FDB from "@enva2712/fdb";
const db = new FDB();
const tx = db.createTransaction();
const someval = await tx.get('foo');
tx.set('bar', someval);
await tx.commit();
```

## Watches
```typescript
import FDB from "@enva2712/fdb";
const db = new FDB();
for await (const value of await db.watch('somekey')) doStuffWith(value)
```
