# Vue Reactivity: From defineProperty to Proxy

> Study notes. The material comes from differences I ran into working on Vue2 / Vue3 dual-stack projects; the diagrams are my own, and every code snippet runs.

Dual-stack development comes with a particular experience: same business, same form logic, and the code that "changed but didn't render" in Vue2 suddenly works in Vue3 — `this.obj.newKey = 1` leaves the page untouched in Vue2, but takes effect immediately in the Proxy version.

This isn't a magic upgrade. The reactivity system changed its implementation foundation. Once you understand that change, most of the "behavioral differences" between the two generations explain themselves. In order: how Vue2 did it, what it lacked, what Proxy added, and why Proxy must be paired with Reflect.

## 1. Vue2: Recursively Hijack Every Property at Initialization

`Object.defineProperty` can hijack the reads and writes of **one existing property** at a time. To make a whole object reactive, you have to recurse through it at initialization and wrap every property:

```javascript
function defineReactive(obj, key, val) {
  observe(val); // recurse into nested objects
  const dep = new Dep();
  Object.defineProperty(obj, key, {
    get() {
      Dep.target && dep.depend(); // collect during render: who is reading me
      return val;
    },
    set(newVal) {
      if (newVal === val) return;
      val = newVal;
      observe(newVal);
      dep.notify(); // dispatch updates: everyone who read me runs again
    },
  });
}
```

![Vue2 reactivity: recursive initialization + getter collection / setter dispatch](/diagrams/reactivity-defineproperty.svg)
> Figure 1 · At initialization, the whole data tree is traversed recursively and every existing property gets a getter / setter; the three red categories are the ones this mechanism can never reach

Collecting dependencies in the getter and dispatching updates in the setter — the idea itself is sound. The problems all come from two qualifiers: "**at initialization**" and "**every existing property**".

**Adding and deleting properties goes undetected.** `defineProperty` registers property by property name. A newly added property was never registered, has no setter, and nobody knows when it changes. `delete` is the same — deletion just makes the property disappear, without firing any callback. That's why Vue2 needs `Vue.set` / `Vue.delete`: in essence they bypass the object itself and patch the gap with "notify manually after the change".

**Array indices and `length` go undetected.** Assigning to `list[3]` or changing `list.length` is invisible to `defineProperty`. Vue2's patch is rewriting the seven mutation methods — `push / pop / shift / unshift / splice / sort / reverse`. Why these seven? Because they are the only methods that **change the array's contents**; the others (`map`, `filter`, `slice`) return new arrays, and reassigning the result triggers the setter. These seven methods were replaced with versions that "run the native operation first, then call `dep.notify()` manually".

**Initialization is expensive.** Whether or not a nested property will ever be used, initialization has to recurse through everything and wrap it one `defineProperty` at a time. Put a large object (say, an entire claim form) into `data`, and the first render pays a traversal tax up front.

These three defects are three projections of one root cause: **the unit of hijacking is the "property", and everything outside properties — adding, deleting, indexing — is out of range.**

## 2. Vue3: From "Hijacking Properties" to "Proxying Objects"

Proxy's unit of interception isn't the property. It's **operations on the whole object**:

| Operation intercepted | handler method | Corresponding syntax |
| --- | --- | --- |
| Property read | `get` | `obj.prop`, `obj['prop']` |
| Property write | `set` | `obj.prop = val` |
| Property deletion | `deleteProperty` | `delete obj.prop` |
| Existence check | `has` | `'prop' in obj` |
| Key enumeration | `ownKeys` | `Object.keys(obj)` |

Adding a property goes through `set`, deleting goes through `deleteProperty`, and array indices and `length` are just ordinary `get` / `set` — Vue2's three defects are three dividends from a single replacement. `Vue.set` is gone, and the seven mutation methods never need rewriting again.

There's also a less visible gain: **lazy proxying**. Vue2 recursively hijacks the whole tree at initialization; Vue3 proxies a level only when it's accessed:

```javascript
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      const result = Reflect.get(target, key, receiver);
      // only accessed nested objects become reactive; untouched branches cost nothing
      if (typeof result === 'object' && result !== null) {
        return reactive(result);
      }
      return result;
    },
    set(target, key, value, receiver) {
      const old = target[key];
      const result = Reflect.set(target, key, value, receiver);
      if (old !== value) trigger(target, key);
      return result;
    },
  });
}
```

![defineProperty full recursion vs Proxy lazy proxying](/diagrams/reactivity-proxy-lazy.svg)
> Figure 2 · Top: Vue2 recursively walks the entire tree at initialization and installs a getter / setter on every property. Bottom: Vue3 builds proxies level by level only along accessed branches; deep, unused fields stay untouched

