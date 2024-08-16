import { lib } from "./lib.ts";

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

export function encodeCString(string: string) {
  return new TextEncoder().encode(`${string}\0`);
}

export class PointerContainer {
  constructor(public array = new BigUint64Array(1)) {}
  use = () => Deno.UnsafePointer.of(this.array);
  get() {
    const ptr = Deno.UnsafePointer.create(this.array[0]);
    if (ptr === null) throw new Error("nullref");
    return ptr;
  }
}

const futreg = new FinalizationRegistry(lib.fdb_future_destroy);
type Cb<T> = (v: T) => void;
const cbs = new Map<bigint, [res: Cb<ArrayBuffer>, rej: Cb<unknown>]>();
const muxer = new Deno.UnsafeCallback(
  { parameters: ["pointer", "pointer"], result: "void" },
  (fut) => {
    if (!fut) return;
    const k = Deno.UnsafePointer.value(fut);
    if (!cbs.has(k)) return;
    muxer.unref();
    const [res, rej] = cbs.get(k)!;
    cbs.delete(k);
    let e = lib.fdb_future_get_error(fut);
    if (e) rej(new FDBError(e));
    const alloc = new ArrayBuffer(16);
    const outValueContainer = new PointerContainer(
      new BigUint64Array(alloc, 0, 1),
    );
    const outPresentAndLengthBuffer = new Uint32Array(alloc, 8, 2);
    const outPresentPointer = Deno.UnsafePointer.of(
      outPresentAndLengthBuffer,
    );
    const outLengthPointer = Deno.UnsafePointer.of(
      outPresentAndLengthBuffer.subarray(1),
    );
    e = lib.fdb_future_get_value(
      fut,
      outPresentPointer,
      outValueContainer.use(),
      outLengthPointer,
    );
    if (e) rej(new FDBError(e));
    const outPresent = outPresentAndLengthBuffer[0] !== 0;
    if (!outPresent) {
      return null;
    }
    res(Deno.UnsafePointerView.getArrayBuffer(
      outValueContainer.get(),
      outPresentAndLengthBuffer[1],
    ));
  },
);

export function wrapFuture(
  ptr: Deno.PointerValue,
): Promise<ArrayBuffer> {
  if (ptr === null) throw new Error("npe");
  let res: (b: ArrayBuffer) => void, rej: (err: unknown) => void;
  const p = new Promise<ArrayBuffer>((reso, reje) => (res = reso, rej = reje));
  futreg.register(p, ptr);

  const e = lib.fdb_future_set_callback(ptr, muxer.pointer, null);
  if (e) rej!(new FDBError(e));
  else {
    cbs.set(Deno.UnsafePointer.value(ptr), [res!, rej!]);
    muxer.ref();
  }
  return p;
}
