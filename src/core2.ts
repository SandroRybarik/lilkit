/// <reference lib="DOM" />

export interface SubscribeCallback<T> {
    (newVal: T): void;
}

export interface ObservableVariableSetCallback<T> {
    (current: T): T;
}

export class ObservableVariable<T> {
    public subscribers: SubscribeCallback<T>[];
    public value: T;

    constructor(value: T) {
        this.subscribers = [];
        this.value = value;
    }

    /**
     * Useful for setting objects and arrays.
     * Sets observable value and notify listeners.
     * @param cb - Sets observable value from `cb`
     */
    set(cb: ObservableVariableSetCallback<T>): void {
        this.value = cb(this.value);
        this.notifyAll();
    }

    /**
     * Useful for setting primitives and constants.
     * Sets observable value and notify listeners.
     * @param val primitive value
     */
    val(val: T): void {
        this.value = val;
        this.notifyAll();
    }

    get() {
        return this.value;
    }
    // compute = (obs, callback) => [ obs, callback ]
    compute(callback: (e: any) => any) {
        this.subscribe(callback)
    }
    // div({ textContent: compute(state, (x) => `${x}px` })
    subscribe(cb: SubscribeCallback<T>) {
        this.subscribers.push(cb);
    }

    unsubscribe(cb: SubscribeCallback<T>) {
        this.subscribers = this.subscribers.filter(s => cb !== s);
    }

    unsubscribeAll() {
        this.subscribers = [];
    }

    notifyAll() {
        this.subscribers.forEach(s => {
            s(this.value);
        });
    }
}

interface ObservableVariableComputeCallback<T> {
    (value: T): any;
}

export class ObservableVariableCompute<T> {
    public observableVariable: ObservableVariable<T>;
    public callback: ObservableVariableComputeCallback<T>;
    constructor(observableVariable: ObservableVariable<T>, callback: ObservableVariableComputeCallback<T>) {
        this.observableVariable = observableVariable;
        this.callback = callback;
    }
}

export interface ObservableVariableMapCallback<T> {
    // <T extends HTMLElement, K extends keyof HTMLElementTagNameMap>(value: any, idx: number, array: any[]): HTMLElementTagNameMap[K];
    // <T extends Node>(value: any, idx: number, array:any[]): T;
    (value: T, idx: number, array: T[]): HTMLElement;
}


export class ObservableVariableMap<T> {
    public observableVariable: ObservableVariable<T>;
    public callback: ObservableVariableMapCallback<T>;
    /**
     * 
     * @param {ObservableVariable} observableVariable 
     * @param {<Type extends HTMLElement>(value: any, idx: number, array: any[]) => Type} callback 
     */
    constructor(observableVariable: ObservableVariable<T>, callback: ObservableVariableMapCallback<T>) {
        if (!Array.isArray(observableVariable.get())) {
            throw new TypeError("Use of not an array type in ObservableVariable.map.");
        }
        /**
         * @type {ObservableVariable}
         */
        this.observableVariable = observableVariable;
        /**
         * @type {<Type extends HTMLElement>(value: any, idx: number, array: any[]) => Type}
         */
        this.callback = callback;
    }
}

export interface AnyProps {
    [key: string]: any | ObservableVariable<any>;
}
//  [key in keyof T]?: T[key] 

// type AnyHTMLElement = { [key: string]: any } & Partial<HTMLElement>;
export interface AnyPropsHTML extends AnyProps { }


export abstract class LilkitComponent {
    public props: AnyPropsHTML;
    constructor(props: AnyPropsHTML) {
        this.props = props;

        onDestroy(this.props, () => {
            this.onDestroy();
        });

        onMounted(this.props, () => {
            this.onMounted();
        });
    }

    onDestroy() {}
    onMounted() {}

    abstract render(): HTMLElement;
}


/**
 * 
 * @param {{[key: string]: any}} object - key values object
 * @param {HTMLElement} element - HTMLElement to bind on.
 * @returns {HTMLElement}
 */
