/// <reference lib="DOM" />

export type LilkitAttributes<T> = {
    [key in keyof T]?: T[key] | ObservableVariable | ObservableVariableMap | ObservableVariableCompute;
};

export interface ObservableVariableMapCallback {
    // <T extends HTMLElement, K extends keyof HTMLElementTagNameMap>(value: any, idx: number, array: any[]): HTMLElementTagNameMap[K];
    // <T extends Node>(value: any, idx: number, array:any[]): T;
    (value: any, idx: number, array: any[]): HTMLElement;
}

export class ObservableVariableMap {
    public observableVariable: ObservableVariable;
    public callback: ObservableVariableMapCallback;
    /**
     * 
     * @param {ObservableVariable} observableVariable 
     * @param {<Type extends HTMLElement>(value: any, idx: number, array: any[]) => Type} callback 
     */
    constructor(observableVariable: ObservableVariable, callback: ObservableVariableMapCallback) {
        if (!Array.isArray(observableVariable.val)) {
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

export class ObservableVariableCompute {
    public observableVariable: ObservableVariable;
    public callback: (value: any) => any;
    constructor(observableVariable: ObservableVariable, callback: (value: any) => any) {
        this.observableVariable = observableVariable;
        this.callback = callback;
    }
}

export class ObservableVariable {
    public _value: any;
    public _observers: ((newValue: any) => void)[];
    constructor(initialValue: any) {
        this._value = initialValue;
        this._observers = [];
    }

    set val(v: any) {
        this._value = v;
        this.notifyAll(v);
    }

    get val(): any {
        return this._value;
    }

    map(cb: ObservableVariableMapCallback) {
        return new ObservableVariableMap(this, cb);
    }

    compute(cb: (value: any) => any) {
        return new ObservableVariableCompute(this, cb);
    }

    subscribe(callback: (newValue: any) => void) {
        this._observers.push(callback);
    }

    unsubscribe(callback: (newValue: any) => void) {
        this._observers = this._observers.filter(o => o !== callback);
    }

    notifyAll(v: any) {
        for (const cb of this._observers) {
            cb(v);
        }
    }
}


export abstract class LilComponent {
    public props: object;
    public children: HTMLElement[];
    constructor(props: object, ...children: HTMLElement[]) {
        this.props = props;
        this.children = children;
    }

    abstract render(): HTMLElement;
}

export abstract class LilPlainComponent {
    abstract render(): HTMLElement;
}


export interface LilElementInitConfig {
    documentInstance: Document;
}

export const fragment = (...children: Array<HTMLElement>): DocumentFragment => {
    const frag = document.createDocumentFragment();

    if (children.length <= 0) {
        return frag;
    }

    let childrn: Array<HTMLElement>;
    if (children.length === 1) {
        const [firstArg] = children;
        if (Array.isArray(firstArg)) {
            // children: [[child, child, child,...]]
            childrn = firstArg;
        } else {
            // probably
            // children: [child]
            childrn = children;
        }
    } else {
        childrn = children;
    }

    childrn.forEach(e => {
        frag.appendChild(e);
    });

    return frag;
}

export function NullableRender(element: HTMLElement | null) {
    if (element === null) {
        return fragment();
    } else {
        return element;
    }
}

const appendChildren = (root: Node, children: Node[]) => {
    for (const c of children) {
        if (c instanceof LilComponent || c instanceof LilPlainComponent) {
            // HERE CAN BE INSERETED ADDIOTANL METHODS
            // TO SUPPORT MORE LIFECYCLE HOOKS IN FUTURE
            const componentView = c.render();
            root.appendChild(componentView);
            // c.connectedCallback();
        } else {
            root.appendChild(c);
        }
    }
}


export function LilElement<K extends keyof HTMLElementTagNameMap>(name: K, props: LilkitAttributes<HTMLElementTagNameMap[K]>, ...children: (HTMLElement|DocumentFragment)[] | [(HTMLElement|DocumentFragment)[]] | [ObservableVariableMap] | [ObservableVariableCompute]) {
    const element = document.createElement(name); // underlying HTMLElement | HTMLDivElement ...

    // Handle root element, assign props.
    for (const [attr, value] of Object.entries(props)) {
        if (value instanceof ObservableVariable) {
            // Reactive binding
            (element as { [key: string]: any })[attr] = value.val;

            value.subscribe((newVal) => {
                // element.setAttribute(attr, newVal);
                (element as { [key: string]: any })[attr] = newVal;
            });
        }
        else if (value instanceof ObservableVariableCompute) {
            // Variable binding and updates
            const obs = value.observableVariable;
            const computeCallback = value.callback;

            obs.subscribe((newVal) => {
                (element as { [key: string]: any })[attr] = computeCallback(newVal);
            });

            (element as { [key: string]: any })[attr] = computeCallback(obs.val);
        }
        else {
            (element as { [key: string]: any })[attr] = value;
        }
    }

    // Handling of children or ObservableVariableMap bindins
    if (children.length === 0) {
        // No children present
        return element;
    }
    else if (children.length === 1) {
        const [firstArg] = children;
        // Either single children OR ObservableVariableMap ~OR children passed as array~
        if (firstArg instanceof ObservableVariableMap) {
            // children is passed as array as LilElement('div', {}, [ Div({}), Div({}), ... ])
            // Variable binding and updates
            const obs = firstArg.observableVariable;
            const renderCallback = firstArg.callback;

            obs.val.forEach((e: any, i: number, a: any[]) => {
                element.append(renderCallback(e, i, a))
            });

            obs.subscribe((newVal) => {
                // Remove all childNodes
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }

                newVal.forEach((e: any, i: number, a: any[]) => {
                    element.append(renderCallback(e, i, a));
                });
            });

            // return element;
        }
        else if (Array.isArray(firstArg)) {
            // Children is already array of structure [[...]], so append inner array children in
            // children = [ firstArg = [ HTMLElement,... ] ]
            appendChildren(element, firstArg);
        }
        else {
            // Only single child passed as children, just append it.
            appendChildren(element, children as HTMLElement[]);
        }
    }
    else {
        appendChildren(element, children as HTMLElement[]);
    }

    return element;
}
