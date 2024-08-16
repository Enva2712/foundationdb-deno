import { lib } from "./lib.ts";
import {
  checkFDBErr,
  encodeCString,
  PointerContainer,
  wrapFuture,
} from "./utils.ts";
import { options } from "./options.ts";

const HEADER_VERSION = 710;

export function selectAPIVersion(apiVersion: number) {
  checkFDBErr(lib.fdb_select_api_version_impl(apiVersion, HEADER_VERSION));
}

export async function startNetwork() {
  checkFDBErr(lib.fdb_setup_network());
  checkFDBErr(await lib.fdb_run_network());
}

export function stopNetwork() {
  checkFDBErr(lib.fdb_stop_network());
}

export function createDatabase(clusterFile: string | null = null) {
  const container = new PointerContainer();
  checkFDBErr(lib.fdb_create_database(
    clusterFile == null ? clusterFile : encodeCString(clusterFile),
    container.use(),
  ));
  return new Database(container.get());
}

const dbReg = new FinalizationRegistry(lib.fdb_database_destroy);
export class Database {
  constructor(public ptr: NonNullable<Deno.PointerValue>) {
    dbReg.register(this, ptr);
  }

  createTransaction = () => new Transaction(this);
  openTenant = (name: string) => new Tenant(this, name);

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
}

const tenantreg = new FinalizationRegistry(lib.fdb_tenant_destroy);
export class Tenant {
  public ptr: NonNullable<Deno.PointerValue>;
  constructor(db: Database, name: string) {
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

  createTransaction = () => new Transaction(this);
}

const txreg = new FinalizationRegistry(lib.fdb_transaction_destroy);
export class Transaction {
  private ptr: NonNullable<Deno.PointerValue>;
  constructor(wrap: Database | Tenant) {
    const me = new PointerContainer();
    if (wrap instanceof Database) {
      checkFDBErr(lib.fdb_database_create_transaction(wrap.ptr, me.use()));
    } else {
      checkFDBErr(lib.fdb_tenant_create_transaction(wrap.ptr, me.use()));
    }

    this.ptr = me.get();
    txreg.register(this, this.ptr);
  }

  get = (key: string, snapshot = 0) =>
    wrapFuture(lib.fdb_transaction_get(
      this.ptr,
      encodeCString(key),
      key.length,
      snapshot,
    ));

  set = (key: string, value: ArrayBuffer) =>
    lib.fdb_transaction_set(
      this.ptr,
      encodeCString(key),
      key.length,
      Deno.UnsafePointer.of(value),
      value.byteLength,
    );

  clear = (key: string) =>
    lib.fdb_transaction_clear(
      this.ptr,
      encodeCString(key),
      key.length,
    );

  commit = () => wrapFuture(lib.fdb_transaction_commit(this.ptr));
}
