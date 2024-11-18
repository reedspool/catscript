import {
    newCtx,
    query,
    define,
    coreWordImpl,
    consume,
    type Dictionary,
} from "./index";

/**
 * Web/browser specific things
 */
// Put the text (second in the parameter stack) into the innerText of the element
// (first in the parameter stack)
export function load() {
    define({
        name: ">text",
        impl: ({ ctx }) => {
            const [element, content] = [ctx.pop(), ctx.pop()];
            // TODO: I put this here because I ran into this error where
            //       `select` returns a NodeList, not a single element.
            //       Considering a toggle DEBUG_MODE which does extensive
            //       checks like this everywhere, which can be turned off for speed.
            if (!(element instanceof HTMLElement))
                throw new Error("Require an Element to set innerText");
            (element as HTMLElement).innerText = content!.toString();
        },
    });

    // Get the element's text
    define({
        name: "text>",
        impl: ({ ctx }) => {
            const element = ctx.pop();
            ctx.push((element as HTMLElement).innerText);
        },
    });

    // Add a class to an element
    define({
        name: "addClass",
        impl: ({ ctx }) => {
            const [element, clazz] = [ctx.pop(), ctx.pop()];
            (element as HTMLElement).classList.add(clazz!.toString());
        },
    });
    define({
        name: "removeClass",
        impl: ({ ctx }) => {
            const [element, clazz] = [ctx.pop(), ctx.pop()];
            (element as HTMLElement).classList.remove(clazz!.toString());
        },
    });
    define({
        name: "toggleClass",
        impl: ({ ctx }) => {
            const [element, clazz] = [ctx.pop(), ctx.pop()];
            (element as HTMLElement).classList.toggle(clazz!.toString());
        },
    });

    // Use querySelectorAll to push a NodeList onto the stack
    // Note: Use `first` to unpack the first element if you only want one
    // Usage: `' span' me select`
    define({
        name: "select",
        impl: ({ ctx }) => {
            const [element, selector] = [ctx.pop(), ctx.pop()];
            ctx.push(
                (element as Element).querySelectorAll(selector!.toString()),
            );
        },
    });

    // Like `select`, but slightly more convenient syntax
    // Usage `me select' span'`
    define({
        name: "select'",
        isImmediate: true,
        impl: ({ ctx }) => {
            // TODO: See note in definition of "'" about the state of the interpreter
            if (ctx.interpreter === "compileWord") {
                // Move cursor past the single blank space between
                ctx.inputStreamPointer++;
                const selector = consume({ until: "'", including: true, ctx });
                ctx.compilationTarget!.compiled!.push(coreWordImpl("lit"));
                ctx.compilationTarget!.compiled!.push(selector);
                ctx.compilationTarget!.compiled!.push(coreWordImpl("swap"));
                ctx.compilationTarget!.compiled!.push(coreWordImpl("select"));
            } else {
                const element = ctx.pop();
                // Move cursor past the single blank space between
                ctx.inputStreamPointer++;
                const selector = consume({ until: "'", including: true, ctx });
                ctx.push(selector);
                ctx.push(element);
                ctx.push("select");
                coreWordImpl("find")({ ctx });
                const dictionaryEntry = ctx.pop() as Dictionary;
                dictionaryEntry.impl({ ctx });
            }
        },
    });

    // Add an event listener, like Hyperscript does. Works by defining an anonymous
    // dictionary entry.
    // Usage: `<a c="on click ' It worked!' me >text ;">`
    define({
        name: "on",
        impl: ({ ctx }) => {
            coreWordImpl("word")({ ctx });
            const event = ctx.pop() as string;

            // By not using `define` we don't adjust the dictionary pointer `latest`.
            // This is a divergence from Forth implementations I've seen, and I'm calling
            // it an "anonymous dictionary entry".
            // NOTE: I did see someone describe an implementation which allowed
            //       control structures like if's and loops at the base level, and
            //       this might be how they did it. If any control structure
            //       called outside of a compiled definition initiated such a
            //       anonymous compilation, then it could be dropped when the
            //       control structure finishes.
            //       In fact, i'm struggling to see why everything on a REPL shouldn't
            //       just be getting compiled into a colon definiton AND ALSO getting
            //       executed until the instruction pointer goes to the end?
            const dictionaryEntry: Dictionary = {
                name: `anonymous-on-${event}-handler`,
                previous: null,
                compiled: [],
                impl() {
                    throw new Error(
                        `Uncallable dictionary entry ${this.name} called`,
                    );
                },
            };

            (ctx.me as Element).addEventListener(event, ({ target }) => {
                // When the event occurs, we will run an independent interpreter (new ctx)
                // with this anonymous dictionary entry already on the return stack. This
                // is almost exactly as if this were a colon definition named `x` and then
                // ran a program where `x` was the only word in the input stream.
                query({
                    ctx: {
                        ...newCtx(),
                        me: target,
                        returnStack: [
                            {
                                dictionaryEntry,
                                i: 0,
                                prevInterpreter: "queryWord", // Unused, I believe
                            },
                        ],
                    },
                });
            });

            ctx.interpreter = "compileWord";
            // Compile all words into this anonymous entry until `;`
            ctx.compilationTarget = dictionaryEntry;
        },
    });

    define({
        name: "addEventListener",
        impl: ({ ctx }) => {
            const [event, impl, target] = [
                ctx.pop() as string,
                ctx.pop() as Dictionary["impl"],
                ctx.pop() as Element,
            ];

            // By not using `define` we don't adjust the dictionary pointer `latest`.
            // This is a divergence from Forth implementations I've seen, and I'm calling
            // it an "anonymous dictionary entry".
            // NOTE: I did see someone describe an implementation which allowed
            //       control structures like if's and loops at the base level, and
            //       this might be how they did it. If any control structure
            //       called outside of a compiled definition initiated such a
            //       anonymous compilation, then it could be dropped when the
            //       control structure finishes.
            //       In fact, i'm struggling to see why everything on a REPL shouldn't
            //       just be getting compiled into a colon definiton AND ALSO getting
            //       executed until the instruction pointer goes to the end?
            const dictionaryEntry: Dictionary = {
                name: `anonymous-on-${event}-handler`,
                previous: null,
                compiled: [impl],
                impl() {
                    throw new Error(
                        `Uncallable dictionary entry ${this.name} called`,
                    );
                },
            };

            target.addEventListener(event, ({ target }) => {
                // When the event occurs, we will run an independent interpreter (new ctx)
                // with this anonymous dictionary entry already on the return stack. This
                // is almost exactly as if this were a colon definition named `x` and then
                // ran a program where `x` was the only word in the input stream.
                query({
                    ctx: {
                        ...newCtx(),
                        me: target,
                        returnStack: [
                            {
                                dictionaryEntry,
                                i: 0,
                                prevInterpreter: "queryWord", // Unused, I believe
                            },
                        ],
                    },
                });
            });
        },
    });

    // Stolen with love from Hyperscript https://hyperscript.org and converted to TS
    var scanForwardQuery = function (
        start: Node,
        root: Element | Document,
        match: string,
        wrap?: boolean,
    ): Element | undefined {
        var results = root.querySelectorAll(match);
        for (var i = 0; i < results.length; i++) {
            var elt = results[i];
            if (!elt) return;
            if (
                elt.compareDocumentPosition(start) ===
                Node.DOCUMENT_POSITION_PRECEDING
            ) {
                return elt;
            }
        }
        if (wrap) {
            return results[0];
        }

        return;
    };

    var scanBackwardsQuery = function (
        start: Node,
        root: Element | Document,
        match: string,
        wrap?: boolean,
    ): Element | undefined {
        var results = root.querySelectorAll(match);
        for (var i = results.length - 1; i >= 0; i--) {
            var elt = results[i];
            if (!elt) return;
            if (
                elt.compareDocumentPosition(start) ===
                Node.DOCUMENT_POSITION_FOLLOWING
            ) {
                return elt;
            }
        }
        if (wrap) {
            return results[results.length - 1];
        }

        return;
    };

    var scanForwardArray = function (
        start: unknown,
        array: Array<Element>,
        match: Parameters<typeof HTMLElement.prototype.matches>[0],
        wrap?: Boolean,
    ): Element | undefined {
        var matches: Array<Element> = [];
        array.forEach(function (elt) {
            if (elt.matches(match) || elt === start) {
                matches.push(elt);
            }
        });
        for (var i = 0; i < matches.length - 1; i++) {
            var elt = matches[i];
            if (elt === start) {
                return matches[i + 1];
            }
        }
        if (wrap) {
            var first = matches[0];
            if (first && first.matches(match)) {
                return first;
            }
        }

        return;
    };

    var scanBackwardsArray = function (
        start: unknown,
        array: Array<Element>,
        match: Parameters<typeof HTMLElement.prototype.matches>[0],
        wrap?: Boolean,
    ): Element | undefined {
        return scanForwardArray(
            start,
            Array.from(array).reverse(),
            match,
            wrap,
        );
    };

    define({
        name: "next",
        impl: ({ ctx }) => {
            const [element, selector] = [ctx.pop(), ctx.pop()];

            const result = scanForwardQuery(
                element as Element,
                document,
                selector!.toString(),
            );
            ctx.push(result);
        },
    });

    define({
        name: "previous",
        impl: ({ ctx }) => {
            const [element, selector] = [ctx.pop(), ctx.pop()];

            const result = scanBackwardsQuery(
                element as Element,
                document,
                selector!.toString(),
            );
            ctx.push(result);
        },
    });

    // Find the closest parent element which matches the selector
    define({
        name: "closest",
        impl: ({ ctx }) => {
            const [element, selector] = [
                ctx.pop() as Element,
                ctx.pop() as string,
            ];
            const result = element.parentElement!.closest(selector);
            ctx.push(result);
        },
    });

    // Emit the named event
    // Usage: `me ' click' emit`
    // This is probably confusing for Forth people because there `emit` prints a char
    define({
        name: "emit",
        impl: ({ ctx }) => {
            const [event, element] = [
                ctx.pop() as string,
                ctx.pop() as Element,
            ];
            element.dispatchEvent(
                new CustomEvent(event, {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        },
    });
}

export function globals() {
    // For any HTML element on the page with a `c` attribute, execute the value of
    // that attribute. This intentionally emulates Hyperscript's `_` or `data-script`
    // attributes.

    window.addEventListener("DOMContentLoaded", runAttributes);
    //@ts-ignore catscript doesn't exist on window
    window.catscript = {
        runAttributes,
        query,
        newCtx,
        define,
    };
}

export function runAttributes() {
    document.querySelectorAll("[c]").forEach((el) => {
        const inputStream = el.getAttribute("c")!;
        const ctx = { ...newCtx(), me: el, inputStream };
        try {
            query({
                ctx,
            });
        } catch (error) {
            console.error(`Error in script:\n\n"${inputStream}"`);
            console.error(error);
            console.error("Context after error", ctx);
            console.error(
                `Here is the input stream, with \`<--!-->\` marking the input stream pointer`,
            );
            console.error(
                `${ctx.inputStream.slice(
                    0,
                    ctx.inputStreamPointer,
                )}<--!-->${ctx.inputStream.slice(ctx.inputStreamPointer)}`,
            );
        }
    });

    document.querySelectorAll("script[type*=catscript]").forEach((script) => {
        const inputStream = script.textContent;
        if (inputStream === null) {
            console.warn("Skipping script with null textContent", script);
            return;
        }
        const ctx = { ...newCtx(), me: script, inputStream };
        try {
            query({
                ctx,
            });
        } catch (error) {
            console.error(`Error in script:\n\n"${inputStream}"`);
            console.error(error);
            console.error("Context after error", ctx);
            console.error(
                `Here is the input stream, with \`<--!-->\` marking the input stream pointer`,
            );
            console.error(
                `${ctx.inputStream.slice(
                    0,
                    ctx.inputStreamPointer,
                )}<--!-->${ctx.inputStream.slice(ctx.inputStreamPointer)}`,
            );
        }
    });
}
