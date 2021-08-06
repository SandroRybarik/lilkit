

import { ul, $map, $compute, ObservableVariable, a, AnyPropsHTML, div, lifecycle, li, observable, button, onDestroy, onMounted, input, form, LilkitComponent } from './core2';


test('basic html', () => {
    expect(div({}).outerHTML).toBe('<div></div>');
});

test('observable test', () => {

    const title = new ObservableVariable<string>('');

    const ParentComponent = (props: AnyPropsHTML) => {

        return div({},
            InnerComponent({ title, ...props })
        );
    }

    const InnerComponent = ({ title, ...props }: AnyPropsHTML) => {
        return div({ textContent: title })
    }

    const view = div({},
        ParentComponent({ title })
    );

    expect(view.outerHTML).toBe('<div><div><div></div></div></div>');

    title.val("Change");

    expect(view.outerHTML).toBe('<div><div><div>Change</div></div></div>');
});


test('observable $compute test', () => {

    const title = new ObservableVariable("");

    const ParentComponent = (props: AnyPropsHTML) => {

        return div({},
            InnerComponent({ title, ...props })
        );
    }

    const InnerComponent = ({ title, ...props }: AnyPropsHTML) => {
        return div({ textContent: $compute(title, t => `My:${t}`) })
    }

    const view = div({},
        ParentComponent({ title })
    );

    expect(view.outerHTML).toBe('<div><div><div>My:</div></div></div>');

    title.val("Change");

    expect(view.outerHTML).toBe('<div><div><div>My:Change</div></div></div>');
});

test('observable $map test', () => {

    const listOfThings = new ObservableVariable([{ id: 1 }, { id: 2 }]);

    const ParentComponent = (props: AnyPropsHTML) => {

        return div({},
            InnerComponent({ listOfThings, ...props })
        );
    }

    const InnerComponent = ({ listOfThings, ...props }: AnyPropsHTML) => {
        return ul({ children: $map(listOfThings, (x: { id: number }) => li({ textContent: x.id })) })
    }

    const view = div({},
        ParentComponent({ listOfThings })
    );

    expect(view.outerHTML).toBe('<div><div><ul><li>1</li><li>2</li></ul></div></div>');

    listOfThings.set(l => [...l, { id: 3 }]);

    expect(view.outerHTML).toBe('<div><div><ul><li>1</li><li>2</li><li>3</li></ul></div></div>');
});

test('dataset plain bind', () => {
    const dataset = { x: "xprop", y: "yprop" };

    const view = div({ dataset });
    expect(view.outerHTML).toBe('<div data-x="xprop" data-y="yprop"></div>')
});

test('dataset observable bind', () => {
    const dataset = new ObservableVariable({ x: "xprop", y: "yprop" });

    const view = div({ dataset: dataset });
    expect(view.outerHTML).toBe('<div data-x="xprop" data-y="yprop"></div>');

    dataset.set(x => ({ ...x, x: "xpropchanged" }));
    expect(view.outerHTML).toBe('<div data-x="xpropchanged" data-y="yprop"></div>');
});


test('children prop and children arg must throw', () => {
    const f = () => {
        div({ children: [div({})] }, div({}))
    };
    expect(f).toThrowError("Setting children property and adding children HTML Elements is not supported.");

    const obs = observable([1,2]);
    const f2 = () => {
        div({ children: $map(obs, () => div({})) }, div({}))
    };
    expect(f2).toThrowError("Setting children property and adding children HTML Elements is not supported.");
});

test('observable bindings changed by onclick', () => {
    const state = observable("");
    const view = button({ onclick: () => { state.val("Change") } });
    view.click();
    expect(state.get()).toBe("Change");
});

test('lifecycle helper $destroy', () => {
    const lc = lifecycle();
    const state = observable(0);

    const ComponentSideEffects = (props: any) => {
        const view = button({});
        
        function f() {
            props.state.set((x: any) => x + 1);
        }

        // Add side effects
        view.addEventListener('click', f);

        // Release
        onDestroy(props, () => { view.removeEventListener('click', f); })

        return view;
    }

    // Pass lifecycle component
    const view = ComponentSideEffects({ ...lc, state});
    view.click();

    expect(state.get()).toBe(1);

    lc.$destroy()

    view.click();

    expect(state.get()).toBe(1);
});

test('onMounted test', () => {
    const hasMounted = observable(false);
    const lc = lifecycle();

    const Component = (props: AnyPropsHTML) => {
        onMounted(props, () => {
            props.hasMounted.val(true);
        });

        return div({ });
    }

    const view = div({},
        Component({ ...lc, hasMounted })
    );
    lc.$mounted();

    expect(hasMounted.get()).toBe(true);
});

test('class component', () => {

    class App extends LilkitComponent {
        public name: ObservableVariable<string>;
        public email: ObservableVariable<string>;
        public onDestroyCalled: boolean;
        public onMountedCalled: boolean;
        public submitCalled: boolean;

        constructor(props: AnyPropsHTML) {
            super(props);

            this.name = observable("");
            this.email = observable("");

            this.onDestroyCalled = false;
            this.onMountedCalled = false;
            this.submitCalled = false;
        }

        onDestroy() {
            this.onDestroyCalled = true;
        }

        onMounted() {
            this.onMountedCalled = true;
        }

        submit() {
            this.submitCalled = true;
        }

        render() {
            const view = form({},
                div({},
                    input({ onchange: (e: any) => this.name.val(e.target.value) })    
                ),
                div({},
                    input({ onchange: (e: any) => this.email.val(e.target.value) })    
                ),
                button({ textContent: "Submit", onclick: () => this.submit() })     
            );
            
            return view;
        }
    }

    const $lc = lifecycle();
    const app = new App({ ...$lc });
    const view = div({},
        app
    );
    $lc.$mounted();
    expect(app.onMountedCalled).toBe(true);
    $lc.$destroy();
    expect(app.onDestroyCalled).toBe(true);
});