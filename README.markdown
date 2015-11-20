### KuduSync

Tool for syncing files for deployment, will only copy changed files and delete files that don't exist in the destination but only if they were part of the previous deployment.

This is the node.js version of [KuduSync.NET](https://github.com/projectkudu/KuduSync.NET).

Install from npm - `npm install -g kudusync`


### Usage

kudusync `-f [source path] -t [destination path] -n [path to next manifest path] -p [path to current manifest path] -i <paths to ignore delimited by ;>`

The tool will sync files from the `[source path]` to the `[destination path]` using the manifest file in `[path to current manifest path]` to help determine what was added/removed and will write the new manifest file at `[path to current manifest path]`.
Paths in `<paths to ignore>` will be ignored in the process


### License

[Apache License 2.0](https://github.com/projectkudu/kudu/blob/master/LICENSE.txt)


### Questions?

You can use the [forum](http://social.msdn.microsoft.com/Forums/en-US/azuregit/threads), chat on [JabbR](https://jabbr.net/#/rooms/kudu), or open issues in this repository.

This project is under the benevolent umbrella of the [.NET Foundation](http://www.dotnetfoundation.org/).
