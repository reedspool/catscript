import { newCtx, consume, type Context, findDictionaryEntry } from "./index";
import { expect, test, describe, beforeEach } from "bun:test";

describe("Internals - consume", () => {
    let ctx: Context;
    beforeEach(() => {
        ctx = newCtx();
    });

    test("empty", () => {
        const result = consume({ ctx, until: "" });
        expect(result).toBe("");
    });

    test("simple string character", () => {
        ctx.inputStream = `abcdefgh`;
        const result = consume({ ctx, until: "h" });
        expect(result).toBe("abcdefg");
    });

    test("simple regex character", () => {
        ctx.inputStream = `abcdefgh`;
        const result = consume({ ctx, until: /h/ });
        expect(result).toBe("abcdefg");
    });

    test("If not found, the rest of the string is returned", () => {
        ctx.inputStream = `abcdefgh`;
        const result = consume({ ctx, until: "hh" });
        expect(result).toBe("abcdefgh");
    });

    test("From the center of the string", () => {
        ctx.inputStream = `abcdefgh`;
        ctx.inputStreamPointer = 4;
        const result = consume({ ctx, until: "h" });
        expect(result).toBe("efg");
    });
});

describe("Internals - findDictionaryEntry", () => {
    let ctx: Context;
    beforeEach(() => {
        ctx = newCtx();
    });

    test("core word", () => {
        const result = findDictionaryEntry({ ctx, word: "dup" });
        if (!result) throw new Error("Failed to find word");
        expect(result).toHaveProperty("name", "dup");
        expect(typeof result.impl).toBe("function");
    });

    test("non-existant word", () => {
        const result = findDictionaryEntry({ ctx, word: "abcd" });
        expect(result).toBeUndefined();
    });
});
