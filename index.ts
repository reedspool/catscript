/**
 * In Forth, the dictionary is a linear structure (because everything's linear
 * in computer memory). But in JavaScript we have the benefit and the challenge
 * of references to data in unknowable places. That is, we can't refer directly
 * to memory, but instead we get named slots. Translating the wisdom and
 * pragmatism of Forth to the Wild West of JavaScript is the fun and curse of
 * this endeavor.
 */
export type Dictionary = {
    name: string;
    previous: Dictionary | null;
    impl: ({ ctx }: { ctx: Context }) => void;
    compiled: (Dictionary["impl"] | unknown)[];
    isImmediate?: boolean;
};
let latest: Dictionary;
export type Context = {
    me: Element | unknown;
    parameterStack: unknown[];
    returnStack: {
        dictionaryEntry: Dictionary;
        i: number;
    }[];
    interpreterStack: {
        prevCompilationTarget: Context["compilationTarget"];
    }[];
    controlStack: unknown[];
    compilationTarget: Dictionary;
    inputStream: string;
    paused: boolean;
    halted: boolean;
    halt: () => Promise<void>;
    haltedPromise: Promise<unknown>;
    inputStreamPointer: number;
    pop: () => Context["parameterStack"][0];
    push: (...args: Context["parameterStack"]) => void;
    peek: () => Context["parameterStack"][0];
    peekReturnStack: () => Context["returnStack"][0];
    advanceCurrentFrame: (value?: number) => void;
    emit: typeof console.log;
};

// Only exported to be tested. Hope to get rid of this.
export function uncallableDictionaryImplementation(this: Dictionary) {
    throw new Error(`Uncallable dictionary entry '${this.name}' called`);
}

let anonCount = 0;
export const newCtx: () => Context = () => {
    let resolveHaltedPromise: () => void;
    const haltedPromise = new Promise<void>(
        (resolve) => (resolveHaltedPromise = resolve),
    );

    const BASE = define({
        name: `ANONYMOUS-${anonCount++}`,
        impl: uncallableDictionaryImplementation,
    });
    return {
        me: null,
        parameterStack: [],
        returnStack: [],
        interpreterStack: [],
        controlStack: [],
        inputStream: "",
        paused: false,
        halted: false,
        haltedPromise,
        halt() {
            this.halted = true;
            resolveHaltedPromise();
            return haltedPromise;
        },
        inputStreamPointer: 0,
        compilationTarget: BASE,
        pop() {
            if (this.parameterStack.length < 1)
                throw new Error("Stack underflow");
            return this.parameterStack.pop();
        },
        peek() {
            return this.parameterStack[this.parameterStack.length - 1];
        },
        push(...args: unknown[]) {
            this.parameterStack.push(...args);
        },
        // Unlike Jonesforth, when executing a word, we put all the relevant
        // current information at the top of the stack. In Jonesforth, there's only
        // one relevant piece of information, but we've got more.
        peekReturnStack() {
            const stackFrame = this.returnStack[this.returnStack.length - 1];
            if (!stackFrame) throw new Error("Return stack underflow");
            return stackFrame;
        },
        advanceCurrentFrame(value = 1) {
            const stackFrame = this.peekReturnStack();
            stackFrame.i += value;
        },
        emit: (...args) => {
            console.log(...args);
        },
    } satisfies Context;
};

// Jonesforth names all code (core) words with assembly labels so that other core
// words can call them by label instead of looking them up constantly. Looking
// them up in the dictionary isn't just a (slight?) performance hit. If we looked
// up the definition of core words by name, we might get words of the same name
// defined by users later. We don't want that for core functionality. So when
// a core word is defined, we also label it directly here.
let doneDefiningCoreWords = false;
export const coreWords: Record<Dictionary["name"], Dictionary> = {};

export function define({
    name,
    impl,
    isImmediate = false,
}: Omit<Dictionary, "previous" | "compiled">): Dictionary {
    // TODO: Right now, there's only one global dictionary which is shared
    //       across all contexts. Considering how this might be isolated to
    //       a context object. Seems wasteful to copy "core" functions like those
    //       defined in JavaScript below across many dictionaries.
    //       Maybe each dictionary could have its own dictionary which it searches
    //       first? Then I'd have to distinguish between which dictionary to apply
    //       a new word definition - doesn't seem to bad though.
    // @ts-ignore Add debug info. How could we extend the type of our function to
    //            include this?
    impl.__debug__originalWord = name;
    // TODO: Fix typescript later to allow no name instead and get rid of this special word
    const dictionaryEntry: Dictionary = {
        previous: latest,
        name,
        impl,
        isImmediate,
        compiled: [],
    };
    if (name.startsWith("ANONYMOUS")) {
        // Don't actually set latest, or a core word, just give it back
        return dictionaryEntry;
    }
    latest = dictionaryEntry;
    // TODO: When I looked at this, I had a thought about the above issue.
    if (!doneDefiningCoreWords) {
        if (name in coreWords)
            throw new Error(`Redefining core word '${name}'`);
        coreWords[name] = latest;
    }
    return dictionaryEntry;
}

