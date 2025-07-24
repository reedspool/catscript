import {
    newCtx,
    query,
    type Context,
    type Dictionary,
    define,
    uncallableDictionaryImplementation,
} from "./index";
import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";

type MyTests = Record<
    string,
    {
        input: Context["inputStream"];
        resultantStack: Context["parameterStack"];
    }
>;
describe("Test utility", () => {
    test("uncallableDictionaryImplementation", () => {
        const dictionaryEntry: Dictionary = define({
            impl: uncallableDictionaryImplementation,
        });

        expect(() => dictionaryEntry.impl({ ctx: newCtx() })).toThrowError(
            /Uncallable dictionary entry 'anonymous-\d+' called/,
        );
    });
});
describe("Core - Synchronous", () => {
    let ctx: Context;
    const tests: MyTests = {};
    beforeEach(() => {
        ctx = newCtx();
    });

    tests["empty"] = {
        input: "",
        resultantStack: [],
    };

    tests["Primitives are parsed as JS"] = {
        input: "-1 5 0 12345 2.2 2.00001 true false undefined",
        resultantStack: [-1, 5, 0, 12345, 2.2, 2.00001, true, false, undefined],
    };

    tests["Strings aren't CatScript primitives but they end up as JS strings"] =
        {
            input: "' test string with spaces in it'",
            resultantStack: ["test string with spaces in it"],
        };

    tests[
        "Strings can contain anything except their delimeters (though escape sequences are stripped)"
    ] = {
        input: "' !@#$%^&*()-_=+[]{}\\|\";:\n<>,./?`~'",
        resultantStack: ['!@#$%^&*()-_=+[]{}|";:\n<>,./?`~'],
    };

    tests["addition"] = {
        input: "3 5 +",
        resultantStack: [8],
    };

    tests["subtraction"] = {
        input: "3 5 -",
        resultantStack: [-2],
    };
    tests["multiplication"] = {
        input: "13 25 *",
        resultantStack: [325],
    };
    tests["division"] = {
        input: "13 25 /",
        resultantStack: [0.52],
    };
    tests["swap"] = {
        input: "111 222 swap",
        resultantStack: [222, 111],
    };
    tests["dup"] = {
        input: "111 dup",
        resultantStack: [111, 111],
    };
    tests["2dup"] = {
        input: "111 222 2dup",
        resultantStack: [111, 222, 111, 222],
    };
    tests["drop"] = {
        input: "222 111 drop",
        resultantStack: [222],
    };
    tests["over"] = {
        input: "111 222 over",
        resultantStack: [111, 222, 111],
    };
    tests["rot"] = {
        input: "111 222 333 rot",
        resultantStack: [222, 333, 111],
    };
    tests["-rot"] = {
        input: "111 222 333 -rot",
        resultantStack: [333, 111, 222],
    };
    tests["|| ( boolean OR )"] = {
        input: "true false ||",
        resultantStack: [true],
    };
    tests["&& ( boolean AND )"] = {
        input: "1 0 &&",
        resultantStack: [0],
    };
    tests[": and ; ( single word )"] = {
        input: ": single 1 ; single",
        resultantStack: [1],
    };
    tests[": and ; ( multi word )"] = {
        input: ": multi 1 2 3 ; multi drop drop",
        resultantStack: [1],
    };
    tests["Defined word calls another defined word"] = {
        input: ": inner 3 ; : outer 4 inner ; outer",
        resultantStack: [4, 3],
    };
    tests["Defined word calls another defined word"] = {
        input: ": inner 3 ; : outer 4 inner ; outer",
        resultantStack: [4, 3],
    };
    tests["find"] = {
        input: ": findable 1 ; ' findable' find . name",
        resultantStack: ["findable"],
    };
    tests["word"] = {
        input: "word nowhitespace true",
        resultantStack: ["nowhitespace", true],
    };
    tests["word within `:`"] = {
        input: ": tryword word nowhitespace true ; tryword",
        resultantStack: ["nowhitespace", true],
    };
    tests["word within `:` but reads on usage"] = {
        input: ": tryword: immediate postpone word false drop true ; tryword: nowhitespace",
        resultantStack: ["nowhitespace", true],
    };
    tests["EXECUTE within :"] = {
        input: ": running 5 2 + EXECUTE ; true",
        resultantStack: [7, true],
    };
    tests["immediate and tick"] = {
        input: ": bury immediate tick lit , ' Bury' , tick swap , ; : pushCheck ' Top' bury ; pushCheck",
        resultantStack: ["Bury", "Top"],
    };
    tests["typeof"] = {
        input: "' test' ' string' typeof",
        resultantStack: [true],
    };
    tests["=="] = {
        input: "5 5 == ' a' ' a' == false ' ' == 5 ' 5' == [  ] ' ' ==",
        resultantStack: [true, true, true, true, true],
    };
    tests["==="] = {
        input: "5 5 == ' a' ' a' == false ' ' === 5 ' 5' === [  ] ' ' ===",
        resultantStack: [true, true, false, false, false],
    };
    tests["< and >"] = {
        input: "4 5 < 5 4 > && ",
        resultantStack: [true],
    };
    tests[">= and <="] = {
        input: "4 5 <= 4 4 <= && 5 4 >= 5 5 >= && && ",
        resultantStack: [true],
    };

    tests["Floats like JS"] = {
        input: "0.1 0.2 + dup 0.3 > swap 0.31 <",
        resultantStack: [true, true],
    };

    tests["now"] = {
        input: "now ' number' typeof now now <=",
        resultantStack: [true, true],
    };

    tests["here immediately & -stackFrame outside `:` definition"] = {
        input: ": hereNow immediate here ; hereNow false drop hereNow -stackFrame ",
        resultantStack: [-2],
    };

    tests["here immediately & -stackFrame within `:` definition"] = {
        input: ": hereNow immediate here ; : def hereNow false drop hereNow -stackFrame ; def",
        resultantStack: [-2],
    };

    tests["branch"] = {
        // Note the calculation has to account for the `lit` in front of each
        // string value, and the indexing begins after the `branch` call, on
        // the one compiled item from `compileNow: 5`
        input: "true branch compileNow: 3 ' ❌1' ' ❌2' true false drop ",
        resultantStack: [true, true],
    };

    tests["branch within `:`"] = {
        input: "false drop : branchy true branch compileNow: 2 ' ❌1' ' ❌2' drop ; branchy ",
        resultantStack: [true],
    };

    tests["0 0branch"] = {
        input: "true 0 0branch compileNow: 3 ' ❌1' ' ❌2' true false drop",
        resultantStack: [true, true],
    };

    tests["0 0branch within `:`"] = {
        input: "false drop : branchy true 0 0branch compileNow: 2 ' ❌1' ' ❌2' drop ; branchy",
        resultantStack: [true],
    };

    tests["1 0branch"] = {
        input: "true 1 0branch compileNow: 1 drop true ' ❌2' drop ",
        resultantStack: [true],
    };

    tests["1 0branch within `:`"] = {
        input: "false drop : 4, immediate 4 , ; : branchy ' ❌1' 1 0branch 4, drop true ' ❌2' drop ; branchy",
        resultantStack: [true],
    };

    tests["Falsy falsyBranch"] = {
        input: "true false falsyBranch compileNow: 2 ' ❌1' true false drop",
        resultantStack: [true, true],
    };

    tests["Falsy falsyBranch within `:`"] = {
        input: "false drop : branchy true false falsyBranch compileNow: 2 ' ❌1' ; branchy",
        resultantStack: [true],
    };

    tests["Truthy falsyBranch"] = {
        input: "' ❌1' true falsyBranch compileNow: 3 drop true ",
        resultantStack: [true],
    };

    tests["Truthy falsyBranch within `:`"] = {
        input: "false drop : branchy ' ❌1' true falsyBranch compileNow: 3 drop true ; branchy",
        resultantStack: [true],
    };

    tests["true if"] = {
        input: "' ❌' true if drop true endif false drop",
        resultantStack: [true],
    };

    tests["true if within `:`"] = {
        input: "false drop : iffy ' ❌' true if drop true endif ; iffy",
        resultantStack: [true],
    };

    tests["false if"] = {
        input: "true false if ' ❌' endif false drop",
        resultantStack: [true],
    };

    tests["false if within `:`"] = {
        input: "false drop : iffy true false if ' ❌' endif ; iffy",
        resultantStack: [true],
    };

    tests["true if/else"] = {
        input: "true if true else ' ❌' endif false drop",
        resultantStack: [true],
    };

    tests["true if/else within `:`"] = {
        input: "false drop : iffy true if true else ' ❌' endif ; iffy",
        resultantStack: [true],
    };

    tests["false if/else"] = {
        input: "false if ' ❌' else true endif ",
        resultantStack: [true],
    };

    tests["false if/else within `:`"] = {
        input: "false drop : iffy false if ' ❌' else true endif ; iffy",
        resultantStack: [true],
    };

    tests["begin/until"] = {
        input: "5 begin 1 - dup 1 < until 0 === true && ",
        resultantStack: [true],
    };

    tests["begin/until within `:`"] = {
        input: "false drop : countDown begin 1 - dup 1 < until ; 5 countDown 0 === true && ",
        resultantStack: [true],
    };

    tests["( comments )"] = {
        input: "true ( this is a comment, it can contain anything ✅ except a closing paren ) true",
        resultantStack: [true, true],
    };

    tests["( comments ) within `:`"] = {
        input: " : checky ( comment in definition ) true ; checky",
        resultantStack: [true],
    };

    tests["regular expressions and match"] = {
        input: "re/ e\\\\d+/ ' te123st' match first ' e123' ===",
        resultantStack: [true],
    };

    tests["regular expressions and match within : definition"] = {
        input: ": matchy re/ e\\\\d+/ swap match first ' e123' === ; ' te123st'  matchy",
        resultantStack: [true],
    };

    tests["match/ regular expressions parsed"] = {
        input: "' te123st' match/ e\\\\d+/ first ' e123' ===",
        resultantStack: [true],
    };

    tests["match/ regular expressions parsed within : definition"] = {
        input: ": matchy match/ e\\\\d+/ first ; ' te123st' matchy ' e123' ===",
        resultantStack: [true],
    };

    tests["C and . operators"] = {
        input: "5 C . parameterStack first ===",
        resultantStack: [true],
    };

    tests[".! operator"] = {
        input: "5 {} dup -rot .! test",
        resultantStack: [{ test: 5 }],
    };

    tests[".! operator in definition"] = {
        input: ": def 6 {} dup -rot .! test2 ; def",
        resultantStack: [{ test2: 6 }],
    };

    tests["quit"] = {
        input: ": inner 42 quit ; : outer inner 33 ; outer false",
        resultantStack: [42],
    };

    tests["latest"] = {
        input: ": tempWord ; latest . name",
        resultantStack: ["tempWord"],
    };

    tests["var:"] = {
        input: "var: varz 5 varz ! varz @",
        resultantStack: [5],
    };

    tests["const:"] = {
        input: "42 const: answer answer",
        resultantStack: [42],
    };

    tests["const: within `:`"] = {
        input: "false drop : test 42 const: answer answer ; test",
        resultantStack: [42],
    };

    tests["globalThis"] = {
        input: "globalThis",
        resultantStack: [globalThis],
    };

    tests["jsApply"] = {
        input: "[] dup 0 push globalThis . Math . cos jsApply",
        resultantStack: [1],
    };

    tests["[]"] = {
        input: "[]",
        resultantStack: [[]],
    };

    tests["{}"] = {
        input: "{}",
        resultantStack: [{}],
    };

    tests["push"] = {
        input: "[] dup 0 push",
        resultantStack: [[0]],
    };

    tests["collect"] = {
        input: "1 2 4 5 4 collect",
        resultantStack: [[1, 2, 4, 5]],
    };

    tests["array literal"] = {
        input: "[ 5 42 2 ]",
        resultantStack: [[5, 42, 2]],
    };

    tests["array literal nested"] = {
        input: "[ [ 5 42 ] 2 ]",
        resultantStack: [[[5, 42], 2]],
    };

    tests["spread"] = {
        input: "[ [ 5 42 ] 2 ] spread",
        resultantStack: [[5, 42], 2],
    };

    tests["pop"] = {
        input: "[ 0 1 ] dup pop",
        resultantStack: [[0], 1],
    };

    tests["nth"] = {
        input: "[ 3 4 5 ] dup 1 nth",
        resultantStack: [[3, 4, 5], 4],
    };

    tests["clone"] = {
        input: "[ 3 4 5 ] dup clone dup pop drop dup pop drop",
        resultantStack: [[3, 4, 5], [3]],
    };

    tests[">control and control>"] = {
        input: "5 >control 3 control> ",
        resultantStack: [3, 5],
    };

    tests["each"] = {
        input: "0 [ 3 5 7 ] : addall each I + endeach ; addall",
        resultantStack: [15],
    };

    tests["each - exiting out"] = {
        input: "0 [ 3 5 7 ] : addall each I + dup 7 > if exit endif endeach ; addall",
        resultantStack: [8],
    };

    Object.entries(tests).forEach(([key, { input, resultantStack }]) => {
        test(key, async () => {
            ctx.inputStream = input;
            query({ ctx });
            expect(ctx.parameterStack).toEqual(resultantStack);

            expect(ctx.halted).toBe(true);
            // Even though these are synchronous, the promise should still resolve
            // in the next event loop step. At time of writing, Bun crashes on this
            // test if the promise never resolves.
            expect(ctx.haltedPromise).resolves.toBeUndefined();
        });
    });
});

