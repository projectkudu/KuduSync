///<reference path='ensure.ts'/>

module Utils {
    private DefaultRetries: number = 3;
    private DefaultDelayBeforeRetry: number = 250; // 250 ms
    
    export function Resolved() : JQueryPromise { 
        return jQuery.Deferred().resolve().promise(); 
    }
        
    export function attempt(action: (callback: (err) => void) => void, retries: number = DefaultRetries, delayBeforeRetry: number = DefaultDelayBeforeRetry)  : JQueryPromise {
        Ensure.argNotNull(action, "action");
        var deferred = jQuery.Deferred(),
              currentTry = 1;
        
        var retryAction = () => {
            action(err => {
                if (err) {
                    if (retries >= currentTry++) {
                        setTimeout(retryAction, delayBeforeRetry);
                    } 
                    else {
                        deferred.rejectWith(null, [err]);
                    }
                }
                deferred.resolve();
                
            });
        };
        retryAction();
        return deferred.promise();
    }
    
    export function map(source: any[], callback: (element: any, index: Number) => any) : any[] {
        var result = []; 
        for (var i = 0; i < source.length; i++) {
            result.push(callback(source[i], i));
        }
        
        return result;
    }
    
    export function serialize(...source: {(): JQueryPromise; }[]) : JQueryPromise {
        if (source.length == 0) {
            throw new Error("The argument 'source' is empty.");
        }
        var current : JQueryPromise = source[0]();
        for (var i = 1; i < source.length; i++) {
            current = current.pipe(source[i]);
        }
        
        return current;
    }
}

