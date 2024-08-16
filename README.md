# Deno FDB

```typescript
import { selectAPIVersion, startNetwork, stopNetwork, FDB } from "https://deno.land/x/fdb/mod.ts";
selectAPIVersion(710);
startNetwork();
const db = new FDB();
const tx = db.createTransaction();
const someval = await tx.get('foo');
tx.set('bar', someval);
await tx.commit();
stopNetwork();
```
