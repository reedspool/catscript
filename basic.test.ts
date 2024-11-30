import { newCtx, query, type Context } from "./index";
import {
    expect,
    test,
    describe,
    beforeEach,
    afterEach,
    spyOn,
    mock,
} from "bun:test";

type MyTests = Record<
    string,
    {
        input: Context["inputStream"];
        resultantStack: Context["parameterStack"];
    }
>;
describe("Core - Synchronous", () => {
    let ctx: Context;
    const tests: MyTests = {};
    beforeEach(() => {
        ctx = newCtx();
    });

    test("empty", () => {
        query({ ctx });
    });

    tests["Primitives are parsed as JS"] = {
        input: "-1 5 0 12345 2.2 2.00001 true false",
        resultantStack: [-1, 5, 0, 12345, 2.2, 2.00001, true, false],
    };

    tests["Strings aren't CatScript primitives but they end up as JS strings"] =
        {
            input: "' test string with spaces in it'",
            resultantStack: ["test string with spaces in it"],
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
    tests["immediate"] = {
        input: ": bury immediate tick lit , ' Bury' , tick swap , ; : pushCheck ' Top' bury ; pushCheck",
        resultantStack: ["Bury", "Top"],
    };
    tests["typeof"] = {
        input: "' test' ' string' typeof",
        resultantStack: [true],
    };
    tests["=="] = {
        input: "5 5 == ' a' ' a' ==",
        resultantStack: [true, true],
    };
    tests["==="] = {
        input: "5 5 === 5 ' 5' === ' a' ' a' ===",
        resultantStack: [true, false, true],
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

    tests["branch"] = {
        input: ": 3, immediate 3 , ; : branchy true branch 3, ' ❌1' ' ❌2' drop ; branchy ",
        resultantStack: [true],
    };

    tests["0 0branch"] = {
        input: ": branchy true 0 0branch 3, ' ❌1' ' ❌2' drop ; branchy",
        resultantStack: [true],
    };

    tests["1 0branch"] = {
        input: ": 4, immediate 4 , ; : branchy ' ❌1' 1 0branch 4, drop true ' ❌2' drop ; branchy",
        resultantStack: [true],
    };

    tests["Falsy falsyBranch"] = {
        input: ": branchy true false falsyBranch 3, ' ❌1' ; branchy",
        resultantStack: [true],
    };

    tests["Truthy falsyBranch"] = {
        input: ": branchy ' ❌1' true falsyBranch 3, drop true ; branchy",
        resultantStack: [true],
    };

    tests["true if"] = {
        input: ": iffy ' ❌' true if drop true endif ; iffy",
        resultantStack: [true],
    };

    tests["false if"] = {
        input: ": iffy true false if ' ❌' endif ; iffy",
        resultantStack: [true],
    };

    tests["true if/else"] = {
        input: ": iffy true if true else ' ❌' endif ; iffy",
        resultantStack: [true],
    };

    tests["false if/else"] = {
        input: ": iffy false if ' ❌' else true endif ; iffy",
        resultantStack: [true],
    };

    tests["begin/until"] = {
        input: ": countDown begin 1 - dup 1 < until ; 5 countDown 0 === true && ",
        resultantStack: [true],
    };

    tests["( comments )"] = {
        input: " : checky ( comment in definition ) true ; checky ( this is a comment, it can contain anything ✅ except a closing paren )",
        resultantStack: [true],
    };

    tests["match regular expressions"] = {
        input: "re/ e\\\\d+/ ' te123st' match first ' e123' ===",
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
        input: "C . inputStream '  true' + C .! inputStream",
        resultantStack: [true],
    };

    tests[".! operator in definition"] = {
        input: ": def C . inputStream '  true' + C .! inputStream ; def",
        resultantStack: [true],
    };

    tests["quit"] = {
        input: ": inner 42 quit ; : outer inner 33 ; outer true",
        resultantStack: [42, true],
    };

    tests["latest"] = {
        input: ": tempWord ; latest . name",
        resultantStack: ["tempWord"],
    };

    tests["variable"] = {
        input: "variable varz 5 varz ! varz @",
        resultantStack: [5],
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

    tests["[ 1 2 3 ]"] = {
        input: "[ 5 42 2 ]",
        resultantStack: [[5, 42, 2]],
    };

    tests["[ [ 1 2 ] 3 ]"] = {
        input: "[ [ 5 42 ] 2 ]",
        resultantStack: [[[5, 42], 2]],
    };

    tests["pop"] = {
        input: "[] dup 0 push dup 1 push dup pop",
        resultantStack: [[0], 1],
    };

    tests["nth"] = {
        input: "[] dup 3 push dup 4 push dup 5 push dup 1 nth",
        resultantStack: [[3, 4, 5], 4],
    };

    tests["clone"] = {
        input: "[] dup 3 push dup 4 push dup 5 push dup clone dup pop drop dup pop drop",
        resultantStack: [[3, 4, 5], [3]],
    };

    tests[">control and control>"] = {
        input: "5 >control 3 control> ",
        resultantStack: [3, 5],
    };

    tests["each"] = {
        input: "[] dup 3 push dup 5 push dup 7 push 0 swap : addall each I + endeach ; addall",
        resultantStack: [15],
    };

    tests["each - exiting out"] = {
        input: "[] dup 3 push dup 5 push dup 7 push 0 swap : addall each I + dup 7 > if exit endif endeach ; addall",
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
            await expect(ctx.haltedPromise).resolves.toBeUndefined();
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
            await expect(ctx.haltedPromise).resolves.toBeUndefined();
        });
    });
});

describe("Core - JavaScript", () => {
    let ctx: Context;
    beforeEach(() => {
        ctx = newCtx();
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
        expect(console.log).toHaveBeenCalledTimes(3);
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

    test("Incorrect usage of here", () => {
        ctx.inputStream = "here";
        expect(() => query({ ctx })).toThrowError(
            "Can't use `here` outside of a definition",
        );
    });

    test("Incorrect usage of -stackFrame", () => {
        ctx.inputStream = "5 5 -stackFrame";
        expect(() => query({ ctx })).toThrowError(
            "`-stackFrame` requires two stackFrame parameters",
        );
    });

    test("Another incorrect usage of -stackFrame", () => {
        ctx.inputStream =
            ": inner here ; immediate : outer1 inner ; outer1 : outer2 inner ; outer2 -stackFrame";
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
            "Can't use each outside of compilation",
        );
    });
});
