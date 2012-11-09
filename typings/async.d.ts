declare interface Async {
    forEach(arr: any[], iterator: (item, callback) => void, callback: (err) => void): void;
    series(tasks: any[], callback: (err) => void): void;
}

declare var async: Async;
