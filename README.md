# Deno FDB
```typescript
import { selectAPIVersion, startNetwork, stopNetwork, FDB } from "jsr:@enva2712/fdb";
selectAPIVersion(710);
startNetwork();
const db = new FDB();
const tx = db.createTransaction();
const someval = await tx.get('foo');
tx.set('bar', someval);
await tx.commit();
stopNetwork();
```
