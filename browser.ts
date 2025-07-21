import {
    newCtx,
    query,
    define,
    coreWordImpl,
    consume,
    type Dictionary,
    uncallableDictionaryImplementation,
} from "./index";

/**
 * Web/browser specific things
 */
export function load() {
    define({
        name: "document",
        impl: ({ ctx }) => {
            ctx.push(document);
        },
    });
    // Put the text (second in the parameter stack) into the innerText of the
    // element (first in the parameter stack)
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
            // Move cursor past the single blank space between
            ctx.inputStreamPointer++;
            const selector = consume({ until: "'", including: true, ctx });
            ctx.compilationTarget!.compiled!.push(coreWordImpl("lit"));
            ctx.compilationTarget!.compiled!.push(selector);
            ctx.compilationTarget!.compiled!.push(coreWordImpl("swap"));
            ctx.push("select");
            coreWordImpl("find")({ ctx });
            const dictionaryEntry = ctx.pop() as Dictionary;
            ctx.compilationTarget!.compiled!.push(dictionaryEntry.impl);
        },
    });

    // Add an event listener, like Hyperscript does. Works by defining an anonymous
    // dictionary entry.
    // Usage: `<a c="on click ' It worked!' me >text ;">`
    define({
        name: "on",
        isImmediate: true,
        impl: ({ ctx }) => {
            coreWordImpl("word")({ ctx });
            const eventName = ctx.pop() as string;

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
                name: `anonymous-on-${eventName}-handler`,
                previous: null,
                compiled: [],
                impl: uncallableDictionaryImplementation,
            };

            (ctx.me as Element).addEventListener(eventName, (event) => {
                const { target } = event;
                // When the event occurs, we will run an independent interpreter (new ctx)
                // with this anonymous dictionary entry already on the return stack. This
                // is almost exactly as if this were a colon definition named `x` and then
                // ran a program where `x` was the only word in the input stream.
                query({
                    ctx: {
                        ...newCtx(),
                        me: target,
                        executeAtEnd: false,
                        parameterStack: [event],
                        returnStack: [
                            {
                                dictionaryEntry,
                                i: 0,
                            },
                        ],
                    },
                });
            });

            ctx.compilationStack.push(ctx.compilationTarget);
            // Compile all words into this anonymous entry until `;`
            ctx.compilationTarget = dictionaryEntry;
        },
    });

    define({
        name: "addEventListener",
        impl: ({ ctx }) => {
            const [eventName, impl, target] = [
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
                name: `anonymous-addEventListener-${eventName}-handler`,
                previous: null,
                compiled: [impl],
                impl: uncallableDictionaryImplementation,
            };

            target.addEventListener(eventName, ({ target }) => {
                // When the event occurs, we will run an independent interpreter (new ctx)
                // with this anonymous dictionary entry already on the return stack. This
                // is almost exactly as if this were a colon definition named `x` and then
                // ran a program where `x` was the only word in the input stream.
                query({
                    ctx: {
                        ...newCtx(),
                        me: target,
                        executeAtEnd: false,
                        returnStack: [
                            {
                                dictionaryEntry,
                                i: 0,
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
    };

    // Stolen with love from Hyperscript https://hyperscript.org and converted to TS
    var scanBackwardsQuery = function (
        start: Node,
        root: Element | Document,
        match: string,
        wrap?: boolean,
    ): Element | undefined {
        var results = root.querySelectorAll(match);
        for (var i = results.length - 1; i >= 0; i--) {
            var elt = results[i];
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
    };

    define({
        name: "next",
        impl: ({ ctx }) => {
            const [element, selector] = [ctx.pop(), ctx.pop()];

            const result = scanForwardQuery(
                element as Element,
                document,
                selector!.toString(),
                false,
            );
            ctx.push(result);
        },
    });

    // I don't have a usecase for this and it's just here because the utility from Hyperscript came with this extra parameter and I'm doing it for coverage of the scanForwardQuery function. Probably more effective to make a test file just for the utility function
    define({
        name: "nextWrap",
        impl: ({ ctx }) => {
            const [element, selector] = [ctx.pop(), ctx.pop()];

            const result = scanForwardQuery(
                element as Element,
                document,
                selector!.toString(),
                true,
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
                false,
            );
            ctx.push(result);
        },
    });

    // I don't have a usecase for this and it's just here because the utility from Hyperscript came with this extra parameter and I'm doing it for coverage of the scanForwardQuery function. Probably more effective to make a test file just for the utility function
    define({
        name: "previousWrap",
        impl: ({ ctx }) => {
            const [element, selector] = [ctx.pop(), ctx.pop()];

            const result = scanBackwardsQuery(
                element as Element,
                document,
                selector!.toString(),
                true,
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
            console.error((error as Error).message);
            console.error(error);
            console.error(`Error in script:\n\n"${inputStream}"`);
            // TODO: DO NOT TURN ON FOR TESTING. LOCALLY, THIS CAUSES
            //       A HUGE DUMP TO CONSOLE.
            // console.error("Context after error", ctx);
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
        // textContent can be null if we selected a document or doctype, not a script
        const inputStream = script.textContent ?? "";
        const ctx = { ...newCtx(), me: script, inputStream };
        try {
            query({
                ctx,
            });
        } catch (error) {
            console.error((error as Error).message);
            console.error(error);
            console.error(`Error in script:\n\n"${inputStream}"`);
            // TODO: DO NOT TURN ON FOR TESTING. LOCALLY, THIS CAUSES
            //       A HUGE DUMP TO CONSOLE.
            // console.error("Context after error", ctx);
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
