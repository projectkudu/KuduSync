/*
    Interface for the Q deferred, part of callbacks
*/
interface Promise {
    fin(callback: (e?: any) => void): Promise;
    fail(callback: (e?: any) => any): Promise;
    then(fulfilled_opt: (v?: any) => any, rejected_opt?: (e?: any) => any): Promise;
}

interface Deferred {
    promise: Promise;
    reject(arg?: any): void;
    resolve(arg?: any): void;
    node(): { (err: any): void; };
}

interface QStatic {
    defer(): Deferred;
    when(value: any, fulfilled_opt: (v?: any) => void, rejected_opt?: (e?: any) => void): Promise;
    resolve(value?: any): Promise;
    reject(value?: any): Promise;
    delay(action: Function, delay: Number): Promise;
    all(...promises: any[]): Promise;
    nfcall(nodeFunction: Function, ...args: any[]);
    fcall(nodeFunction: Function, thisp?: any, ...args: any[]);
}

declare var Q: QStatic;