function objectBindingToDOM(object: { [key: string]: any | ObservableVariable<any> }, children: (HTMLElement | LilkitComponent)[], element: HTMLElement): HTMLElement {

    // Lifecycle hook
    const $beforeDefault = () => { };
    const $before: () => void = object["$before"] || $beforeDefault;

    for (const [key, value] of Object.entries(object)) {

        if (key === '$before' || key === '$destroy' || key === '$mounted' || key === '$hook') {
            continue;
        }

        // Special map binding
        if (key === 'children' && value instanceof ObservableVariableMap) {
            if (children.length > 0) {
                throw new Error("Setting children property and adding children HTML Elements is not supported.")
            }
            const obs = value.observableVariable;
            const cb = value.callback;

            (obs.get() as any[]).forEach((c, i, arr) => {
                if (c instanceof LilkitComponent) {
                    element.append(cb(c.render(), i, arr));
                } else {

                    element.appendChild(cb(c, i, arr));
                }
            });

            obs.subscribe((newVal: (HTMLElement | LilkitComponent)[]) => {

                // @TODO: Hook all lifecycle hooks here
                // object.$hook
                
                // Remove all existing children first
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }


                // Append new children.
                newVal.forEach((c, i, arr) => {
                    if (c instanceof LilkitComponent) {
                        element.appendChild(cb(c.render(), i, arr));
                    } else {
                        element.appendChild(cb(c, i, arr));
                    }
                });
            });

            continue;
        }

        // Observable variable passed, we need to bind it.
        if (value instanceof ObservableVariable) {
            // Readonly HTML attributes are treated differently: children, dataset
            if (key === 'dataset') {
                if (typeof value.get() !== 'object') {
                    throw new Error("You're trying to bind non object value to dataset property. Make sure you're passing key-value object.")
                }

                for (const [k, v] of Object.entries(value.get() as DOMStringMap)) {
                    element.dataset[k] = v;
                }

                value.subscribe(newVal => {
                    for (const [k, v] of Object.entries(newVal as DOMStringMap)) {
                        element.dataset[k] = v;
                    }
                });
            } else {
                (element as { [key: string]: any })[key] = value.get();

                value.subscribe(newVal => {
                    (element as { [key: string]: any })[key] = newVal;
                });
            }
        }
        else if (value instanceof ObservableVariableCompute) {
            // We have special compute() variable binding
            const observable = value.observableVariable;
            const callback = value.callback;

            (element as { [key: string]: any })[key] = callback(observable.get());

            observable.subscribe((newVal: any) => {
                (element as { [key: string]: any })[key] = callback(newVal);
            });
        }
        // Non observable value passed
        else {
            // Readonly HTML attributes are treated differently: children, dataset

            if (key === 'children') {
                if (!Array.isArray(value)) {
                    throw new Error("You're trying to assign non-array value to children property. Make sure you're passing HTMLElement[].")
                } else if (children.length > 0) {
                    throw new Error("Setting children property and adding children HTML Elements is not supported.")
                }

                value.forEach(c => {
                    if (c instanceof LilkitComponent) {
                        element.append(c.render());
                    } else {
                        element.append(c);
                    }
                });
            } else
                if (key === 'dataset') {
                    if (typeof value !== 'object') {
                        throw new Error("You're trying to assign non object value to dataset property. Make sure you're passing key-value object.")
                    }

                    for (const [k, v] of Object.entries(value as DOMStringMap)) {
                        element.dataset[k] = v;
                    }
                } else {
                    (element as { [key: string]: any })[key] = value;
                }
        }


    }

    children.forEach(c => {
        if (c instanceof LilkitComponent) {
            element.append(c.render());
        } else {
            element.append(c);
        }
    });

    $before();
    return element;
}

interface Lifecycle {
    $hook: (event: 'destroy' | 'mounted', cb: () => void) => void;
    $destroy: () => void;
    $mounted: () => void;
}

export function lifecycle(): Lifecycle {
    const lc = new ObservableVariable({
        destroy: false,
        mounted: false,
    });

    return {
        $hook: (event: 'destroy' | 'mounted', cb: () => void) => {
            if (event === 'destroy') {
                lc.subscribe(() => {
                    cb();
                });
            } else {
                lc.subscribe(() => {
                    cb();
                });
            }
        },
        $destroy: () => {
            lc.set((x) => ({ ...x, destroy: true }))
            lc.unsubscribeAll();
        },
        $mounted: () => {
            lc.set((x) => ({ ...x, mounted: true }))
        }
    }
}

export function deploy(lc: Lifecycle, el: HTMLElement, target: HTMLElement) {
    target.appendChild(el);
    lc.$mounted();
}

export function onDestroy(props: AnyPropsHTML, cb: () => void) {
    if (props.$hook) {
        props.$hook('destroy', cb);
    }
}