export function coreWordImpl(name: Dictionary["name"]) {
    const dictionaryEntry = coreWords[name];
    if (!dictionaryEntry)
        throw new Error(`Missing core word implementation for '${name}'`);
    return dictionaryEntry.impl;
}

define({
    name: "swap",
    impl: ({ ctx }) => {
        const [a, b] = [ctx.pop(), ctx.pop()];
        ctx.push(a, b);
    },
});
define({
    name: "over",
    impl: ({ ctx }) => {
        const [a, b] = [ctx.pop(), ctx.pop()];
        ctx.push(b, a, b);
    },
});

define({
    name: "rot",
    impl: ({ ctx }) => {
        const [a, b, c] = [ctx.pop(), ctx.pop(), ctx.pop()];
        ctx.push(b, a, c);
    },
});

define({
    name: "-rot",
    impl: ({ ctx }) => {
        const [a, b, c] = [ctx.pop(), ctx.pop(), ctx.pop()];
        ctx.push(a, c, b);
    },
});
define({
    name: "dup",
    impl: ({ ctx }) => ctx.push(ctx.peek()),
});
define({
    name: "2dup",
    impl: ({ ctx }) => {
        const [a, b] = [ctx.pop(), ctx.pop()];
        ctx.push(b, a, b, a);
    },
});
define({
    name: "drop",
    impl: ({ ctx }) => ctx.pop(),
});
define({
    name: "'",
    isImmediate: true,
    impl: ({ ctx }) => {
        // Move cursor past the single blank space between
        ctx.inputStreamPointer++;
        const text = consume({ until: "'", including: true, ctx });
        ctx.compilationTarget.compiled.push(coreWordImpl("lit"));
        ctx.compilationTarget.compiled.push(text);
    },
});

define({
    name: "log",
    impl: ({ ctx }) => {
        ctx.emit(ctx.pop());
    },
});

define({
    name: ".s",
    impl: ({ ctx }) => {
        ctx.emit(
            `<${ctx.parameterStack.length}> ${ctx.parameterStack.join(" ")}`,
        );
    },
});

define({
    name: "typeof",
    impl: ({ ctx }) => {
        const [b, a] = [ctx.pop(), ctx.pop()];
        ctx.push(typeof a === b);
    },
});

define({
    name: "now",
    impl: ({ ctx }) => {
        ctx.push(Date.now());
    },
});

export function defineBinaryExactlyAsInJS({
    name,
}: {
    name: Dictionary["name"];
}) {
    const binary = new Function("a", "b", `return a ${name} b;`);
    define({
        name,
        impl: ({ ctx }) => {
            const [b, a] = [ctx.pop(), ctx.pop()];
            ctx.push(binary(a, b));
        },
    });
}

defineBinaryExactlyAsInJS({ name: "&&" });
defineBinaryExactlyAsInJS({ name: "||" });
defineBinaryExactlyAsInJS({ name: "==" });
defineBinaryExactlyAsInJS({ name: "===" });
defineBinaryExactlyAsInJS({ name: "+" });
defineBinaryExactlyAsInJS({ name: "-" });
defineBinaryExactlyAsInJS({ name: "*" });
defineBinaryExactlyAsInJS({ name: "/" });
defineBinaryExactlyAsInJS({ name: "<" });
defineBinaryExactlyAsInJS({ name: ">" });
defineBinaryExactlyAsInJS({ name: ">=" });
defineBinaryExactlyAsInJS({ name: "<=" });
defineBinaryExactlyAsInJS({ name: "instanceof" });

define({
    name: "quit",
    impl: ({ ctx }) => {
        // First, clear the return stack
        // TODO: This feels like absolute nonsense now. It used to be
        // clearing the return stack completely, but now it's just
        // clearing it almost arbitrarily to the first level.
        ctx.returnStack.length = 1;
        coreWordImpl("interpret")({ ctx });
    },
});

