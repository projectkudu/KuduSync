///<reference path='header.ts'/>

module Ensure {
    export function argNotNull(arg, argName: string) {
        if (arg === null || arg === undefined) {
            throw new Error("The argument '" + argName + "' is null");
        }
    }
}