describe("Core - Asynchronous", () => {
    let ctx: Context;
    const tests: MyTests = {};
    beforeEach(() => {
        ctx = newCtx();
    });

    tests["sleep"] = {
        input: "now 5 sleep now swap - 4 >",
        resultantStack: [true],
    };
    tests["sleep within : definition"] = {
        input: ": sleepier now 5 sleep now swap - 4 > ; sleepier",
        resultantStack: [true],
    };

    Object.entries(tests).forEach(([key, { input, resultantStack }]) => {
        test(key, async () => {
            ctx.inputStream = input;
            query({ ctx });
            await ctx.haltedPromise;
            expect(ctx.parameterStack).toEqual(resultantStack);

            expect(ctx.halted).toBe(true);
            // Even though these are synchronous, the promise should still resolve
            // in the next event loop step. At time of writing, Bun crashes on this
            // test if the promise never resolves.
            expect(ctx.haltedPromise).resolves.toBeUndefined();
        });
    });
});

describe("Core - JavaScript", () => {
    let ctx: Context;
    beforeEach(() => {
        ctx = newCtx();
    });
    test(".apply:", () => {
        ctx.inputStream = "[ 3 4 ] C . obj .apply: func ";
        const ctxWithObj = ctx as unknown as { obj: { func: Function } };
        ctxWithObj.obj = {
            func: mock(function (this: (typeof ctxWithObj)["obj"]) {
                return this;
            }),
        };
        query({ ctx });
        expect(ctx.parameterStack).toHaveLength(1);
        expect(ctx.parameterStack[0]).toBe(ctxWithObj.obj);
        expect(ctxWithObj.obj.func).toHaveBeenCalledTimes(1);
        expect(ctxWithObj.obj.func).toHaveBeenCalledWith(3, 4);
    });

    test(".apply: in definition", () => {
        ctx.inputStream = ": apply [ 32 43 ] C . obj .apply: func ; apply";
        const ctxWithObj = ctx as unknown as { obj: { func: Function } };
        ctxWithObj.obj = {
            func: mock(function (this: (typeof ctxWithObj)["obj"]) {
                return this;
            }),
        };
        query({ ctx });
        expect(ctx.parameterStack).toHaveLength(1);
        expect(ctx.parameterStack[0]).toBe(ctxWithObj.obj);
        expect(ctxWithObj.obj.func).toHaveBeenCalledTimes(1);
        expect(ctxWithObj.obj.func).toHaveBeenCalledWith(32, 43);
    });

    test("wordToFunc:", () => {
        ctx.inputStream = ": addSome 40 2 + ; wordToFunc: addSome";
        query({ ctx });
        expect(ctx.parameterStack).toHaveLength(1);
        expect(typeof ctx.parameterStack[0]).toBe("function");
        const func = ctx.parameterStack[0];
        if (typeof func != "function") throw new Error("Expected a function");
        expect(func()).toEqual(42);
    });

    test("wordToFunc: with no return", () => {
        ctx.inputStream = ": nothing ; wordToFunc: nothing";
        query({ ctx });
        expect(ctx.parameterStack).toHaveLength(1);
        expect(typeof ctx.parameterStack[0]).toBe("function");
        const func = ctx.parameterStack[0];
        if (typeof func != "function") throw new Error("Expected a function");
        expect(func()).toEqual(undefined);
    });
});