define({
    name: "word",
    // TODO: Make a test inside of a `:` definiton for this, does it do what I think it should? Maybe my idea of immediate is completely wrong now
    isImmediate: true,
    impl: ({ ctx }) => {
        const word = consume({
            until: /\s/,
            ignoreLeadingWhitespace: true,
            ctx,
        });

        ctx.push(word);
    },
});

define({
    name: "find",
    impl: ({ ctx }) => {
        const word = ctx.pop() as string;
        let entry: Dictionary | null = latest;

        while (entry) {
            if (entry.name == word) {
                ctx.push(entry);
                return;
            }
            entry = entry.previous;
        }

        ctx.push(undefined);
        return;
    },
});

define({
    name: "interpret",
    impl: ({ ctx }) => {
        if (ctx.inputStreamPointer >= ctx.inputStream.length) {
            // No input left to process
            ctx.halt();
            return;
        }

        coreWordImpl("word")({ ctx });
        const word = ctx.peek() as string;

        // Input only had whitespace, will halt on the next call to `execute`. Technically could achieve this by checking in the above halt
        // check, but...
        // TODO: What if we halt here instead? Does word/consume break with an empty input stream?
        if (!word.match(/\S/)) {
            ctx.pop();
            return;
        }

        coreWordImpl("find")({ ctx });
        const dictionaryEntry = ctx.pop() as Dictionary | undefined;

        if (!dictionaryEntry) {
            const primitiveMaybe = wordAsPrimitive({ word });

            if (primitiveMaybe.isPrimitive) {
                ctx.compilationTarget.compiled.push(coreWordImpl("lit"));
                ctx.compilationTarget.compiled.push(primitiveMaybe.value);
                return;
            }

            throw new Error(`Couldn't comprehend word '${word}'`);
        }

        if (dictionaryEntry.isImmediate) {
            return dictionaryEntry.impl({ ctx });
        } else {
            ctx.compilationTarget.compiled.push(dictionaryEntry.impl);
        }
    },
});

define({
    name: ":",
    isImmediate: true,
    impl: ({ ctx }) => {
        let dictionaryEntry: typeof latest;

        coreWordImpl("word")({ ctx });
        const name = ctx.pop() as string;

        define({
            name,
            impl: ({ ctx }) => {
                // In Jonesforth and other "indirect threaded Forths", this code would
                // be written in a different "codeword", often called "DOCOL" for "do
                // colon definition". CatScript always calls `impl`, so we use this with
                // a closure to `dictionaryEntry` to do what "DOCOL" does
                ctx.returnStack.push({
                    dictionaryEntry,
                    i: 0,
                });
            },
        });
        // `define` has now set `latest` to the new word, and that's the word we need
        // to execute later.
        dictionaryEntry = latest;
        dictionaryEntry.compiled = [];
        ctx.interpreterStack.push({
            prevCompilationTarget: ctx.compilationTarget,
        });
        ctx.compilationTarget = dictionaryEntry;
    },
});

define({
    name: "exit",
    impl: ({ ctx }) => {
        ctx.returnStack.pop();
    },
});

define({
    name: ";",
    isImmediate: true,
    impl: ({ ctx }) => {
        ctx.compilationTarget.compiled.push(coreWordImpl("exit"));

        const prevInterpreter = ctx.interpreterStack.pop();
        if (!prevInterpreter) {
            throw new Error("Interpreter stack underflow");
        }
        ctx.compilationTarget = prevInterpreter.prevCompilationTarget;
    },
});

define({
    name: "postpone",
    isImmediate: true,
    impl: ({ ctx }) => {
        coreWordImpl("word")({ ctx });
        coreWordImpl("find")({ ctx });
        const dictionaryEntry = ctx.pop() as Dictionary;

        // This replicates a lot of the logic structure from compileWord,
        // except it compiles the "compile time" semantics, i.e. it never
        // executes immediate words, just compiles them, and for non-immediate
        // words, it compiles in a function which compiles them.
        // This seems right a la https://forth-standard.org/standard/core/POSTPONE
        if (dictionaryEntry.isImmediate) {
            ctx.compilationTarget.compiled.push(dictionaryEntry.impl);
        } else {
            const impl: Dictionary["impl"] = ({ ctx }) => {
                ctx.compilationTarget.compiled.push(dictionaryEntry.impl);
            };
            ctx.compilationTarget.compiled.push(impl);
        }
    },
});

define({
    name: "immediate",
    isImmediate: true,
    impl: ({ ctx }) => {
        // In many Forths, immediate can or must come after a definition,
        // i.e. `: x ... ; immediate`,
        // but because of this Forth's "Always Be Compiling" strategy,
        // it must occur before the compilation target is unset
        ctx.compilationTarget.isImmediate = true;
    },
});

