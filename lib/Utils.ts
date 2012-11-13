///<reference path='ensure.ts'/>

module Utils {
    private DefaultRetries: number = 3;
    private DefaultDelayBeforeRetry: number = 250; // 250 ms
        
    export function attempt(action: () => Promise, retries: number = DefaultRetries, delayBeforeRetry: number = DefaultDelayBeforeRetry)  : Promise {
        Ensure.argNotNull(action, "action");
        var deferred = Q.defer();
        var currentTry = 1;
        
        var retryAction = () => {
            action().then(
                deferred.resolve,
                function(err?) {
                    if (retries >= currentTry++) {
                        setTimeout(retryAction, delayBeforeRetry);
                    }
                    else {
                        deferred.reject(err);
                    }
                });
        };
        retryAction();
        return deferred.promise;
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
}

