// const jsdom = require("jsdom");
import jsdom from "jsdom";

const { JSDOM } = jsdom;

import { initializeLilElement, ObservableVariable, ObservableVariableCompute, ObservableVariableMap } from './core';

const BARE_HTML_DOC = "<!doctype html><html><body></body></html>"
const bareDOM = () => new JSDOM(BARE_HTML_DOC);

test('ObservableVariable set number', () => {
    const ov = new ObservableVariable(1);
    ov.val += 1;
    expect(ov._value).toBe(2);
});
test('ObservableVariable set array', () => {
    const ov = new ObservableVariable([]);
    ov.val = [...ov.val, 1, 2];
    expect(ov._value).toEqual([1, 2]);
});
test('ObservableVariable set object', () => {
    const ov = new ObservableVariable({});
    ov.val = { ...ov.val, x: 1, n: { a: 1 } };
    expect(ov._value).toEqual({ x: 1, n: { a: 1 } });
});
test('ObservableVariable subscribe', done => {
    const ov = new ObservableVariable({ x: 1 });
    ov.subscribe((newVal) => {
        expect(newVal).toEqual({ x: 3 });
        done();
    });
    ov.val = { ...ov.val, x: 3 };
});
test('ObservableVariable unsubscribe', done => {
    const ov = new ObservableVariable(1);
    const cb = (newVal: any) => { expect(newVal).toBe(2); done(); }
    ov.subscribe(cb);
    ov.val += 1;
    ov.unsubscribe(cb); // Callback should not execute again
    ov.val += 1;
});
test('ObservableVariable map', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });

    const arr = [1, 2, 3];
    const ov = new ObservableVariable(arr);
    const ovm = ov.map((e: any, i: number, a: any[]) => {
        expect(a).toEqual(arr);
        expect(e).toBe(arr[i]);
        return LilElement('div', {});
    });

    ovm.observableVariable.val.forEach(ovm.callback);
});
test('ObservableVariable compute str', () => {
    const strVal = "String";
    const ov = new ObservableVariable(strVal);
    const ovc = ov.compute(val => `My: ${val}`); // expect My: String
    const computed = ovc.callback(ovc.observableVariable.val);
    expect(computed).toBe(`My: ${strVal}`)
});
test('ObservableVariable compute array', () => {
    const arr = [1, 2, 3, 4]
    const strVal = arr.join();
    const ov = new ObservableVariable(arr);
    const ovc = ov.compute(val => val.join()); // expect My: String
    const computed = ovc.callback(ovc.observableVariable.val);
    expect(computed).toBe(strVal);
});