describe("Core - mocked", () => {
    let ctx: Context;
    const consoleLog = console.log;
    beforeEach(() => {
        ctx = newCtx();

        console.log = mock();
    });
    afterEach(() => {
        console.log = consoleLog;
    });

    test("log", () => {
        ctx.inputStream = "42 log";
        query({ ctx });
        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith(42);
    });

    test(".s", () => {
        ctx.inputStream = "42 ' test' .s";
        query({ ctx });
        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith("<2> 42 test");
    });

    test("debugger", () => {
        ctx.inputStream = "debugger";
        query({ ctx });
        expect(console.log).toHaveBeenCalledTimes(3);
    });

    test("'debugger", () => {
        ctx.inputStream = "'debugger";
        query({ ctx });
        expect(console.log).toHaveBeenCalledTimes(2);
    });
});

describe("Core - errors", () => {
    let ctx: Context;
    const consoleError = console.error;
    const consoleLog = console.log;
    beforeEach(() => {
        ctx = newCtx();

        console.error = mock();
        console.log = mock();
    });
    afterEach(() => {
        console.error = consoleError;
        console.log = consoleLog;
    });

    test("throwNewError", () => {
        ctx.inputStream = "' Expected error!' throwNewError";
        expect(() => query({ ctx })).toThrowError("Expected error!");
    });

    test("Undefined word", () => {
        ctx.inputStream = "thisWordIsUndefined";
        expect(() => query({ ctx })).toThrowError();
    });

    test("Incorrect usage of -stackFrame", () => {
        ctx.inputStream = "5 5 -stackFrame";
        expect(() => query({ ctx })).toThrowError(
            "`-stackFrame` requires two stackFrame parameters",
        );
    });

    test("A second incorrect usage of -stackFrame", () => {
        ctx.inputStream =
            ": inner immediate here ; : outer1 inner ; outer1 : outer2 inner ; outer2 -stackFrame";
        expect(() => query({ ctx })).toThrowError(
            "`-stackFrame` across different dictionary entries not supported",
        );
    });

    test("Incorrect usage of branch", () => {
        ctx.inputStream = ": branchy branch ' f' ; branchy";
        expect(() => query({ ctx })).toThrowError(
            "`branch` must be followed by a number",
        );
    });

    test("Incorrect usage of 0branch", () => {
        ctx.inputStream = ": 0branchy ' f' 0branch ; 0branchy";
        expect(() => query({ ctx })).toThrowError(
            "`0branch` found a non-number on the stack (f) which indicates an error. If you want to use arbitrary values, try falsyBranch instead.",
        );
    });

    test("Another incorrect usage of 0branch", () => {
        ctx.inputStream = ": 0branchy 5 0branch ' f' ; 0branchy";
        expect(() => query({ ctx })).toThrowError(
            "`0branch` must be followed by a number",
        );
    });

    test("Incorrect usage of falsyBranch", () => {
        ctx.inputStream = ": falsyBranchy ' f' falsyBranch ; falsyBranchy";
        expect(() => query({ ctx })).toThrowError(
            "`falsyBranch` must be followed by a number",
        );
    });

    test("Incorrect usage of each", () => {
        ctx.inputStream = "each";
        expect(() => query({ ctx })).toThrowError(
            "`each` requires an array argument",
        );
    });

    test("Incorrect usage of `;`", () => {
        ctx.inputStream = ";";
        expect(() => query({ ctx })).toThrowError(
            "Compilation stack underflow",
        );
    });

    test("Incorrect usage of `compileNow:`", () => {
        ctx.inputStream = "compileNow:";
        expect(() => query({ ctx })).toThrowError(
            "compileNow: must be followed by a primitive",
        );
    });

    test("Incorrect usage of `clone`", () => {
        ctx.inputStream = "5 clone";
        expect(() => query({ ctx })).toThrowError(
            "Attempted to clone a non-array argument",
        );
    });
});
