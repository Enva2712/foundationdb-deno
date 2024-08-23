let filename: string | undefined = Deno.env.get("LIBFDB_C");
if (!filename) {
  if (Deno.build.os == "darwin") {
    filename = "/usr/local/lib/libfdb_c.dylib";
  } else if (Deno.build.os == "linux") {
    filename = "/usr/lib/libfdb_c.so";
  } else {
    throw new Error(
      "The LIBFDB_C variable was not set and could not automatically resolve the path to libfdb_c",
    );
  }
}

const dl = Deno.dlopen(filename, {
  fdb_select_api_version_impl: { parameters: ["i32", "i32"], result: "i32" },
  fdb_get_error: { parameters: ["i32"], result: "buffer" },
  fdb_error_predicate: { parameters: ["i32", "i32"], result: "i32" },
  fdb_setup_network: { parameters: [], result: "i32" },
  fdb_network_set_option: {
    parameters: ["i32", "pointer", "i32"],
    result: "i32",
  },
  fdb_run_network: { parameters: [], result: "i32", nonblocking: true },
  fdb_stop_network: { parameters: [], result: "i32" },
  fdb_future_destroy: { parameters: ["pointer"], result: "void" },
  fdb_future_release_memory: { parameters: ["pointer"], result: "void" },
  fdb_future_cancel: { parameters: ["pointer"], result: "void" },
  fdb_future_block_until_ready: { parameters: ["pointer"], result: "i32" },
  fdb_future_is_ready: { parameters: ["pointer"], result: "i32" },
  fdb_future_set_callback: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  fdb_future_get_error: { parameters: ["pointer"], result: "i32" },
  fdb_future_get_int64: { parameters: ["pointer", "pointer"], result: "i32" },
  fdb_future_get_uint64: { parameters: ["i32", "pointer"], result: "i32" },
  fdb_future_get_key: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  fdb_future_get_value: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  fdb_future_get_keyvalue_array: {
    parameters: ["pointer", "pointer", "pointer", "pointer"],
    result: "i32",
  },
  fdb_future_get_key_array: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  fdb_future_get_string_array: {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  fdb_create_database: {
    parameters: ["buffer", "pointer"],
    result: "i32",
  },
  fdb_database_destroy: {
    parameters: ["pointer"],
    result: "void",
  },
  fdb_database_open_tenant: {
    parameters: ["pointer", "buffer", "i32", "pointer"],
    result: "i32",
  },
  fdb_database_create_transaction: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  fdb_database_set_option: {
    parameters: ["pointer", "i32", "pointer", "i32"],
    result: "i32",
  },
  fdb_tenant_destroy: {
    parameters: ["pointer"],
    result: "void",
  },
  fdb_tenant_create_transaction: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  fdb_transaction_destroy: {
    parameters: ["pointer"],
    result: "void",
  },
  fdb_transaction_cancel: {
    parameters: ["pointer"],
    result: "void",
  },
  fdb_transaction_set_read_version: {
    parameters: ["pointer", "i64"],
    result: "void",
  },
  fdb_transaction_get_read_version: {
    parameters: ["pointer"],
    result: "pointer",
  },
  fdb_transaction_get: {
    parameters: ["pointer", "buffer", "i32", "i32"],
    result: "pointer",
  },
  fdb_transaction_get_key: {
    parameters: ["pointer", "pointer", "i32", "i32", "i32", "i32"],
    result: "pointer",
  },
  fdb_transaction_get_range: {
    parameters: [
      "pointer",
      "pointer",
      "i32",
      "i32",
      "i32",
      "pointer",
      "i32",
      "i32",
      "i32",
      "i32",
      "i32",
      "i32",
      "i32",
      "i32",
      "i32",
    ],
    result: "pointer",
  },
  fdb_transaction_get_estimated_range_size_bytes: {
    parameters: ["pointer", "pointer", "i32", "pointer", "i32"],
    result: "pointer",
  },
  fdb_transaction_get_range_split_points: {
    parameters: ["pointer", "pointer", "i32", "pointer", "i32", "i32"],
    result: "pointer",
  },
  fdb_transaction_add_conflict_range: {
    parameters: ["pointer", "pointer", "i32", "pointer", "i32", "i32"],
    result: "i32",
  },
  fdb_transaction_get_addresses_for_key: {
    parameters: ["pointer", "pointer", "i32"],
    result: "pointer",
  },
  fdb_transaction_set_option: {
    parameters: ["pointer", "i32", "pointer", "i32"],
    result: "i32",
  },
  fdb_transaction_atomic_op: {
    parameters: ["pointer", "pointer", "i32", "pointer", "i32", "i32"],
    result: "void",
  },
  fdb_transaction_set: {
    parameters: ["pointer", "buffer", "i32", "pointer", "i32"],
    result: "void",
  },
  fdb_transaction_clear: {
    parameters: ["pointer", "buffer", "i32"],
    result: "void",
  },
  fdb_transaction_clear_range: {
    parameters: ["pointer", "pointer", "i32", "pointer", "i32"],
    result: "void",
  },
  fdb_transaction_watch: {
    parameters: ["pointer", "buffer", "i32"],
    result: "pointer",
  },
  fdb_transaction_commit: {
    parameters: ["pointer"],
    result: "pointer",
  },
  fdb_transaction_get_committed_version: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },
  fdb_transaction_get_approximate_size: {
    parameters: ["pointer"],
    result: "pointer",
  },
  fdb_transaction_get_versionstamp: {
    parameters: ["pointer"],
    result: "pointer",
  },
  fdb_transaction_on_error: {
    parameters: ["pointer", "i32"],
    result: "pointer",
  },
  fdb_transaction_reset: {
    parameters: ["pointer"],
    result: "pointer",
  },
});
export default dl.symbols;

