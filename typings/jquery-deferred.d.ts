/*
    Interface for the JQuery promise, part of callbacks
*/
interface JQueryPromise {
    always(...alwaysCallbacks: any[]): JQueryDeferred;
    done(...doneCallbacks: any[]): JQueryDeferred;
    fail(...failCallbacks: any[]): JQueryDeferred;
    pipe(doneFilter?: (x: any) => any, failFilter?: (x: any) => any, progressFilter?: (x: any) => any): JQueryPromise;
    then(doneCallbacks: any, failCallbacks: any, progressCallbacks?: any): JQueryDeferred;
}

/*
    Interface for the JQuery deferred, part of callbacks
*/
interface JQueryDeferred extends JQueryPromise {
    notify(...args: any[]): JQueryDeferred;
    notifyWith(context: any, ...args: any[]): JQueryDeferred;

    pipe(doneFilter?: any, failFilter?: any, progressFilter?: any): JQueryPromise;
    progress(...progressCallbacks: any[]): JQueryDeferred;
    promise(target? ): JQueryDeferred;
    reject(...args: any[]): JQueryDeferred;
    rejectWith(context:any, ...args: any[]): JQueryDeferred;
    resolve(...args: any[]): JQueryDeferred;
    resolveWith(context:any, ...args: any[]): JQueryDeferred;
    state(): string;
    then(doneCallbacks: any, failCallbacks: any, progressCallbacks?: any): JQueryDeferred;
}

interface JQueryStatic {
    Deferred(): JQueryDeferred;
    when(...deferreds: any[]): JQueryPromise;
}

declare var jQuery: JQueryStatic;
