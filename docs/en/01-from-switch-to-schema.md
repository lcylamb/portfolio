# I Rewrote an if-else Form of Over 1,300 Lines into JSON

Expense claim filing is the hardest part of our finance back-office. One page, the field count varies by claim scenario, and visibility, required flags, and field dependencies are all delivered by the backend — it sounds like a textbook dynamic form.

But it isn't dynamic.

When product asked to "add a dependency to this dropdown", we answered "needs scheduling". One field's special interaction meant a frontend change, a release, and waiting on QA.

The only dynamic part was the **data**. All the behavior was hardcoded.

This page lives in `Expense/FormList.tsx`, over 1,300 lines.

> Note: field names, file names, and the business domain have been sanitized into a structurally isomorphic expense claim scenario. The line counts, code skeleton, four problems, and three decisions are as they were.

## What It Looks Like First

Of those 1,300-plus lines, the vast majority belong to one function: `buildFieldList`, starting at line 70 and ending at line 1200.

Its skeleton is actually plain — just two layers of matching:

```tsx
const buildFieldList = (field, name, listName) => {
  let { fieldKey, requiredFlag, editableFlag } = field;
  let required = requiredFlag === 1;

  // Layer 1: hardcoded one by one by "field name"
  if (fieldKey === 'claimScene')   return <FieldSelect ... />;
  if (fieldKey === 'agentPayFlag') return <FieldSwitch ... />;
  if (fieldKey === 'departDate')   return <FieldDate ... />;
  // ... about twenty of these
  if (fieldKey === 'vendorName' && listName === 'vendorDtoList') return ...;

  // Layer 2: fall back by "data type"
  switch (field.valueType) {
    case 'select': ...
    case 'date':   ...
    default:       return <FieldText ... />;
  }
};
```

**Match by field name first; fall back by type when nothing matches.** That order is itself the problem behind everything in this post: it admits that "the same `valueType`, as long as the field name differs, can behave completely differently".

Next to it sits another file, `request.ts`, holding a table like this:

```ts
export const dependentFields = {
  hasInvoice: [           // whether an invoice has been obtained
    { fieldKey: 'invoiceDate',  label: 'Invoice date', valueType: '' },
    { fieldKey: 'invoiceTitle', label: 'Invoice title', valueType: 'string' },
    { fieldKey: 'invoiceNo',    label: 'Invoice no.', valueType: 'string' },
  ],
  hasTrip: [ /* 4 fields */ ],
  hasEntertain: [ /* 2 fields */ ],
  agentPayFlag: [ /* 1 field */ ],
};
```

The table says something very direct: **"who depends on whom" is a business rule, and it was handwritten on the frontend.** Fifteen fields' worth of dependencies in total.

## Problem 1: The Range of "Dynamic" Is Fenced In

The fields delivered by the backend look like this — this is the interface the frontend defines, matching what the API actually returns:

```ts
export interface FieldConfig {
  fieldKey: string;
  valueType: string;     // widget type + regex, squeezed into one field
  options: string;       // enum, comma-separated
  requiredFlag: number;  // static: whether to fill it in
  editableFlag: number;  // static: whether it can be edited
  label: string;
  orderNo: number;
  // ...
}
```

Once the frontend gets it, the first thing it does is throw `fieldKey` against those twenty `if`s.

So what the backend controls is "**whether a field appears and whether it must be filled**". What it cannot control is "**what a new field looks like**". Configure a new field on the backend and it will only ever render as the text box in the `default` branch — no `if` knows it.

What about dependencies? **That dimension doesn't exist in the contract.** No `dependsOn`, no `visibleWhen`, no `requiredWhen`. Only static flags like `requiredFlag`, which can express "must be filled" but not "**when** it must be filled".

And what the business wants is exactly the latter: the actual claimant's account only becomes required when the filer checks "submit on behalf of someone else".

So the frontend patched in that table.

The comparison is telling: **from the same data, enum values are fetched from the backend** (`fetchDict({ dictCodes: [...] })`), while dependencies are hardcoded.

One is a business rule. The other is also a business rule. One goes through the backend; the other goes through code.

The difference isn't who was lazy — **it's whether the backend contract had a field to carry it**.