export class NPE extends Error {}
export class FDBError extends Error {
  constructor(public code: number) {
    let message: string | undefined;
    const ptr = dl.symbols.fdb_get_error(code);
    if (ptr) {
      message = `[${code}] ${Deno.UnsafePointerView.getCString(ptr)}`;
    }
    super(message);
  }
}

export function checkFDBErr(code: number) {
  if (code) {
    throw new FDBError(code);
  }
}

export function encodeCString(string: string): Uint8Array {
  return new TextEncoder().encode(`${string}\0`);
}

export class StarStar {
  constructor(public array = new BigUint64Array(1)) {}
  ref = () => Deno.UnsafePointer.of(this.array);
  deref() {
    const ptr = Deno.UnsafePointer.create(this.array[0]);
    if (ptr === null) throw new NPE();
    return ptr;
  }
}

let e = dl.symbols.fdb_select_api_version_impl(710, 710);
if (e !== 2201) checkFDBErr(e); // API version may be set only once
e = dl.symbols.fdb_setup_network();
if (e !== 2009) checkFDBErr(e); // Network can be configured only once
const netthread = dl.symbols
  .fdb_run_network()
  .then((e) => (e !== 2025 ? checkFDBErr(e) : undefined));

export async function close() {
  checkFDBErr(dl.symbols.fdb_stop_network());
  await netthread;
  dl.close();
}

const futures = new Map<bigint, Future>();
const sharedFutCb = new Deno.UnsafeCallback(
  { parameters: ["pointer", "pointer"], result: "void" },
  (ptr) => {
    if (!ptr) return;
    const f = futures.get(Deno.UnsafePointer.value(ptr));
    if (f) f.poll();
    else {
      console.error(
        "FDB tried to wake untracked future. This is a bug in the deno fdb bindings",
      );
    }
  },
);

function freeFut(ptr: Deno.PointerObject) {
  if (futures.delete(Deno.UnsafePointer.value(ptr))) {
    dl.symbols.fdb_future_destroy(ptr);
    sharedFutCb.unref(); // TODO: is the callback ref dropped when fdb calls it? docs are a bit unclear - test
  } else console.error("bug in @enva2712/fdb: double free");
}
const futreg = new FinalizationRegistry(freeFut);
const futureDependencies = new WeakMap<WeakKey, Future>();
export class Future {
  /** resolves when the future becomes ready. rejects if dispose is called before then */
  ready: Promise<void>;
  private dispatchReady: () => void;
  private dispatchCancel: () => void;
  constructor(private ptr: Deno.PointerValue) {
    if (!ptr) throw new NPE();
    sharedFutCb.ref();
    futreg.register(this, ptr);
    futures.set(Deno.UnsafePointer.value(ptr), this);
    [this.ready, this.dispatchReady, this.dispatchCancel] = (() => {
      let res: () => void, rej: () => void;
      const p = new Promise<void>((a, b) => ((res = a), (rej = b)));
      return [p, res!, rej!];
    })();
    const e = dl.symbols.fdb_future_set_callback(
      ptr,
      sharedFutCb.pointer,
      null,
    );
    if (e) {
      sharedFutCb.unref();
      throw new FDBError(e);
    }
  }

  poll(): void {
    if (dl.symbols.fdb_future_is_ready(this.ptr)) this.dispatchReady();
  }

  /** cleans up underlying memory. normally handled by GC but you can call before then to explicitly cleanup */
  dispose() {
    if (!this.ptr) return;
    this.dispatchCancel();
    freeFut(this.ptr);
    futreg.unregister(this);
    this.ptr = null;
  }

  get error() {
    if (!this.ptr) throw new NPE();
    const e = dl.symbols.fdb_future_get_error(this.ptr);
    return e ? new FDBError(e) : null;
  }

  /** WARN: calling dispose will free the returned buffer. TODO: delay dispose (finalization registry on returned buf) */
  get value() {
    const i32s = new Uint32Array(2);
    const outPresentPtr = Deno.UnsafePointer.of(i32s);
    const outLenPtr = Deno.UnsafePointer.of(i32s.subarray(1));
    const outPtr = new StarStar();
    const e = dl.symbols.fdb_future_get_value(
      this.ptr,
      outPresentPtr,
      outPtr.ref(),
      outLenPtr,
    );
    if (e) throw new FDBError(e);
    const outPresent = i32s[0] !== 0;
    const outLen = i32s[1];
    if (!outPresent) return null;
    const b = Deno.UnsafePointerView.getArrayBuffer(outPtr.deref(), outLen);
    futureDependencies.set(b, this); // this must live at least as long as b
    return b;
  }
}
