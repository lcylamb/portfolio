# A Hundred-Line Condition Evaluator Powers a Whole Dynamic Form

The previous post covered the "why rewrite": a 1,300-line if-else form whose problem was **rules hardcoded in code**. The rewrite produced a schema — visibility, readonly, conditional required, all turned into serializable data.

But a schema is only a contract. A contract doesn't enforce itself.

What actually makes "dynamic" dynamic is a condition evaluator of about a hundred lines. This post is about that: how conditions are expressed, how scoping is designed, and a few decisions that look like "laziness" but took a long time to settle.

The code lives in the engine's `schema/conditions.ts`, short enough to read in one sitting.

## 1. The Shape of a Condition: A JSON Tree

First, what a condition looks like:

```json
{ "field": "claimScene", "op": "eq", "value": "TRAVEL" }
```

That's an atomic condition. Compound conditions are just nesting of three node kinds:

```json
{
  "and": [
    { "field": "claimScene", "op": "eq", "value": "TRAVEL" },
    { "or": [
      { "field": "amount", "op": "gt", "value": 5000 },
      { "field": "hasInvoice", "op": "truthy" }
    ]}
  ]
}
```

Two hard constraints in the design, both written in the type definition's comments.

**First: it must survive a `JSON.stringify` and a `parse` back.** This one rules out callbacks. `visibleWhen: (values) => ...` is pleasant to write, but then the backend can never deliver conditions, the config admin can never validate them, and the server can never pre-check them. The first post's "pull the rules out of rendering" cashes out here as: **rules must be data, and data must not hide functions.**

**Second: nodes are a discriminated union, not a universal interface.** `and` / `or` / `not` / atomic — four shapes, each holding disjoint fields. Inside the evaluator, after `if ('and' in expr)`, TypeScript narrows automatically; not a single `as` needed. The `(el as any)` casts all over most codebases come from writing unions that could have been narrowed as plain `string`. This is the counter-example.

Twelve operators: `eq / neq / in / nin / gt / gte / lt / lte / notEmpty / empty / truthy / falsy`. It looks like a small set, but form linkage needs roughly this much semantics. More operators isn't more expressive power — it's more learning cost.

## 2. Scoping: Why Local First, Then Root

This is, to my mind, the single most important design in the evaluator.

Fields inside a list item need to reference sibling fields. Without scoping, conditions would need full paths:

```json
{ "field": "invoiceList.0.invoiceKind", "op": "neq", "value": "VAT_SPECIAL" }
```

What's poisonous about that? **A schema assumes every item looks the same. Baking in an index means copying the schema N times** — one copy for item 0, one for item 1. The user adds or removes a row, and every index goes stale.

So evaluation uses two levels of scope: **local first, then root**.

```ts
function resolve(scope: Scope, field: string): unknown {
  if (scope.local !== undefined && hasPath(scope.local, field)) {
    return getPath(scope.local, field);
  }
  return getPath(scope.root, field);
}
```

Now the same condition `{ "field": "invoiceKind", ... }` points to the current row inside a list and to the top level outside it — the schema doesn't change a word. That's the dividend of being declarative: **scope resolution absorbs position, so the schema doesn't have to.**

Two details that are easy to get wrong, both worth calling out:

**The order cannot be reversed.** If the root is checked first, then as long as the top level happens to have a same-named field, list items silently read the outer value. On screen this bug shows up only as "visibility is occasionally wrong" — nearly impossible to trace, because you were checking row 3 but read a value from level 0. Who connects those two things?

**"Is it present locally" must be tested with `hasPath`, not `getPath(...) !== undefined`.** A field explicitly set to `undefined` still counts as "present locally" and must not fall through to the root. These two checks agree 99% of the time; the remaining 1% is the bug you spend an afternoon on. We nailed this down with a unit test — not because we're clever, but because we got bitten.

## 3. Normalization: Are `'1'`, `1`, and `true` the Same Thing?

No — but in business terms, yes.

The same value takes three shapes in a form: a dropdown stores the string `'1'`, the backend's enum is the number `1`, a toggle stores the boolean `true`. Write `value: 1` in a condition while the field is actually `'1'`, and without normalization the result is a silent non-match — the page shows "I selected it and nothing happened", with no error anywhere.