test('LilElement children', () => {
    
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });

    const Div = LilElement('div', { textContent: "String" });
    const nested = LilElement('div',{},
        Div);

    expect(nested.childNodes.length).toBe(1);
    expect(nested.outerHTML).toBe("<div><div>String</div></div>")
});
test('LilElement id, class props', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });

    const Div = LilElement('div', { textContent: "String", id: "nestedmyid", className: "nestedmyclass" });
    const nested = LilElement('div', { id: "myid", className: "myclass" }, Div);

    expect(nested.childNodes.length).toBe(1);
    expect(nested.outerHTML).toBe('<div id="myid" class="myclass"><div id="nestedmyid" class="nestedmyclass">String</div></div>')
});
test('LilElement reactive update', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });

    const initStr = "MyText";
    const ov = new ObservableVariable(initStr);

    const Div = LilElement('div', { textContent: ov, id: "nestedmyid", className: "nestedmyclass" });
    const nested = LilElement('div', { id: "myid", className: "myclass" }, Div);

    expect(nested.outerHTML).toBe(`<div id="myid" class="myclass"><div id="nestedmyid" class="nestedmyclass">${initStr}</div></div>`)

    const newVal = "MyTextChanged";
    ov.val = newVal;

    expect(nested.outerHTML).toBe(`<div id="myid" class="myclass"><div id="nestedmyid" class="nestedmyclass">${newVal}</div></div>`)
});
test('LilElement reactive list', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });
    const arr = [1, 2, 3];
    const ov = new ObservableVariable(arr);

    const list = LilElement('ul', {},
        ov.map((e) => { return LilElement('li', { textContent: e }) })
    );

    const expectedLis = arr.map(e => `<li>${e}</li>`).join("");
    expect(list.outerHTML).toBe(`<ul>${expectedLis}</ul>`);
});
test('LilElement pass children as list of elements or variadic', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });

    const list1 = LilElement('ul', {}, [
        LilElement('li', { textContent: 'li:1' }),
        LilElement('li', { textContent: 'li:2' }),
        LilElement('li', { textContent: 'li:3' })
    ]);

    const list2 = LilElement('ul', {},
        LilElement('li', { textContent: 'li:1' }),
        LilElement('li', { textContent: 'li:2' }),
        LilElement('li', { textContent: 'li:3' })
    );

    expect(list1.outerHTML).toBe(list2.outerHTML);
});
test('LilElement reactive object binding', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });
    const obj = { email: "", password: "" };
    const ov = new ObservableVariable(obj);

    const view = LilElement('div', {},
        LilElement('span', { textContent: ov.compute(x => x.email) }),
        LilElement('br', {}),
        LilElement('span', { textContent: ov.compute(x => x.password) }),
    );

    expect(view.outerHTML).toBe(`<div><span></span><br><span></span></div>`);
    const email = "example@example.com";
    ov.val = { ...ov.val, email };
    expect(view.outerHTML).toBe(`<div><span>${email}</span><br><span></span></div>`);
    const password = "p4s5w0rd";
    ov.val = { ...ov.val, password };
    expect(view.outerHTML).toBe(`<div><span>${email}</span><br><span>${password}</span></div>`);
});
test.skip('LilElement reactive object binding', () => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });
    const obj = { email: "", password: "" };
    const ov = new ObservableVariable(obj);

    const email = new ObservableVariable("");

    // const emailOnChange = e => { ov.val = {...ov.val, email: e.target.value }; }
    const passwordOnChange = (e: Event) => { ov.val = { ...ov.val, password: e.target !== null ? (e.target as HTMLInputElement).value : "" }; }

    const view = LilElement('div', {},
        LilElement('input', { id: 'email' }),
        LilElement('input', { id: 'password', onchange: e => passwordOnChange(e) })
    );

    dom.window.document.body.append(view);


    // +-----------------------------------------------------+
    // | TODO: dispatch keypress events into inputs and then |
    // +-----------------------------------------------------+

    const dispatchEmailString = "example@example.com";
    expect(ov.val.email).toBe(dispatchEmailString);

    const dispatchPasswordString = "p4s5w0rd";
    expect(ov.val.password).toBe(dispatchPasswordString);
});
test('LilElement reactivity nested minicomponents', (done) => {
    const dom = bareDOM();
    const LilElement = initializeLilElement({ documentInstance: dom.window.document });

    function MiniApp({ inp, out }: { inp: ObservableVariable, out: ObservableVariable }) {
        const view = LilElement('div', {},
            LilElement('div', { textContent: inp }),
            LilElement('input', { type: "text", onchange: (e) => { out.val = e.target; } })
        );
        // Simulate onchange after a little delay
        setTimeout(() => {
            out.val = "Changed input"
        }, 300);
        return view;
    }

    function HigherApp(outobs: ObservableVariable) {
        const inobs = new ObservableVariable("Simple string");
        

        return LilElement('div', {},
            MiniApp({ inp: inobs, out: outobs })
        );
    }
    const outobs = new ObservableVariable("");
    const view = HigherApp(outobs);

    const exp1 = `<div><div><div>Simple string</div><input type="text"></div></div>`
    expect(view.outerHTML).toBe(exp1);

    setTimeout(() => {
        expect(outobs.val).toBe("Changed input");
        done();
    }, 900);
});
