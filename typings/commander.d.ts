declare interface Commander {
    prompt(msg: string, fn: Function);
    password(msg: string, fn: Function);
    confirm(msg: string, fn: Function);
    choose(list, fn: Function);
    version(versionStr: string): Commander;
    option(args: string, msg: string, fn?: Function): Commander;
    parse(argv: string[]);
}
