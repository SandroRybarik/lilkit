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
/**
 * 
 * @param {Document} document Document instance
 * @param {object} configuration `NOT IMPLEMENTED YET` config object
 * 
 */
export function initializeLilElement(config?: LilElementInitConfig) {
    let doc: Document;
    if (config) {
        doc = config.documentInstance;
    } else if (typeof document !== "undefined" && document) {
        doc = document;
    } else {
        throw new Error("Error: 'initializeLilElement can't be run due to lack of proper Document instance.'") 
    }
    // const doc = config?.documentInstance || document; // dom || jsdom || ...
    const appendChildren = (root: Node, children: Node[]) => {
        for (const c of children) {
            if (c instanceof LilComponent || c instanceof LilPlainComponent) {
                // HERE CAN BE INSERETED ADDIOTANL METHODS
                // TO SUPPORT MORE LIFECYCLE HOOKS IN FUTURE
                root.appendChild(c.render());
            } else {
                root.appendChild(c);
            }
        }
    }


    return <K extends keyof HTMLElementTagNameMap>(name: K, props: LilkitAttributes<HTMLElementTagNameMap[K]>, ...children: HTMLElement[]|[Array<HTMLElement>]|[ObservableVariableMap]|[ObservableVariableCompute]) => {

        // createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, options?: ElementCreationOptions): HTMLElementTagNameMap[K];
        const element = doc.createElement(name); // underlying HTMLElement | HTMLDivElement ...

        // Handle root element, assign props.
        for (const [attr, value] of Object.entries(props)) {
            if (value instanceof ObservableVariable) {
                // Reactive binding
                (element as {[key: string]: any})[attr] = value.val;

                value.subscribe((newVal) => {
                    // element.setAttribute(attr, newVal);
                    (element as {[key: string]: any})[attr] = newVal;
                });
            }
            else if (value instanceof ObservableVariableCompute) {
                // Variable binding and updates
                const obs = value.observableVariable;
                const computeCallback = value.callback;

                obs.subscribe((newVal) => {
                    // element.setAttribute(attr, computeCallback(newVal));
                    (element as {[key: string]: any})[attr] = computeCallback(newVal);
                });

                // element.setAttribute(attr, computeCallback(obs.val));
                (element as {[key: string]: any})[attr] = computeCallback(obs.val);
            }
            else {
                // element.setAttribute(attr, value);
                (element as {[key: string]: any})[attr] = value;
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

}