So values are coerced before comparison:

```ts
function normalize(value: unknown): unknown {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}
```

`eq / neq / in / nin` all go through this. Numeric comparison **deliberately does not**:

```ts
// Numeric comparison skips normalize —— '10' > '9' is false under string semantics, but here we need true
gt: (a, b) => toNumber(a) > toNumber(b),
```

The reason: `'10' > '9'` is `false` under string semantics (character-by-character, '1' < '9'). Normalizing first and then comparing would amount to building a type system that guesses the user's intent. **Each operator owns exactly one semantic. The semantic boundary lives in the operator, not in the caller's head.**

## 4. Two Permissive Decisions That Favor Showing More

The evaluator has two fallbacks that return `true`, and they look strange on first read:

```ts
export function evaluate(expr: ConditionExpr | undefined, scope: Scope): boolean {
  if (!expr) return true;          // no condition = always true
  if (isAtomic(expr)) {
    const operator = OPERATORS[expr.op];
    if (!operator) return true;    // unknown operator = true
    ...
```

Returning `true` for a missing condition is easy to accept — "no constraint means unconstrained" — and callers don't have to write `expr ? evaluate(expr, scope) : true` everywhere.

Returning `true` for an unknown operator takes a moment of thought.

The scenario: the backend ships a new operator (say `between`) before the frontend has released. Now the frontend is staring at a rule it can't read, and has two options — treat it as `false`, and the field disappears; treat it as `true`, and the field keeps showing.

**I chose the latter.** The worst case of an unreadable rule is "one field that should be hidden is showing". The worst case of a field vanishing because the frontend didn't understand a rule is a user looking at an incomplete document, with no way to know what's missing. A form is a data-entry tool. **The cost of fail-open is showing too much; the cost of fail-closed is incomplete data** — and the latter weighs far more.

This decision has a boundary, of course: if a scenario ever appears where a missed display causes financial loss, it has to be revisited. Permissiveness is a direction, not a dogma.

## 5. Why No Dependency Collection

The question I get asked most: visibility linkage is just reactivity, right? Why not build a reverse index of "field → expressions that depend on it", so a change only re-evaluates affected conditions?

The answer: **measure the scale first, then pick the architecture.**

The current implementation re-evaluates every condition on every render. Form fields number in the hundreds, not the tens of thousands. A hundred string comparisons cost roughly one `Array.prototype.sort` — far less complexity than maintaining a reverse index: when do dependencies register, when do they clean up, how does the index stay in sync as list rows come and go, what about circular dependencies. Each one is a new bug surface.

The real payoff of full evaluation is that **it has no state**. Condition evaluation is a pure function of `(expr, values) => boolean`. Testing means asserting an output for an input — no mocking of timing, no worrying about cache invalidation. The previous post's "the invariant became a test" was possible in large part because these pure functions have nothing to mock.

`collectReferencedFields()` does exist; it collects every field an expression references. Right now it serves exactly two low-frequency scenarios: preset-data initialization and the debug panel. **If fields ever reach tens of thousands, this function is the ready-made starting point for a reverse index.** Paying complexity up front for a scale that doesn't exist is what I've been arguing against since the first post — every line of if-else was justified, and so is every layer of premature architecture, until they aren't.

## The Costs

As usual, the costs spelled out.

**First, evaluation order is an implicit contract.** "Local first, then root" is baked into `resolve`; a schema author has to know the rule to predict what a condition will read. When a newcomer writes a condition that depends on a same-named root field, the behavior is correct but the intent is wrong — and that kind of "correct" is the hardest to catch in code review.

**Second, permissiveness comes with a bill.** Unknown operators return `true`; `undefined` counts as satisfied. Which means typos in the schema don't error — they pass silently. The debug panel mitigates this, but at root we chose "better to wrongly allow than to wrongly block", and systems like that are always missing one layer of safety.

**Third, expressions have no compile-time checks.** `field: "claimScence"` (typo) won't fail at the TypeScript level — it's data, not code. The real fix is a referential-integrity pass over the schema (`collectReferencedFields` checked against the field table). It's on the list. Not done yet.

Whether a hundred lines are worth all this depends on whether your form will ever grow into that 1,300-line one from the first post. If it will, these are probably the best hundred lines you can buy.
