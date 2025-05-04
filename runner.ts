// Run a catscript script from the command line e.g.
// bun runner.ts -f scriptname.catscript
import { parseArgs } from "util";
import { newCtx, query } from "./index";
//
// TODO: Would be cool to make this a standalone executable binary
//
//

const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
        file: {
            short: "f",
            type: "string",
            required: true,
        },
    },
    strict: true,
    allowPositionals: true,
});

const { file } = values;
const script = await Bun.file(file!).text();
const ctx = newCtx();
ctx.inputStream = script;
query({ ctx });