export function onMounted(props: AnyPropsHTML, cb: () => void) {
    if (props.$hook) {
        props.$hook('mounted', cb);
    }
}


export function $compute<T>(obs: ObservableVariable<T>, cb: ObservableVariableComputeCallback<T>): ObservableVariableCompute<T> {
    return new ObservableVariableCompute(obs, cb);
}

export function $map<T>(obs: ObservableVariable<T>, cb: ObservableVariableMapCallback<T>): ObservableVariableMap<T> {
    return new ObservableVariableMap(obs, cb);
}

export function observable<T>(value: T): ObservableVariable<T> {
    return new ObservableVariable(value);
}


//----------------------------+
// Lilkit basic HTML elements |
//----------------------------+
export const a = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('a'));
export const abbr = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('abbr'));
export const address = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('address'));
export const area = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('area'));
export const article = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('article'));
export const aside = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('aside'));
export const audio = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('audio'));
export const b = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('b'));
export const base = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('base'));
export const bdi = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('bdi'));
export const bdo = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('bdo'));
export const blockquote = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('blockquote'));
export const body = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('body'));
export const br = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('br'));
export const button = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('button'));
export const canvas = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('canvas'));
export const caption = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('caption'));
export const cite = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('cite'));
export const code = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('code'));
export const col = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('col'));
export const colgroup = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('colgroup'));
export const data = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('data'));
export const datalist = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('datalist'));
export const dd = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('dd'));
export const del = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('del'));
export const details = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('details'));
export const dfn = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('dfn'));
export const dialog = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('dialog'));
export const dir = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('dir'));
export const div = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('div'));
export const dl = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('dl'));
export const dt = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('dt'));
export const em = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('em'));
export const embed = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('embed'));
export const fieldset = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('fieldset'));
export const figcaption = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('figcaption'));
export const figure = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('figure'));
export const font = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('font'));
export const footer = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('footer'));
export const form = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('form'));
export const frame = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('frame'));
export const frameset = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('frameset'));
export const h1 = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('h1'));
export const h2 = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('h2'));
export const h3 = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('h3'));
export const h4 = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('h4'));
export const h5 = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('h5'));
export const h6 = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('h6'));
export const head = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('head'));
export const header = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('header'));
export const hgroup = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('hgroup'));
export const hr = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('hr'));
export const html = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('html'));
export const i = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('i'));
export const iframe = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('iframe'));
export const img = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('img'));
export const input = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('input'));
export const ins = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('ins'));
export const kbd = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('kbd'));
export const label = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('label'));
export const legend = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('legend'));
export const li = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('li'));
export const link = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('link'));
export const main = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('main'));
export const map = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('map'));
export const mark = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('mark'));
export const marquee = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('marquee'));
export const menu = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('menu'));
export const meta = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('meta'));
export const meter = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('meter'));
export const nav = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('nav'));
export const noscript = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('noscript'));
export const object = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('object'));
export const ol = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('ol'));
export const optgroup = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('optgroup'));
export const option = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('option'));
export const output = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('output'));
export const p = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('p'));
export const param = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('param'));
export const picture = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('picture'));
export const pre = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('pre'));
export const progress = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('progress'));
export const q = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('q'));
export const rp = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('rp'));
export const rt = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('rt'));
export const ruby = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('ruby'));
export const s = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('s'));
export const samp = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('samp'));
export const script = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('script'));
export const section = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('section'));
export const select = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('select'));
export const slot = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('slot'));
export const small = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('small'));
export const source = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('source'));
export const span = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('span'));
export const strong = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('strong'));
export const style = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('style'));
export const sub = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('sub'));
export const summary = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('summary'));
export const sup = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('sup'));
export const table = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('table'));
export const tbody = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('tbody'));
export const td = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('td'));
export const template = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('template'));
export const textarea = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('textarea'));
export const tfoot = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('tfoot'));
export const th = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('th'));
export const thead = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('thead'));
export const time = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('time'));
export const title = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('title'));
export const tr = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('tr'));
export const track = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('track'));
export const u = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('u'));
export const ul = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('ul'));
export const var_ = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('var'));
export const video = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('video'));
export const wbr = (props: AnyPropsHTML, ...children: (LilkitComponent | HTMLElement)[]) => objectBindingToDOM(props, children, document.createElement('wbr'));
