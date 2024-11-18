import { watch } from "fs/promises";
import { Glob } from "bun";

// Paths should be relative (no starting "/") from the root of the
// project. Precisely matching the end of the paths avoids accidental
// skips of future-created files
const KILL_LIST = ["package.json", "bun.lockb", "build.ts"];
const REBUILD_LIST = ["**/*.ts"];

const shouldWatch: boolean =
    typeof process.argv.find((arg) => arg.includes("--watch")) === "string";

async function buildAll() {
    console.log(`${new Date()} Building:`);
    const inputA = {
        entrypoints: ["./index.ts"],
        outdir: "./build",
    };
    await Bun.build(inputA);

    console.log(
        `1) ${inputA.entrypoints.join(", ").padEnd(12, " ")} ---> ${
            inputA.outdir
        }`,
    );

    const inputB = {
        entrypoints: ["./browser.ts"],
        outdir: "./build",
    };
    await Bun.build(inputB);
    console.log(
        `2) ${inputB.entrypoints.join(", ").padEnd(12, " ")} ---> ${
            inputB.outdir
        }`,
    );
}

if (shouldWatch) {
    const watcher = watch(import.meta.dir, { recursive: true });

    await buildAll();

    for await (const event of watcher) {
        const { filename } = event;
        // console.log(`Detected ${event} in ${filename}`);
        if (!filename) {
            console.log("Doing nothing as filename was empty");
            continue;
        }

        // Kill this process if any of these files change. This is useful
        // to let the outer system restart the process:
        //
        // E.g. in bash:
        //     `while true; do bun build.ts --watch ; echo 'Restarting'; done`
        //
        // Paths should be relative (no starting "/") from the root of the
        // project. Precisely matching the end of the paths avoids accidental
        // skips of future-created files
        if (KILL_LIST.find((path) => new Glob(path).match(filename))) {
            console.log(`Exiting because change detected in '${filename}'`);
            process.exit(1);
        }

        // Now, if it's NOT in our REBUILD LIST then skip it.
        if (!REBUILD_LIST.find((path) => new Glob(path).match(filename))) {
            // console.log(`Skipping ${filename}`);
            continue;
        }

        await buildAll();
        console.log(`Build script watching for changes...\n`);
    }
} else {
    await buildAll();
}
