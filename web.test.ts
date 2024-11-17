import { newCtx, query, type Context } from "./index";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test, describe, beforeEach } from "bun:test";

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
        ctx = newCtx();
    });
    test("DOM works", () => {
        document.body.innerHTML = `<button>My button</button>`;
        const button = document.querySelector("button");
        expect(button?.innerText).toEqual("My button");
    });
});