define({
    name: ",",
    impl: ({ ctx }) => ctx.compilationTarget.compiled.push(ctx.pop()),
});

// TODO: Standard Forth has a useful and particular meaning for `'`, aka `tick`,
//       which is to
//       push a pointer to the dictionary definiton (or CFA?) of the next word
//       onto the stack.
//       Problem I'm having is that I have too many quotation delimeters in use.
//       I like writing my HTML in MDX, and backtick `\`` has a special meaning
//       in Markdown. Also, I want to write code in this language in HTML attributes,
//       which are normally delimeted by double quotes. So all three normal string
//       quotation methods are already in use. One by MDX, one by Forth, and one
//       by HTML. Hmmm. I could write strings in parentheses or curly braces or
//       percent signs. I'm not sure what to do.
define({
    name: "tick",
    // TODO: This will only work in a word flagged `immediate`
    //       non-immediate impl should be possible via WORD, FIND, and >CFA according to Jonesforth
    impl: ({ ctx }) => {
        const { dictionaryEntry, i } = ctx.peekReturnStack();

        const compiled = dictionaryEntry.compiled[i];

        if (!compiled || typeof compiled !== "function")
            throw new Error("tick must be followed by a word");

        ctx.push(compiled);

        ctx.advanceCurrentFrame();
    },
});

define({
    name: "lit",
    impl: ({ ctx }) => {
        const { dictionaryEntry, i } = ctx.peekReturnStack();

        const literal = dictionaryEntry.compiled[i];

        ctx.push(literal);

        ctx.advanceCurrentFrame();
    },
});

define({
    name: "compileNow:",
    isImmediate: true,
    impl: ({ ctx }) => {
        coreWordImpl("word")({ ctx });
        const word = ctx.pop() as string;
        const primitiveMaybe = wordAsPrimitive({ word });
        if (!primitiveMaybe.isPrimitive) {
            throw new Error("compileNow: must be followed by a primitive");
        }

        ctx.compilationTarget.compiled.push(primitiveMaybe.value);
    },
});

define({
    name: "latest",
    impl: ({ ctx }) => {
        ctx.push(latest);
    },
});

define({
    name: "here",
    impl: ({ ctx }) => {
        // TODO: Maybe this doesn't make sense anymore?
        const dictionaryEntry = ctx.compilationTarget;
        const i = dictionaryEntry.compiled.length;
        // This shape merges the "return stack frame" and the "variable" types to
        // refer to a location within a dictionary entry's "compiled" data. In Forth,
        // this is much simpler since can point anywhere in linear memory!
        ctx.push({
            dictionaryEntry,
            i,
            getter: () => dictionaryEntry.compiled[i],
            setter: (_value: unknown) => (dictionaryEntry.compiled[i] = _value),
        });
    },
});

define({
    name: "-stackFrame",
    impl: ({ ctx }) => {
        const [b, a] = [ctx.pop(), ctx.pop()];

        // TODO: All this mess is just to assert that the parameters are the correct
        //       kind of objects so Typescript doesn't complain when I access the
        //       properties below. Maybe this is what typeguard functions are for?
        //       Even so, it's a sign that the idea of typescript with the mix of
        //       structured data and unknown data on the parameter stack is tenuous
        if (
            !a ||
            typeof a !== "object" ||
            !("dictionaryEntry" in a) ||
            !("i" in a) ||
            typeof a.i !== "number" ||
            !b ||
            typeof b !== "object" ||
            !("dictionaryEntry" in b) ||
            !("i" in b) ||
            typeof b.i !== "number"
        ) {
            throw new Error("`-stackFrame` requires two stackFrame parameters");
        }

        // Maybe there is a meaning for subtracting locations within different
        // dictionary entries, but I haven't thought of it
        if (a.dictionaryEntry !== b.dictionaryEntry) {
            throw new Error(
                "`-stackFrame` across different dictionary entries not supported",
            );
        }
        ctx.push(a.i - b.i);
    },
});

define({
    name: "branch",
    impl: ({ ctx }) => {
        const { dictionaryEntry, i } = ctx.peekReturnStack();

        const offset = dictionaryEntry.compiled[i];

        if (typeof offset !== "number" || Number.isNaN(offset)) {
            throw new Error("`branch` must be followed by a number");
        }

        ctx.advanceCurrentFrame(offset);
    },
});

