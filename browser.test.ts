import { newCtx, query, type Context, type Dictionary, define } from "./index";
import { load, runAttributes, globals } from "./browser.ts";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";

// For IDE formatting. See https://prettier.io/blog/2020/08/24/2.1.0.html
export const html: typeof String.raw = (templates, ...args) =>
    String.raw(templates, ...args);

load();
GlobalRegistrator.register();
describe("DOM Basics", () => {
    let ctx: Context;
    beforeEach(() => {
        ctx = { ...newCtx(), me: document };
    });
    test("DOM works", () => {
        document.body.innerHTML = html`<button>My button</button>`;
        const button = document.querySelector("button");
        expect(button?.innerText).toEqual("My button");
    });

    test("document", () => {
        ctx.inputStream = "document";
        query({ ctx });
        expect(ctx.parameterStack).toEqual([document]);
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
        ctx = newCtx();
        ctx.inputStream = "' clazz' C . me toggleClass";
        ctx.me = button;
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

    test("select' parsing word in a definition", () => {
        document.body.innerHTML = html`<span
            ><button class="clazz">My button</button></span
        >`;
        const span = document.querySelector("span");

        ctx.inputStream = ": selecty C . me select' button' first ; selecty";
        ctx.me = span;
        query({ ctx });
        expect(ctx.parameterStack.length).toEqual(1);
        expect((ctx.parameterStack[0] as Element).tagName).toEqual("BUTTON");
    });
    test("on terminated with ';'", () => {
        document.body.innerHTML = html`<span
            ><button class="clazz">My button</button></span
        >`;
        const button = document.querySelector("button");

        ctx.inputStream = "on click ' Success!' C . me >text ;";
        ctx.me = button;
        query({ ctx });
        button!.click();
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.innerHTML).toEqual("Success!");
    });
    test("on with no terminating ';'", () => {
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
    test("on after another statement", () => {
        document.body.innerHTML = html`<span><button>My button</button></span>`;
        const button = document.querySelector("button");

        ctx.inputStream =
            "' clazz' C . me addClass on click ' Success!' C . me >text";
        ctx.me = button;
        query({ ctx });
        button!.click();
        expect(ctx.parameterStack).toEqual([]);
        expect(button!.innerHTML).toEqual("Success!");
        expect(button!.classList.contains("clazz")).toBe(true);
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

    test("nextWrap", () => {
        document.body.innerHTML = html` <div>
                <span>Find me</span><span>Don't find me</span>
            </div>
            <button>start here</button>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' span' C . me nextWrap";
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

    test("previous", () => {
        document.body.innerHTML = html`<span
                ><button>start here</button><span>Don't find me</span></span
            ><span>Find me</span>`;
        const button = document.querySelector("button");

        ctx.inputStream = "' span' C . me previousWrap";
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

    test("on and emit", () => {
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

    test("runAttributes like hyperscript", () => {
        document.body.innerHTML = html`<div c="' ran 1' C . me >text">
                didn't run
            </div>
            <div c="' ran 2' C . me >text">didn't run</div>`;
        const targets = document.querySelectorAll("div");

        runAttributes();
        expect(targets[0]!.innerHTML).toEqual("ran 1");
        expect(targets[1]!.innerHTML).toEqual("ran 2");
    });

    test("run script tags of type catscript", () => {
        document.body.innerHTML = html`<script>
                This would error if it ran, but it doesn't
            </script>
            <script type="catscript"></script>
            <script type="catscript">
                ' ran succssfully' ' span' document select first >text
            </script>
            <span>Didn't run</span>`;

        runAttributes();
        const a = document.querySelector("span");
        expect(a!.innerHTML).toEqual("ran succssfully");
    });

    test("globals", () => {
        //@ts-ignore catscript doesn't exist on window
        expect(window.catscript).toBeUndefined();
        globals();
        //@ts-ignore catscript doesn't exist on window
        expect(window.catscript!.query).toBe(query);
        //@ts-ignore catscript doesn't exist on window
        expect(window.catscript!.newCtx).toBe(newCtx);
        //@ts-ignore catscript doesn't exist on window
        expect(window.catscript!.define).toBe(define);
        //@ts-ignore catscript doesn't exist on window
        expect(window.catscript!.runAttributes).toBe(runAttributes);
    });
});

describe("Mocked log", () => {
    let ctx: Context;
    const consoleLog = console.log;
    const consoleError = console.error;
    beforeEach(() => {
        ctx = newCtx();

        console.log = mock();
        console.error = mock();
    });
    afterEach(() => {
        console.log = consoleLog;
        console.error = consoleError;
    });

    test("log", () => {
        ctx.inputStream = "42 log";
        query({ ctx });
        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith(42);
    });

    test("runAttributes errors end up in console.error", () => {
        document.body.innerHTML = html`<div c="5 drop drop">didn't run</div>`;
        runAttributes();
        expect(console.error).toHaveBeenCalled();
        expect(console.error).toHaveBeenNthCalledWith(1, "Stack underflow");
    });

    test("errors in script tags of type catscript end up in console.error", () => {
        document.body.innerHTML = html`<script>
                This would error if it ran, but it doesn't
            </script>
            <script type="catscript"></script>
            <script type="catscript">
                drop
            </script>
            <span>Didn't run</span>`;

        runAttributes();
        expect(console.error).toHaveBeenCalled();
        expect(console.error).toHaveBeenNthCalledWith(1, "Stack underflow");
    });
});
