///<reference path='ensure.ts'/>

var DefaultRetries: number = 3;
var DefaultDelayBeforeRetry: number = 250; // 250 ms

function attempt(action: (callback: (err) => void) => void, callback: (err) => void, retries: number = DefaultRetries, delayBeforeRetry: number = DefaultDelayBeforeRetry, currentTry: number = 1) {
    Ensure.argNotNull(action, "action");
    Ensure.argNotNull(callback, "callback");

    action((err) => {
        if (err && retries >= currentTry) {
            setTimeout(
                () => attempt(action, callback, retries, delayBeforeRetry, currentTry + 1),
                delayBeforeRetry);

            return;
        }

        if (err) {
            log("Error: Failed operation after " + retries + " retries.");
        }

        callback(err);
    });
}