define({
    name: "0branch",
    impl: ({ ctx }) => {
        const { dictionaryEntry, i } = ctx.peekReturnStack();

        const condition = ctx.pop();
        const offset = dictionaryEntry.compiled[i];

        if (typeof condition !== "number" || Number.isNaN(condition)) {
            throw new Error(
                `\`0branch\` found a non-number on the stack (${condition}) which indicates an error. If you want to use arbitrary values, try falsyBranch instead.`,
            );
        }
        if (typeof offset !== "number" || Number.isNaN(offset)) {
            throw new Error("`0branch` must be followed by a number");
        }

        // If we're not jumping to an calculated offset, then just hop once over the
        // following value where the offset sits
        ctx.advanceCurrentFrame(condition === 0 ? offset : 1);
    },
});

define({
    name: "falsyBranch",
    impl: ({ ctx }) => {
        const { dictionaryEntry, i } = ctx.peekReturnStack();

        const condition = ctx.pop();
        const offset = dictionaryEntry.compiled[i];

        if (typeof offset !== "number" || Number.isNaN(offset)) {
            throw new Error("`falsyBranch` must be followed by a number");
        }

        // If we're not jumping to an calculated offset, then just hop once over the
        // following value where the offset sits
        ctx.advanceCurrentFrame(!condition ? offset : 1);
    },
});

define({
    name: "var:",
    isImmediate: true,
    impl: ({ ctx }) => {
        coreWordImpl("word")({ ctx });
        const name = ctx.pop() as string;
        // This variable is actually going to be the
        // value of the variable, via JavaScript closures
        let value: unknown;
        define({
            name,
            impl: ({ ctx }) => {
                // Naming the variable puts this special
                // getter/setter object onto the stack
                // and then the @ word will access the getter
                // and the ! word will use the setter
                // TODO Could we use the dictionary entry object itself for this?
                const variable: Variable = {
                    getter: () => value,
                    setter: (_value: unknown) => (value = _value),
                };
                ctx.push(variable);
            },
        });
    },
});

type Variable = {
    getter: () => unknown;
    setter: (_value: unknown) => void;
};

define({
    name: "!",
    impl: ({ ctx }) => {
        const b = ctx.pop() as Variable;
        const a = ctx.pop();
        if (!b.setter || typeof b.setter !== "function")
            throw new Error("Can only use word '!' on a variable");
        b.setter(a);
    },
});

define({
    name: "@",
    impl: ({ ctx }) => {
        const a = ctx.pop() as Variable;
        if (!a.getter || typeof a.getter !== "function")
            throw new Error("Can only use word '@' on a variable");
        ctx.push(a.getter());
    },
});

define({
    name: "const:",
    isImmediate: true,
    impl: ({ ctx }) => {
        coreWordImpl("word")({ ctx });
        // This variable is actually going to be the
        // value of the variable, via JavaScript closures
        let value: unknown;
        const name = ctx.pop() as string;
        define({
            name,
            impl: ({ ctx }) => {
                ctx.push(value);
            },
        });
        const impl: Dictionary["impl"] = ({ ctx }) => {
            value = ctx.pop() as unknown;
        };
        ctx.compilationTarget.compiled.push(impl);
    },
});

define({
    name: "sleep",
    impl: ({ ctx }) => {
        const millis = ctx.pop() as number;
        // Pause execution and restart it after the number of milliseconds.
        ctx.paused = true;
        setTimeout(() => {
            ctx.paused = false;
            query({ ctx, execute: false });
        }, millis);
    },
});

define({
    name: "debugger",
    impl: ({ ctx }) => {
        console.log("Interpreter paused");
        // console.log("Context:", ctx)
        console.log(
            `Here is the input stream, with \`<--!-->\` marking the input stream pointer`,
        );
        console.log(
            `${ctx.inputStream.slice(
                0,
                ctx.inputStreamPointer,
            )}<--!-->${ctx.inputStream.slice(ctx.inputStreamPointer)}`,
        );
        debugger;
    },
});

define({
    name: "'debugger",
    isImmediate: true,
    impl: ({ ctx }) => {
        // TODO: DO NOT TURN ON FOR TESTING. LOCALLY, THIS CAUSES
        //       A HUGE DUMP TO CONSOLE.
        // console.log("Interpreter immediately paused with context:", ctx);
        console.log(
            `Here is the input stream, with \`<--!-->\` marking the input stream pointer`,
        );
        console.log(
            `${ctx.inputStream.slice(
                0,
                ctx.inputStreamPointer,
            )}<--!-->${ctx.inputStream.slice(ctx.inputStreamPointer)}`,
        );
        debugger;
    },
});

