import lib, {
  checkFDBErr,
  close,
  encodeCString,
  Future,
  StarStar,
} from "./dl.ts";
import { options } from "./options.ts";

/**
 * cleanup will stop the foundationdb networking thread and call dlclose on the shared object
 */
export const cleanup = close;

const dbReg = new FinalizationRegistry(lib.fdb_database_destroy);
/**
 * See [Database](https://apple.github.io/foundationdb/api-c.html#database) in the FDB client API docs
 */
export default class FDB {
  ptr: Deno.PointerObject;
  constructor(clusterFile?: string) {
    const me = new StarStar();
    checkFDBErr(
      lib.fdb_create_database(
        clusterFile ? encodeCString(clusterFile) : null,
        me.ref(),
      ),
    );
    this.ptr = me.deref();
    dbReg.register(this, this.ptr);
  }
  createTransaction = (): Transaction => new Transaction(this);
  openTenant = (name: string): Tenant => new Tenant(this, name);
  setOption(
    option: keyof typeof options.NetworkOption,
    value?: number | string,
  ) {
    const optionData = options.NetworkOption[option];
    if (!optionData) {
      throw new Error("Invalid option");
    }
    const [optionId, optionValueType] = optionData;
    let valuePointer: Deno.PointerValue = null;
    let valueLength = 0;
    if (optionValueType === "Int") {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new TypeError("Invalid integer value argument");
      }
      // Prefer Uint8Array due to Deno FFI preference on it.
      const u8array = new Uint8Array(8);
      const view = new DataView(u8array.buffer);
      view.setBigInt64(0, BigInt(value), true);
      valuePointer = Deno.UnsafePointer.of(u8array);
      valueLength = 8;
    } else if (optionValueType === "String") {
      if (typeof value !== "string") {
        throw new TypeError("Invalid string value argument");
      }
      // No need to create a CString (ie. add null byte) due to length parameter
      const stringBuffer = new TextEncoder().encode(value);
      valuePointer = Deno.UnsafePointer.of(stringBuffer);
      valueLength = stringBuffer.length;
    }
    checkFDBErr(
      lib.fdb_database_set_option(
        this.ptr,
        optionId,
        valuePointer,
        valueLength,
      ),
    );
  }
  watch(key: string): Watch {
    return new Watch(this, key);
  }
}

const tenantreg = new FinalizationRegistry(lib.fdb_tenant_destroy);
/**
 * See [Tenant](https://apple.github.io/foundationdb/api-c.html#tenant) in the FDB client API docs
 */
export class Tenant {
  ptr: Deno.PointerObject;
  constructor(db: FDB, name: string) {
    const me = new StarStar();
    checkFDBErr(
      lib.fdb_database_open_tenant(
        db.ptr,
        encodeCString(name),
        name.length,
        me.ref(),
      ),
    );
    this.ptr = me.deref();
    tenantreg.register(this, this.ptr);
  }
  createTransaction = (): Transaction => new Transaction(this);
  watch(key: string): Watch {
    return new Watch(this, key);
  }
}

const txreg = new FinalizationRegistry(lib.fdb_transaction_destroy);
/**
 * See [Transaction](https://apple.github.io/foundationdb/api-c.html#transaction) in the FDB client API docs
 */
export class Transaction {
  ptr: Deno.PointerObject;
  constructor(wrap: FDB | Tenant) {
    const me = new StarStar();
    checkFDBErr(
      (wrap instanceof FDB
        ? lib.fdb_database_create_transaction
        : lib.fdb_tenant_create_transaction)(wrap.ptr, me.ref()),
    );
    this.ptr = me.deref();
    txreg.register(this, this.ptr);
  }
  async get(key: string, snapshot = 0): Promise<ArrayBuffer | null> {
    const f = new Future(lib.fdb_transaction_get(
      this.ptr,
      encodeCString(key),
      key.length,
      snapshot,
    ));
    await f.ready;
    return f.value;
  }
  set(key: string, value: ArrayBuffer): void {
    return lib.fdb_transaction_set(
      this.ptr,
      encodeCString(key),
      key.length,
      Deno.UnsafePointer.of(value),
      value.byteLength,
    );
  }
  clear(key: string): void {
    return lib.fdb_transaction_clear(this.ptr, encodeCString(key), key.length);
  }
  async commit() {
    const f = new Future(lib.fdb_transaction_commit(this.ptr));
    await f.ready;
  }
}

/**
 * https://apple.github.io/foundationdb/developer-guide.html#watches
 */
export class Watch implements AsyncIterableIterator<ArrayBuffer | null> {
  private fut?: Future;
  constructor(private parent: FDB | Tenant, public readonly key: string) {}
  [Symbol.asyncIterator] = () => this;
  async next(): Promise<IteratorResult<ArrayBuffer | null>> {
    if (this.fut) await this.fut.ready;
    const tx = this.parent.createTransaction();
    const value = await tx.get(this.key);
    this.fut = new Future(lib.fdb_transaction_watch(
      tx.ptr,
      encodeCString(this.key),
      this.key.length,
    ));
    await tx.commit();
    return { value };
  }

  dispose() {
    this.fut?.dispose();
  }
}
