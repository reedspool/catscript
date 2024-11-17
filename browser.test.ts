import { newCtx, query, type Context } from "./index";
import { load } from "./browser.ts";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test, describe, beforeEach } from "bun:test";

load();
GlobalRegistrator.register();
type MyTests = Record<
    string,
    {
        input: Context["inputStream"];
        resultantStack: Context["parameterStack"];
    }
>;
describe("DOM Basics", () => {
    let ctx: Context;
    const tests: MyTests = {};
    beforeEach(() => {
        ctx = { ...newCtx(), me: document };
    });
    test("DOM works", () => {
        document.body.innerHTML = `<button>My button</button>`;
        const button = document.querySelector("button");
        expect(button?.innerText).toEqual("My button");
    });

    test("Can access document from me", () => {
        ctx.inputStream = "C . me";
        query({ ctx });
        expect(ctx.parameterStack).toEqual([document]);
    });

    test(">text", () => {
        document.body.innerHTML = `<button>My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' It works!' C . me >text";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);

        expect(button!.innerText).toEqual("It works!");
    });

    test("text>", () => {
        document.body.innerHTML = `<button>My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "C . me text>";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual(["My button"]);
    });

    test("addClass", () => {
        document.body.innerHTML = `<button>My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' clazz' C . me addClass";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.classList.contains("clazz")).toBe(true);
    });

    test("removeClass", () => {
        document.body.innerHTML = `<button class="clazz">My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' clazz' C . me removeClass";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.classList.contains("clazz")).toBe(false);
    });

    test("toggleClass", () => {
        document.body.innerHTML = `<button class="clazz">My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' clazz' C . me toggleClass";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.classList.contains("clazz")).toBe(false);
        ctx.inputStream = "' clazz' C . me toggleClass";
        ctx.inputStreamPointer = 0;
        ctx.halted = false;
        query({ ctx });
        expect(button!.classList.contains("clazz")).toBe(true);
    });

    test("select", () => {
        document.body.innerHTML = `<span><button class="clazz">My button</button></span>`;
        const span = document.querySelector("span");

        ctx.inputStream = "' button' C . me select first";
        ctx.me = span;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).tagName).toEqual("BUTTON");
    });

});
