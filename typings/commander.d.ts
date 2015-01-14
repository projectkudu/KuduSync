declare module Commander {
    export function prompt(msg: string, fn: Function);
    export function password(msg: string, fn: Function);
    export function confirm(msg: string, fn: Function);
    export function choose(list, fn: Function);
    export function version(versionStr: string);
    export function option(args: string, msg: string, fn?: Function);
    export function parse(argv: string[]);
    export function usage(msg: string);
    export function help();
}
