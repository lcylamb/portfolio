# Route Guards Alone Don't Make a Permission System

When admin systems talk about permission, the conversation is nine times out of ten about "logged in or not, can you get past the route guard". But the questions product brings over are never that kind — they're "why can the reviewer click 'send back for re-inspection'", "why does this person's list show claims from another branch".

The route layer doesn't stop any of those.

After a few years building claims systems in an insurance back office, my conclusion is: **permission is not a switch; it's three independent layers of design**. The route layer governs "can you enter this page", the button layer governs "can you perform this action", the data layer governs "does this record belong to you". Each layer blocks a different thing and is implemented differently. Systems that blur the layers together leak at every one of them.

## 1. The Route Layer: Authentication and Authorization Are Two Different Things

The most common implementation is a route table plus a guard:

```tsx
const routes = [{
  path: '/claims',
  element: <ClaimsPage />,
  meta: { requiresAuth: true },
}];
```

Wrap it in a higher-order component, read the current path with `useLocation` before rendering, match the route, check `requiresAuth`, and if there's no token, `<Navigate to="/login" replace />`.

This works. But two questions need answering first.

**First, `requiresAuth` answers authentication, not roles.** "Can a logged-in inspector open the financial reports page?" — `requiresAuth: true` cannot answer that; it only knows about tokens. To distinguish roles, the route meta doesn't need a boolean; it needs **which permission code this page requires**:

```tsx
meta: { permission: 'claim:review' }
```

The guard then checks the user's info for that code. Having both concepts in one system is normal: the login page and account settings only need authentication; business pages need permission codes. **Once the guard is written as "has token, let through", every page that needs role checks will grow its own patch of logic, and each patch will rot on its own.**

**Second, the guard must sit on the render path, not just intercept navigation.** A user has `/claims/audit/8842` bookmarked and refreshes straight into it — there's no "click the menu" action for you to intercept. So the check has to live on the mandatory path of component rendering: either a higher-order component around the route outlet, or a hook every protected page runs first. In a system that only validates on menu clicks, the permission list and the browser history are two sets of facts that never acknowledge each other.

## 2. The Button Layer: The Frontend Only Hides, It Doesn't Enforce

Routes govern pages. But inside a claim detail page, "approve", "send back", and "escalate" are three actions with three permissions.

The most convenient shape for the button layer is a hook or a directive:

```tsx
const can = usePermission();

{can('claim:rollback') && <Button onClick={rollback}>Send back for re-inspection</Button>}
```

Or on the Vue side, a `v-permission` directive that removes the element when the code is missing. Both are simple to implement — simple enough that people forget to think through two things.

**Where do permission codes come from.** My approach: fetch them once at login and put them into global state:

```json
{ "permissions": ["claim:view", "claim:review", "claim:rollback"] }
```

The backend computes the codes per role and delivers them. **The frontend never maps "role → codes" itself.** The role-to-permission mapping is a business rule, and business rules change. Hardcoding a copy on the frontend means duplicating the backend's responsibility — and an out-of-date copy at that. The frontend knows codes, not roles.

**After the button is hidden, does the action still exist.** This is the question the button layer most often gets waved past: a `display: none` button still has its API. Anyone who opens the network panel in devtools can `POST /api/claim/rollback` directly.

So this sentence belongs on line one of the design doc: **frontend permission is the experience layer, not the security boundary.** Hiding buttons means people with permission see less noise, and people without don't click through just to eat a 403. The real enforcement happens on the backend — every write endpoint checks the permission code and returns 403 on overreach.

To judge whether a system's permission design is sound, don't count how many buttons it hides. Check whether **its endpoints refuse when called directly**.

## 3. The Data Layer: Same Page, Different Worlds

With the first two layers done, the hardest one remains.

On the same "to-do list" page, an inspector sees their own claims, a team lead sees the whole team's, a branch admin sees the entire branch's. Same page, same route permission, same button permission — **the difference is in the data**.

For this kind of row-level permission, I hand it entirely to the backend: the endpoint decides the query scope from the identity in the token, and the frontend doesn't even know "data scope" exists. The moment the frontend tries to filter on its own (fetch the full list, then `filter`), it plants two mines: pagination goes wrong — filtered-out rows still consume page capacity — and the out-of-bounds data has already reached the browser, so nothing was actually blocked.

Field-level control is finer than row-level: the reviewer role can see the amount and the claim history count; the data-entry role cannot. This kind of requirement is common in insurance systems, and it tangles most easily with "edit permission".

Here a distinction learned from the form engine carries straight over: **"can be edited" and "will be submitted" are two different things.** A field the user has no permission to edit should render readonly and be submitted as-is. If you treat it as "the user cleared it" and drop it from the payload, the backend receives a document with a hole in it — and there's no way to trace who removed it. A system that conflates these two semantics will sooner or later report "no permission to edit" as "someone changed the data".

## 4. Decide Permission Code Granularity Before the First Requirement Change

How you design the codes determines how long this system lasts.

Too coarse (one code per module) welds together actions that shouldn't be bound: `claim:write` covers both "create" and "send back", and when product says "data entry must not send back claims", your only move is a new code plus a sweep of every existing config. Too fine (one code per button) turns configuration into manual labor — an admin staring at two hundred checkboxes in the permission page, with no idea which ones to tick.

My rule of thumb: land in the middle with "**resource + action**", keeping only the actions that genuinely get authorized independently:

```
claim:view        view lists and details
claim:edit        create / edit drafts
claim:review      review (approve / send back)
claim:pay         payment-related actions
```

Whether `claim:rollback` deserves its own code isn't a matter of technical taste. It's a matter of **whether anyone would hold it alone**. If yes, split it; if no, merge it. Permission codes are a vocabulary for admins to configure with, and the vocabulary should follow the org structure, not the button count.

## Finally

Lay the three layers side by side and a pattern shows up: **at every layer, the frontend's only job is "make sure the right people see the right things". Not a single layer relies on the frontend to stop the wrong people.**

That's not the frontend slacking. That's the correct shape of a permission system — the closer display control is to the frontend, the cheaper it is; the security boundary has to sit further back, where it's solid. Even with frontend permission done to the max — routes, buttons, fields all controlled — the endpoints still need to refuse direct calls. And the reverse holds: no matter how tight the backend is, if the frontend doesn't control display, the user is staring at a system full of 403s.

So whenever a newcomer asks "frontend permission can just be bypassed anyway, so what's the point", my answer is the same: it was never meant to stop the people who bypass. It stops the people who misclick. Stopping bypass has always been the API's job.