define({
    name: "(",
    isImmediate: true,
    impl: ({ ctx }) => {
        consume({ until: ")", including: true, ctx });
    },
});

define({
    name: ".",
    isImmediate: true,
    impl({ ctx }) {
        // Move cursor past the single blank space between
        ctx.inputStreamPointer++;
        coreWordImpl("word")({ ctx });
        const prop = ctx.pop() as string;

        const impl: Dictionary["impl"] = ({ ctx }) => {
            const obj = ctx.pop() as any;
            ctx.push(obj[prop]);
        };
        ctx.compilationTarget.compiled.push(impl);
    },
});

define({
    name: ".!",
    isImmediate: true,
    impl({ ctx }) {
        // Move cursor past the single blank space between
        ctx.inputStreamPointer++;
        coreWordImpl("word")({ ctx });
        const prop = ctx.pop() as string;

        const impl: Dictionary["impl"] = ({ ctx }) => {
            const obj = ctx.pop() as any;
            const value = ctx.pop() as any;
            obj[prop] = value;
        };
        ctx.compilationTarget.compiled.push(impl);
    },
});

define({
    name: "C",
    impl({ ctx }) {
        ctx.push(ctx);
    },
});

define({
    name: "throwNewError",
    impl({ ctx }) {
        const message = ctx.pop() as string;
        throw new Error(message);
    },
});

define({
    name: "globalThis",
    impl({ ctx }) {
        ctx.push(globalThis);
    },
});

define({
    name: "jsApply",
    impl({ ctx }) {
        const [fn, args] = [ctx.pop() as Function, ctx.pop() as Array<unknown>];
        ctx.push(fn.apply(undefined, args));
    },
});

define({
    name: "wordToFunc:",
    isImmediate: true,
    impl({ ctx }) {
        coreWordImpl("word")({ ctx });
        coreWordImpl("find")({ ctx });
        const dictionaryEntry = ctx.pop() as Dictionary;
        ctx.push(() => {
            const ctx = newCtx();
            ctx.returnStack.push({
                dictionaryEntry,
                i: 0,
            });
            // There is no inputStream to execute
            query({ ctx, execute: false });
            if (ctx.parameterStack.length > 0) return ctx.pop();
        });
    },
});

define({
    name: ".apply:",
    isImmediate: true,
    impl({ ctx }) {
        coreWordImpl("word")({ ctx });
        const fnName = ctx.pop() as string;
        const impl: Dictionary["impl"] = ({ ctx }) => {
            const [obj, args] = [
                ctx.pop() as unknown,
                ctx.pop() as Array<unknown>,
            ];
            const fn = (obj as Record<typeof fnName, Function>)[fnName!];
            ctx.push(fn.apply(obj, args));
        };

        ctx.compilationTarget.compiled.push(impl);
    },
});

export function findDictionaryEntry({
    word,
    ctx,
}: {
    word: Dictionary["name"];
    ctx: Context;
}) {
    ctx.push(word);
    coreWordImpl("find")({ ctx });
    const dictionaryEntry = ctx.pop() as Dictionary | undefined;
    return dictionaryEntry;
}

// Because a primitive value can be any of the falsy JS values, we can't signal
// failure to parse by returning a falsy. Instead wrap the return value in a
// non-primitive container with a flag and the value
// TODO Except that we aren't using undefined. Could make that and true and false
// normal words and have undefined mean not primitive here
function wordAsPrimitive({ word }: { word: Dictionary["name"] }) {
    let value;
    if (word.match(/^-?\d+$/)) {
        value = parseInt(word, 10);
    } else if (word.match(/^-?\d+(\.\d+)?$/)) {
        value = parseFloat(word);
    } else if (word === "true") {
        value = true;
    } else if (word === "false") {
        value = false;
    } else {
        return { isPrimitive: false };
    }

    return { isPrimitive: true, value };
}

// TODO I think this is now basically Jonesforth's "NEXT"?
function executeColonDefinition({ ctx }: { ctx: Context }) {
    const { dictionaryEntry, i } = ctx.peekReturnStack();
    ctx.advanceCurrentFrame();
    // If someone leaves off a `;`, e.g. `on click 1`, just exit normally
    if (i === dictionaryEntry.compiled.length) {
        coreWordImpl("exit")({ ctx });
        return;
    }
    const callable = dictionaryEntry.compiled[i];
    if (typeof callable !== "function")
        throw new Error("Attempted to execute a non-function definition");
    callable({ ctx });
}

