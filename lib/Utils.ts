///<reference path='Ensure.ts'/>

module Utils {
    private DefaultRetries: number = 3;
    private DefaultDelayBeforeRetry: number = 250; // 250 ms
        
    export function attempt(action: () => Promise, retries: number = DefaultRetries, delayBeforeRetry: number = DefaultDelayBeforeRetry)  : Promise {
        Ensure.argNotNull(action, "action");
        var currentTry = 1;
        
        var retryAction = () => {
            return action().then(
                Q.resolve,
                function(err?) {
                    if (retries >= currentTry++) {
                        return Q.delay(Q.fcall(retryAction), delayBeforeRetry);
                    }
                    else {
                        return Q.reject(err);
                    }
                });
        };
        return retryAction();
    }
    
    export function map(source: any[], action: (element: any, index: Number) => any) : any[] {
        var results = []; 
        for (var i = 0; i < source.length; i++) {
            results.push(action(source[i], i));
        }
        
        return results;
    }

    export function serialize(...source: {(): Promise; }[]) : Promise {
        var result = Q.resolve();
        for (var i = 0; i < source.length; i++) {
            result = result.then(source[i]);
        }
        return result;
    }

    export function mapSerialized(source: any[], action: (element: any, index: Number) => Promise) : Promise {
        var result = Q.resolve();
        for (var i = 0; i < source.length; i++) {
            var func: any = {
                source: source[i],
                index: i,
                action: function () {
                    var self = this;
                    return function () {
                        return action(self.source, self.index);
                    }
                }
            };

            result = result.then(func.action());
        }

        return result;
    }

    export function mapParallelized(maxParallel: number, source: any[], action: (element: any, index: number) => Promise) : Promise {
        var parallelOperations = [];
        var result = Q.resolve();

        for (var i = 0; i < source.length; i++) {
            var singleOperation: any = {
                source: source[i],
                index: i,
                action: function () {
                    return action(this.source, this.index);
                }
            };

            parallelOperations.push(singleOperation);

            // Create a complex operation to run once reached maxParallel number of operations
            // Or this is the last operation
            if ((i % maxParallel) == (maxParallel - 1) || i == (source.length - 1)) {
                var complexOperation: any = {
                    parallelOperations: parallelOperations,
                    action: function () {
                        var self = this;
                        return function () {
                            var promises = [];

                            for (var j = 0; j < self.parallelOperations.length; j++) {
                                promises.push(self.parallelOperations[j].action());
                            }

                            return Q.all(promises);
                        }
                    }
                };

                result = result.then(complexOperation.action());
                parallelOperations = [];
            }
        }

        return result;
    }
}
exports.Utils = Utils;