(And so the right question about this problem isn't "why did the frontend hardcode the rule", but "why should the contract add a dimension, and what does adding it cost". The former only leads to "go fix it"; the latter determines whether a fix is even possible.)

## Problem 2: One Field Name, Two Sets of Semantics

`vendorName` appears twice in this file, with opposite behavior.

The first time, in the trip list — the vendor's name:

```tsx
value: field.vendorName,
```

It stores the **name**.

The second time, in the vendor dropdown:

```tsx
value: field.id,
onChange: (_, option) => {
  const list = form?.getFieldValue('vendorDtoList');
  list[name] = { ...option, vendorId: option?.id, vendorName: option?.title };
  form?.setFieldValue('vendorDtoList', list);
},
```

It stores the **id**, and also writes the whole option back into the list item while it's at it.

Same `fieldKey`, same `valueType`, opposite semantics. **The only thing that can tell them apart is the `listName` passed in from outside.**

So `buildFieldList`'s signature has to carry an extra parameter, just to make this discrimination at the render layer.

Where's the problem? **The widget's value semantics are implied by the field name.** The name `vendorName` doesn't carry "should an id or a name be stored here" — that information exists only in those two `onChange` implementations. Anyone who wants to reuse this field has to read its implementation first to learn what it actually writes into it.

## Problem 3: Hidden ≠ Not Submitted

This file has **two** mechanisms for making a field "invisible", and neither one prevents submission.

The first, `valueType === 'hidden'`:

```tsx
if (field.valueType === 'hidden') {
  return <Form.Item name={[index, field.fieldKey]} hidden key={field.fieldKey} />;
}
```

`hidden` only applies a style. The value stays in form state and gets submitted all the same.

The second, returning `null` from conditional rendering:

```tsx
<FieldDependency name={['tripDtoList']}>
  {({ tripDtoList }) => {
    if (tripDtoList[name]?.tripFlag !== Status.YES) return undefined;
    return <>{/* departure date, trip days, ... */}</>;
  }}
</FieldDependency>
```

The component doesn't render, but **the values are still there in the Form.List**.

Walk through what happens: the user fills in the travel branch first, including fields that belong only to travel; switches to entertainment and fills it in again; switches back to travel — **those values have been there the whole time**.

Submit as-is and one travel trip carries entertainment fields. And **both sides are legal values** — backend validation can't block it. What it receives is a row of data that shouldn't exist in the business.

One thing to make clear here: **in this codebase, `hidden` actually means "submit it, but don't show it".**

Look at the fields in `dependentFields`: `costCenterId`, `vendorId`, `vendorCode` — all `valueType: 'hidden'`. They are values the backend **must receive**; the user can't see them or change them, but they must ride along on submission.

So the real problem isn't "hidden doesn't filter". It's that **two completely different intents — "a hidden value that must be submitted" and "a hidden value that shouldn't be submitted" — share one mechanism.** The frontend can't tell them apart, so the backend can't either.

## Problem 4: One Field Carrying Two Jobs

Inside `valueType`, both the **widget type** and the **validation regex** are packed together:

```tsx
let rules = [{ required, message: 'Please enter a value!' }];

if (field.valueType.split('reg-')[1]) {
  rules.push({
    pattern: RegExp(field.valueType.split('reg-')[1]),
    message: 'Please enter a valid format',
  });
}
```

While the main render path uses **exact string matching**:

```tsx
switch (field.valueType) {
  case 'select-m':      ...
  case 'select':        ...
  case 'YES_OR_NO_FLAG':...
  case 'date':          ...
  case 'number':        ...
  case 'datePikcer':    ...
  default:              return <FieldText ... />;
}
```

Do they match? `'select-reg-^\d{11}$'` does not equal `'select'`. It doesn't equal any `case`.

**So it inevitably falls into `default` and renders as a text box.**

The real consequence isn't "the regex stops working". It's that **configuring a regex for a field means giving up its widget type**. A dropdown with a regex becomes an input box.

(Fairness where it's due: if the backend convention was always "`reg-` only goes on plain text fields", then this design is **correct** — `string-reg-xxx` falls into default and yields "text box + regex", exactly as intended. One field carrying two jobs is economical when the possible combinations are few. Its limitation is expressive power: once a cross combination like "dropdown + regex" shows up, it can't express it. **This is a boundary of a trade-off, not a mistake.**)

By the way: that "extract the regex from `valueType`" snippet is **copied 5 times in this project** — `FormItem.tsx`, `FormList.tsx`, `Bill.tsx`, `PayInfo.tsx`, and one more in another page directory.

One more detail while we're here: `case 'datePikcer'`. The spelling is wrong — the correct word is `datePicker`. And there's one copy in each of two files.

**A typo, fossilized into a config protocol between frontend and backend.** Fix the letter now and every backend config breaks. A config protocol, once shipped, is irreversible. That's one of its costs.

## The Rewrite: Separating "Rules" from "Rendering"

The four problems above look scattered, but they're the same problem: **"what the rule is" and "how to draw it" had gotten tangled together.**

So the rewrite had exactly one goal: **pull the rules out of rendering and turn them into data.**

Concretely, three decisions — each with a cost.

### Decision 1: Conditions Must Be Serializable, So No Callbacks

Visibility, readonly, and conditional required all degrade into declarative expressions:

```json
{ "field": "claimScene", "op": "eq", "value": "TRAVEL" }
```

`and` / `or` / `not` nesting is supported. **Functions are not.**

**Cost**: rules like "amount greater than the sum of the previous three fields" can't be written.

**Why I accepted it**: once functions are allowed, the schema is no longer data — a config admin, permission checks, server-side pre-validation all become impossible. This is a deliberately cut capability, not an omission.

### Decision 2: Lookup — "Local First, Then Root"

An `expenseType` inside a list item points to that item; a `claimScene` outside the list points to the root. Otherwise every new list level would require copying the schema.

**One detail that had to be baked in: the order cannot be reversed.** If the root is checked first, then as long as the top level happens to have a same-named field, list items will silently read the outer value — and on screen this bug manifests only as "visibility is occasionally wrong", extremely hard to trace.

One more rule: "does the field exist" must be tested with `hasPath()`, not `getPath() !== undefined`. A field explicitly set to `undefined` still counts as "present locally" and must not fall through to the root.

**Cost**: one more evaluation rule that has to be explained — the mental load for newcomers goes up by one.

### Decision 3: "Validated ⇔ Submitted" as an Invariant

This one answers Problem 3 directly.

Validation and serialization each resolve visibility independently; they must agree semantically. So it's fixed as an invariant:

> A field is validated ⇔ it appears in the submit payload.

There are exactly two exceptions, both deliberate: **readonly fields**, and **locked cells in tables** — they are submitted but not validated. Because "the user can't change it" and "the backend doesn't need it" are two different things; merging them makes the frontend report "no permission to edit" as "the user cleared it".

The most important step: **this invariant became a test.**

Because my first version was wrong. I filtered table cells by `editableWhen` — treating "can be edited" and "will be submitted" as the same thing, which breaks the invariant outright. **The test caught it first. I did not spot it by reading code.**

An invariant without a test doesn't exist. It sounds like a platitude, but only someone the test has saved once actually believes it.

## The Costs

The previous three sections were all about the gains, but abstraction isn't free, and this section is about the costs.

**First, the cost of reading code was moved, not removed.** In the original, a newcomer glances at those twenty `if`s and knows what any field renders as. Now they need to understand a schema parser, the scope fallback rule, and the evaluation order. **For someone fluent, it's a win. For a newcomer — including me three months from now — it's a cost.**

**Second, expressiveness has a ceiling, and that ceiling is by design.** See Decision 1 above.

**Third, the abstraction rests on the premise that "the requirements themselves are isomorphic".** Expense claim fields look wildly varied, but strip the business shell and most of them fall into a few kinds: dropdown, date, number, dependency, list. **But if every one of your fields is a special case, you can't extract a schema — forcing it produces a pile of escape hatches, which are harder to maintain than a pile of if-else.**

So the real question isn't "can this be abstracted". It's: **who should own this rule — frontend code, the config admin, or the backend field dictionary?**

## What I Didn't Do

**I didn't use an off-the-shelf low-code platform / form engine.**

Not because they're "too heavy". It's because this form's visibility depends on the **document context** — expense type, claim scenario, approval status, all inside the document data. Bring in a form platform and you have to push the whole business context into it, which is just writing if-else somewhere else.

**I didn't replace the old code in production.**

This needs to be spelled out: **rewriting a complex form that the business already depends on, from scratch, is extremely risky.** What I built is a working proof, not a launch.

If a real replacement were to happen, the path would be roughly:

1. **First extract the pure logic from the old code** — condition evaluation, validation, serialization — and let the old render layer keep using them. This step gets unit test coverage immediately and **changes no behavior**; lowest risk.
2. **Then migrate list by list** to schema rendering, one at a time, old and new side by side. One for `invoiceList`, one for `vendorDtoList`.
3. **Finally delete the old branches.**

I picked this order because every step is reversible. "Rewrite it all at once and pray" is not.

## Finally

The hardest thing about this file wasn't its length. It's that **every line is justified**.

Every `if (fieldKey === 'xxx')` traces back to a real requirement. Nobody broke this file. It was stacked up by a hundred correct changes.

So refactoring it was never about "the code looks ugly". It started with answering one question:

**Who should own this rule — frontend code, the config admin, or the backend field dictionary?**

Answer that, and the code changes are just follow-through.