export function consume({
    until,
    including,
    ctx,
    ignoreLeadingWhitespace,
}: {
    until: RegExp | string;
    including?: boolean;
    ctx: Context;
    ignoreLeadingWhitespace?: boolean;
}) {
    if (ignoreLeadingWhitespace) {
        consume({ until: /\S/, ctx });
    }
    let value = "";
    while (ctx.inputStreamPointer < ctx.inputStream.length) {
        const char = ctx.inputStream[ctx.inputStreamPointer];
        if (!char) throw new Error("Input stream overflow");
        if (typeof until === "string" && char === until) break;
        if (typeof until !== "string" && until.test(char)) break;
        ctx.inputStreamPointer++;
        // TODO I bet this could be optimized a lot simply by first searching for the first instance of until and then taking a substring.
        value += char;
    }
    if (including) ctx.inputStreamPointer++;
    // Strip out escape sequences
    value = value.replaceAll(
        /\\([^\\])/g,
        (_: string, nonEscapeChar: string) => nonEscapeChar,
    );
    return value;
}

define({
    name: "EXECUTE",
    isImmediate: true,
    impl({ ctx }) {
        ctx.returnStack.push({
            dictionaryEntry: ctx.compilationTarget,
            i: 0,
        });
    },
});

// If `execute`, then immediately execute after compiling
export function query({
    ctx,
    execute = true,
}: {
    ctx: Context;
    execute?: boolean;
}) {
    if (execute) {
        ctx.inputStream += " EXECUTE ";
    }

    // Unlike Jonesforth, don't begin with Quit because it's valid in CatScript to
    // run with a non-empty, meaningful return stack, as in the case of async code
    // which is resuming
    while (!ctx.halted && !ctx.paused) {
        if (ctx.returnStack.length !== 0) {
            executeColonDefinition({ ctx });
        } else {
            coreWordImpl("interpret")({ ctx });
        }
    }
}

// Words written in the language!
// TODO: It's probably a good idea to put these in a separately loaded file
//       for development to differentiate between errors in the above core
//       and this point when we feel we can start interpreting
query({
    ctx: {
        ...newCtx(),
        inputStream: `
  : ahead                here 0 , ;
  : <back                here -stackFrame , ;
  : if     immediate     postpone falsyBranch ahead ;
  : endif  immediate     here over -stackFrame swap ! ;
  : else   immediate     postpone branch ahead swap postpone endif ;
  : begin  immediate     here ;
  : until  immediate     postpone falsyBranch <back ;
  : again  immediate     postpone branch <back ;
  : repeat immediate     postpone again postpone endif ;
 `,
    },
});

/**
 * JavaScript stuff
 */
define({
    name: "[]",
    impl: ({ ctx }) => {
        ctx.push([]);
    },
});

define({
    name: "push",
    impl: ({ ctx }) => {
        const [item, array] = [ctx.pop(), ctx.pop() as Array<unknown>];
        array.push(item);
    },
});

define({
    name: "collect",
    impl: ({ ctx }) => {
        const [n] = [ctx.pop() as number];
        const array: unknown[] = [];
        for (let i = 0; i < n; i++) {
            array.unshift(ctx.pop());
        }
        ctx.push(array);
    },
});

define({
    name: "spread",
    impl: ({ ctx }) => {
        const [array] = [ctx.pop() as unknown[]];
        ctx.push(...array);
    },
});

define({
    name: "[",
    impl: ({ ctx }) => {
        const a = { __marker: true };
        ctx.push(a);
    },
});

define({
    name: "]",
    impl: ({ ctx }) => {
        const array = [];
        while (!(ctx.peek() as any).__marker) {
            array.unshift(ctx.pop());
        }

        ctx.pop(); // Ditch the marker
        ctx.push(array);
    },
});

define({
    name: "pop",
    impl: ({ ctx }) => {
        const [array] = [ctx.pop() as Array<unknown>];
        ctx.push(array.pop());
    },
});

define({
    name: "{}",
    impl: ({ ctx }) => {
        ctx.push({});
    },
});

// Get the first item in an array
define({
    name: "first",
    impl: ({ ctx }) => {
        const array = ctx.pop()! as Array<unknown>;
        ctx.push(array[0]);
    },
});

// Index into an array
define({
    name: "nth",
    impl: ({ ctx }) => {
        const n = ctx.pop() as number;
        const array = ctx.pop()! as Array<unknown>;
        ctx.push(array[n]);
    },
});

