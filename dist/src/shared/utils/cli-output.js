import { formatOutput } from './output.js';
export function cliOutput(result, pretty, exitOnError = true) {
    console.log(formatOutput(result, pretty));
    if (result.error && exitOnError)
        process.exit(1);
}
//# sourceMappingURL=cli-output.js.map