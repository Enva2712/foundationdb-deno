import lib, { close } from "./dl.ts";
import {
  checkFDBErr,
  encodeCString,
  freeFuture,
  PointerContainer,
  wrapFuture,
} from "./utils.ts";
import { options } from "./options.ts";

checkFDBErr(lib.fdb_select_api_version_impl(710, 710));
checkFDBErr(lib.fdb_setup_network());
const netthread = lib.fdb_run_network().then(checkFDBErr);

/**
 * cleanup will stop the foundationdb networking thread and call dlclose on the shared object
 */
export async function cleanup() {
  checkFDBErr(lib.fdb_stop_network());
  await netthread;
  close();
}

const dbReg = new FinalizationRegistry(lib.fdb_database_destroy);
/**
 * See [Database](https://apple.github.io/foundationdb/api-c.html#database) in the FDB client API docs
 */
export default class FDB {
  ptr: Deno.PointerObject;
  constructor(clusterFile?: string) {
    const me = new PointerContainer();
    checkFDBErr(lib.fdb_create_database(
      clusterFile ? encodeCString(clusterFile) : null,
      me.use(),
    ));
    this.ptr = me.get();
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
    checkFDBErr(lib.fdb_database_set_option(
      this.ptr,
      optionId,
      valuePointer,
      valueLength,
    ));
  }
  async watch(key: string): Promise<Watch> {
    const tx = this.createTransaction();
    const w = new Watch(tx, key);
    await tx.commit();
    return w;
  }
}

const tenantreg = new FinalizationRegistry(lib.fdb_tenant_destroy);
/**
 * See [Tenant](https://apple.github.io/foundationdb/api-c.html#tenant) in the FDB client API docs
 */
export class Tenant {
  ptr: Deno.PointerObject;
  constructor(db: FDB, name: string) {
    const me = new PointerContainer();
    checkFDBErr(lib.fdb_database_open_tenant(
      db.ptr,
      encodeCString(name),
      name.length,
      me.use(),
    ));
    this.ptr = me.get();
    tenantreg.register(this, this.ptr);
  }
  createTransaction = (): Transaction => new Transaction(this);
  async watch(key: string): Promise<Watch> {
    const tx = this.createTransaction();
    const w = new Watch(tx, key);
    await tx.commit();
    return w;
  }
}

const txreg = new FinalizationRegistry(lib.fdb_transaction_destroy);
/**
 * See [Transaction](https://apple.github.io/foundationdb/api-c.html#transaction) in the FDB client API docs
 */
export class Transaction {
  ptr: Deno.PointerObject;
  constructor(wrap: FDB | Tenant) {
    const me = new PointerContainer();
    checkFDBErr(
      (wrap instanceof FDB
        ? lib.fdb_database_create_transaction
        : lib.fdb_tenant_create_transaction)(wrap.ptr, me.use()),
    );
    this.ptr = me.get();
    txreg.register(this, this.ptr);
  }
  get = (key: string, snapshot = 0): Promise<ArrayBuffer> =>
    wrapFuture(lib.fdb_transaction_get(
      this.ptr,
      encodeCString(key),
      key.length,
      snapshot,
    ));
  set = (key: string, value: ArrayBuffer): void =>
    lib.fdb_transaction_set(
      this.ptr,
      encodeCString(key),
      key.length,
      Deno.UnsafePointer.of(value),
      value.byteLength,
    );
  clear = (key: string): void =>
    lib.fdb_transaction_clear(
      this.ptr,
      encodeCString(key),
      key.length,
    );
  commit = (): Promise<ArrayBuffer> =>
    wrapFuture(lib.fdb_transaction_commit(this.ptr));
}

const watchreg = new FinalizationRegistry(freeFuture);
/**
 * https://apple.github.io/foundationdb/api-c.html#c.fdb_transaction_watch
 */
export class Watch implements AsyncIterableIterator<ArrayBuffer> {
  ptr: Deno.PointerObject;
  constructor(tx: Transaction, key: string) {
    const f = lib.fdb_transaction_watch(tx.ptr, encodeCString(key), key.length);
    if (f === null) throw new Error("nullptr");
    watchreg.register(this, this.ptr = f);
  }
  [Symbol.asyncIterator] = () => this;
  async next(): Promise<IteratorResult<ArrayBuffer>> {
    return { value: await wrapFuture(this.ptr, true) };
  }
}