// Clone an array
define({
    name: "clone",
    impl: ({ ctx }) => {
        const array = ctx.pop() as Array<unknown>;
        if (!Array.isArray(array)) {
            throw new Error("Attempted to clone a non-array argument");
        }
        const clone = [...array];
        ctx.push(clone);
    },
});

define({
    name: ">control",
    impl: ({ ctx }) => {
        ctx.controlStack.push(ctx.pop());
    },
});

define({
    name: "control>",
    impl: ({ ctx }) => {
        ctx.push(ctx.controlStack.pop());
    },
});

// Loop over an array, pushing interstitial values to the return stack
define({
    name: "each",
    isImmediate: true,
    impl: ({ ctx }) => {
        ctx.compilationTarget.compiled.push(() => {
            if (!Array.isArray(ctx.peek())) {
                throw new Error("`each` requires an array argument");
            }
        });
        ctx.compilationTarget.compiled.push(coreWordImpl("clone"));
        ctx.compilationTarget.compiled.push(coreWordImpl(">control"));
        ctx.compilationTarget.compiled.push(coreWordImpl("lit"));
        ctx.compilationTarget.compiled.push(0);
        ctx.compilationTarget.compiled.push(coreWordImpl(">control"));

        const impl: Dictionary["impl"] = ({ ctx }) => {
            const index = ctx.controlStack.pop() as number;
            const array = ctx.controlStack.pop() as Array<unknown>;
            ctx.controlStack.push(array);
            ctx.controlStack.push(index);
            ctx.controlStack.push(array[index]);

            // Initial setup for the first iteration is complete, so jump to the
            // beginning of the loop body, which is just beyond the "every loop" stuff.
            ctx.advanceCurrentFrame(1);
        };
        ctx.compilationTarget.compiled.push(impl);

        // Push to the param stack the location where we need to jump back before
        // every loop
        coreWordImpl("here")({ ctx });
        // TODO: Why do we need an empty cell here? Off-by-one with the jumping back index?
        ctx.compilationTarget.compiled.push(null);
    },
});

define({
    name: "I",
    impl: ({ ctx }) => {
        const i = ctx.controlStack.pop();
        ctx.controlStack.push(i);
        ctx.push(i);
    },
});

define({
    name: "endeach",
    isImmediate: true,
    impl: ({ ctx }) => {
        coreWordImpl("here")({ ctx });
        coreWordImpl("-stackFrame")({ ctx });
        const offset = ctx.pop() as number;

        const impl: Dictionary["impl"] = ({ ctx }) => {
            ctx.controlStack.pop();
            const lastIndex = ctx.controlStack.pop() as number;
            const index = lastIndex + 1;
            const array = ctx.controlStack.pop() as Array<unknown>;

            // First, test if there are any more items in the array
            if (index >= array.length) {
                // Then let the interpreter proceed. We already cleaned out the control
                // stack, so there's no cleanup.
                return;
            }

            // There's more to do, so we need to put everything back and jump back
            ctx.controlStack.push(array);
            ctx.controlStack.push(index);
            ctx.controlStack.push(array[index]);

            // Jump back
            ctx.advanceCurrentFrame(offset);
        };

        ctx.compilationTarget.compiled.push(impl);
    },
});

define({
    name: "re/",
    isImmediate: true,
    impl: ({ ctx }) => {
        // Move cursor past the single blank space between
        ctx.inputStreamPointer++;
        // TODO: Handle escaped forward slashes (\/)
        const regexp = consume({ until: "/", including: true, ctx });
        ctx.compilationTarget.compiled.push(coreWordImpl("lit"));
        ctx.compilationTarget.compiled.push(new RegExp(regexp));
    },
});

define({
    name: "match",
    impl: ({ ctx }) => {
        const [str, regex] = [ctx.pop(), ctx.pop()];
        ctx.push((str as string).match(regex as RegExp));
    },
});

// Match a regular expression
define({
    name: "match/",
    isImmediate: true,
    impl: ({ ctx }) => {
        // Move cursor past the single blank space between
        ctx.inputStreamPointer++;
        // TODO: Handle escaped forward slashes (\/)
        const regexp = consume({ until: "/", including: true, ctx });
        ctx.compilationTarget.compiled.push(coreWordImpl("lit"));
        ctx.compilationTarget.compiled.push(new RegExp(regexp));
        ctx.compilationTarget.compiled.push(coreWordImpl("swap"));
        ctx.compilationTarget.compiled.push(coreWordImpl("match"));
    },
});

doneDefiningCoreWords = true;
