import { newCtx, query, type Context } from "./index";
import { load } from "./browser.ts";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test, describe, beforeEach } from "bun:test";

// For IDE formatting. See https://prettier.io/blog/2020/08/24/2.1.0.html
export const html: typeof String.raw = (templates, ...args) =>
    String.raw(templates, ...args);

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
        document.body.innerHTML = html`<button>My button</button>`;
        const button = document.querySelector("button");
        expect(button?.innerText).toEqual("My button");
    });

    test("Can access document from me", () => {
        ctx.inputStream = "C . me";
        query({ ctx });
        expect(ctx.parameterStack).toEqual([document]);
    });

    test(">text", () => {
        document.body.innerHTML = html`<button>My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' It works!' C . me >text";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);

        expect(button!.innerText).toEqual("It works!");
    });

    test("text>", () => {
        document.body.innerHTML = html`<button>My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "C . me text>";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual(["My button"]);
    });

    test("addClass", () => {
        document.body.innerHTML = html`<button>My button</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' clazz' C . me addClass";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.classList.contains("clazz")).toBe(true);
    });

    test("removeClass", () => {
        document.body.innerHTML = html`<button class="clazz">
            My button
        </button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' clazz' C . me removeClass";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.classList.contains("clazz")).toBe(false);
    });

    test("toggleClass", () => {
        document.body.innerHTML = html`<button class="clazz">
            My button
        </button>`;
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
        document.body.innerHTML = html`<span
            ><button class="clazz">My button</button></span
        >`;
        const span = document.querySelector("span");

        ctx.inputStream = "' button' C . me select first";
        ctx.me = span;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).tagName).toEqual("BUTTON");
    });

    test("select' parsing word", () => {
        document.body.innerHTML = html`<span
            ><button class="clazz">My button</button></span
        >`;
        const span = document.querySelector("span");

        ctx.inputStream = "C . me select' button' first";
        ctx.me = span;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).tagName).toEqual("BUTTON");
    });

    test("on", () => {
        document.body.innerHTML = html`<span
            ><button class="clazz">My button</button></span
        >`;
        const button = document.querySelector("button");

        ctx.inputStream = "on click ' Success!' C . me >text";
        ctx.me = button;
        query({ ctx });
        button!.click();
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.innerHTML).toEqual("Success!");
    });

    test("next", () => {
        document.body.innerHTML = html`<span
            ><span>Don't find me</span><button>start here</button
            ><span>Find me</span></span
        >`;
        const button = document.querySelector("button");

        ctx.inputStream = "' span' C . me next";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).innerHTML).toEqual("Find me");
    });

    test("previous", () => {
        document.body.innerHTML = html`<span
            ><span>Find me</span><button>start here</button
            ><span>Don't find me</span></span
        >`;
        const button = document.querySelector("button");

        ctx.inputStream = "' span' C . me previous";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).innerHTML).toEqual("Find me");
    });

    test("closest", () => {
        document.body.innerHTML = html`<span
            ><span
                >Don't find me<span
                    >Find me<button>start here</button></span
                ></span
            ></span
        >`;
        const button = document.querySelector("button");

        ctx.inputStream = "' span' C . me closest";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).innerHTML).toStartWith(
            "Find me",
        );
    });

    test("on", () => {
        document.body.innerHTML = html`<span
            ><button class="clazz">My button</button></span
        >`;
        const button = document.querySelector("button");

        ctx.inputStream =
            "on click ' Success!' C . me >text ; C . me ' click' emit";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.innerHTML).toEqual("Success!");
    });

    test("addEventListener", () => {
        document.body.innerHTML = html`<span><button>My button</button></span>`;
        const button = document.querySelector("button");

        ctx.inputStream =
            ": onclick ' Whoops!' C . me >text ; C . me ' onclick' find . impl ' click' addEventListener C . me ' click' emit";
        ctx.me = button;
        query({ ctx });
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.innerHTML).toEqual("Whoops!");
    });
});
