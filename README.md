# Lilkit
Lilkit is kit for creating portable Javascript components that can be used anywhere.

# Philosophy
Goal is to render **only once** and all additional updates are carried on existing HTML structure with observables. Every element is updating it own content or children and no virtual dom is required.

# Getting started

Simple example what's possible:

```js
import {div, ul, li, button} from 'lilkit/elements';

const MyLilDiv = (...children) => div({ className: "lil" }, children);
const array = [1,2,3];

const view = div({},
    div({ textContent: "Hello from nested div!" }),
    MyLilDiv(
        ul({},
            ...array.map(i => li({ textContent: i }))
        )
    ),
    button({ textContent: "click me!", onclick: () => alert("Hello!") })
);

// view is valid HTMLElement
document.getElementById("deployHere").appendChild(view);
```

More complicated example with reactivity:

```js
import { div, ul, li, input, button } from 'lilkit/elements';
import { ObservableVariable } from 'lilkit/core';

class MyLilComponent extends LilPlainComponent {
    constructor(props) {
        super();
        this.title = new ObservableVariable("");
        this.readingList = new ObservableVariable([ { text: 'HN' } ]);
    }

    myNextRead(readItem) {
        this.readingList = [...this.readingList, readItem];
    }

    render() {
        const view = div({},
            input({ onchange: (e) => { this.title.val = e.target.value; } }),
            button({ 
                textContent: "Add",
                onclick: () => { this.myNextRead(this.title.val) } 
            }),
            ul({}, this.readingList.map(e => li({ textContent: e })))
        );
    }
}

// Class component can be used in others LilElements.
const app = div({},
    new MyLilComponent({ somePropHere: "value" }) 
    // will automatically trigger `render()` method
);

document.getElementById("deployHere").appendChild(app);
```