If a large object renders only two or three of its fields, Vue2 still recurses through all of it; Vue3 touches only the paths that were read. API data on a list page is often "thirty fields, three used". The cost is invisible day to day, and very visible when first-render metrics are tight.

## 3. Why Reflect Is Required

The most frequently asked question about the `reactive` implementation: in `Reflect.get(target, key, receiver)`, why not just write `target[key]`?

The critical scenario is **nested getters**:

```javascript
const raw = {
  get fullName() {
    return `${this.first} ${this.last}`;
  },
};

const proxy = new Proxy(raw, {
  get(target, key, receiver) {
    return Reflect.get(target, key, receiver); // this points to the proxy
    // return target[key];  // this points to raw — disaster
  },
});
```

`target[key]` reads through the raw object, so `this` inside the getter is `raw`. The `this.first` read then **doesn't pass through the proxy**, `track` collects no dependency, and the visible symptom is "first / last changed, fullName didn't update".

`Reflect.get(target, key, receiver)`'s third argument sets `receiver` — the proxy object — as the getter's `this`, so `this.first` is routed back into the proxy's `get` trap and dependency collection is restored. **Proxy handles the interception; Reflect's job is "forward with the original semantics, but fix `this`". They're partners, not duplicates.**

The other reason is the return-value contract: `Reflect.set` returns a boolean for success or failure, which fits the Proxy handler's return requirement (the `set` trap is expected to return a boolean). A hand-written `target[key] = value` produces no such signal — when an operation fails (say, the property is read-only), you're left guessing via exceptions.

That also explains `ref`'s `.value`: Proxy can only wrap objects, and primitives like `number` / `string` can't be wrapped. `ref` puts the value inside a `{ value: x }` object and makes that object reactive — auto-unwrapping in templates just hides the wrapper. **`.value` isn't an API design preference; it's the inevitable consequence of primitives having no Proxy channel.**

## 4. Where Did Dependency Tracking Go: targetMap

In Vue2, every property carries a `Dep` in its closure. Vue3's Proxy traps are shared by all properties, so dependencies live in one global table instead:

```typescript
const targetMap = new WeakMap(); // raw object → (key → set of effects depending on it)
let activeEffect: (() => void) | null = null;

function track(target: object, key: string | symbol) {
  if (!activeEffect) return; // not read inside an effect, nothing to record
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);
  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect);
}

function trigger(target: object, key: string | symbol) {
  const depsMap = targetMap.get(target);
  depsMap?.get(key)?.forEach((effect) => effect());
}
```

Each of the three layers handles one thing: the `WeakMap` splits by object (weak keys, so when an object is destroyed its dependencies are collected with it — no manual cleanup); the `Map` splits by property; the `Set` deduplicates — the same effect reading the same property ten times is recorded once.

The `Set` dedup also explains a famous Vue3 behavior: change the same ref three times in a row inside a component, and the view updates once — three `trigger` calls push the same effect into the same `Set`, and after batching it runs a single time.

## 5. Putting It Together

| | Vue2 (defineProperty) | Vue3 (Proxy) |
| --- | --- | --- |
| Unit of interception | A single existing property | Operations on the whole object |
| Add / delete properties | Undetected; needs `Vue.set` / `Vue.delete` | Supported natively |
| Array index / length | Undetected; needs 7 rewritten mutation methods | Supported natively |
| Initialization | Full recursive hijacking | Lazy proxying, converted on access |
| Where dependencies live | A Dep in each property's closure | Global targetMap (WeakMap) |
| Map / Set | Not supported | Supported with dedicated handling |

For everyday coding, the things actually worth remembering:

**Destructuring breaks the connection.** `const { name } = reactive(obj)` gives you the raw value, disconnected from the proxy — change `obj.name` afterward and `name` won't update. Use `toRefs` if you need to destructure. This isn't a Proxy bug; it's the inherent conflict between "copy the value" and "track the reference".

**Replacing the whole object needs care.** `state = { ...newData }` changes where the variable points, not the properties inside the proxy — nothing listens. Assign field by field when that's what you mean.

**The list of Vue2's seven mutation methods is worth memorizing.** Judging whether "this operation is detectable in an old codebase" comes down to knowing which methods were rewritten: the ones that mutate array contents were; the ones returning new arrays require reassignment.

One closing thought: Vue3 switching to Proxy isn't "new tech replacing old tech". It's **the abstraction level of interception moving up one layer** — from "property reads and writes" up to "operations on objects". `Vue.set` and the rewritten array methods were patches applied at the old level; once the level changed, every patch lost its reason to exist. A lot of "framework behavior differences" have their roots at exactly this kind of abstraction level.
