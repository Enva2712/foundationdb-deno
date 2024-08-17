import lib from "./dl.ts";

export class FDBError extends Error {
  constructor(code: number) {
    let message: string | undefined;
    const ptr = lib.fdb_get_error(code);
    if (ptr) {
      message = Deno.UnsafePointerView.getCString(ptr);
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
    if (ptr === null) throw new Error("nullref");
    return ptr;
  }
}

const futures = new WeakMap<Deno.PointerObject, Future>();
const freeFuture = (ptr: Deno.PointerObject) => {
  lib.fdb_future_destroy(ptr);
  futures.delete(ptr);
  muxer.unref();
};
const futreg = new FinalizationRegistry(freeFuture);
const wakeFuture = Symbol("wakeFuture");
const muxer = new Deno.UnsafeCallback(
  { parameters: ["pointer", "pointer"], result: "void" },
  (ptr) => {
    if (!ptr) return;
    const f = futures.get(ptr);
    if (f) f[wakeFuture]();
    else {console.warn(
        "FDB tried to wake untracked future. This is a bug in the deno fdb bindings",
      );}
  },
);

export class Future {
  constructor(
    private ptr: Deno.PointerObject,
    private onChange: (this: Future, value: ArrayBuffer) => void,
    private onError: (this: Future, error: FDBError) => void,
  ) {
    futreg.register(this, ptr);
    const e = lib.fdb_future_set_callback(ptr, muxer.pointer, null);
    if (e) throw new FDBError(e);
  }

  dispose() {
    futreg.unregister(this);
    freeFuture(this.ptr);
  }

  [wakeFuture](): void {
    let e = lib.fdb_future_get_error(this.ptr);
    if (e) return this.onError(new FDBError(e));
    const alloc = new ArrayBuffer(16); // u64, u32, u32
    const outValueContainer = new StarStar(new BigUint64Array(alloc, 0, 1));
    const i32s = new Uint32Array(alloc, 8, 2);
    const outPresentPointer = Deno.UnsafePointer.of(i32s);
    const outLengthPointer = Deno.UnsafePointer.of(i32s.subarray(1));
    e = lib.fdb_future_get_value(
      this.ptr,
      outPresentPointer,
      outValueContainer.ref(),
      outLengthPointer,
    );
    if (e) return this.onError(new FDBError(e));
    const outPresent = i32s[0] !== 0;
    if (!outPresent) {
      throw new Error(
        "fdb_future_get_value returned no value after calling future's callback",
      );
    }
    const outLen = i32s[1];
    this.onChange(
      Deno.UnsafePointerView.getArrayBuffer(outValueContainer.deref(), outLen),
    );
  }
}

export const nextFutureVal = (
  ptr: Deno.PointerValue,
) =>
  ptr
    ? new Promise<ArrayBuffer>((res, rej) =>
      void new Future(
        ptr,
        function (v) {
          this.dispose();
          res(v);
        },
        function (e) {
          this.dispose();
          rej(e);
        },
      )
    )
    : Promise.reject(new Error("nullptr"));
