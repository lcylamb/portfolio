# Embedding H5 in a Mini Program: Two Channels, Four Pitfalls

> Practice notes. Our business has a batch of pages that had to run both inside a mini program and in the browser (campaign pages, content pages — the "operations needs it fast" scenarios), so they were built as H5 and embedded into the mini program via web-view. This post covers how to pass data between the two containers, and a few pitfalls that cost us half a day each to debug.

Once the web-view is in, the problems show up immediately: the mini program and the H5 inside it are two isolated JS environments. Variables aren't shared, events don't cross the boundary, neither can see the other. Every bit of cooperation — passing login state, syncing page state, carrying the result of an H5 action back into the mini program — has to go through an explicit communication channel.

There are only two channels: H5 → mini program, and mini program → H5. The two directions are completely asymmetric in capability, and that's the starting point for understanding everything.

## Prerequisites: Being Able to Embed Is Itself a Barrier

Three configuration matters first, otherwise everything below is moot:

1. **The H5 domain must be registered in the mini program admin console under "business domain"**, and you need to download the verification file and place it at the domain root. Get the domain wrong and the web-view goes straight to a blank screen, with an error message that is decidedly unhelpful.
2. **The H5 page must include WeChat JS-SDK**; all the communication APIs live under the `wx.miniProgram` namespace.
3. **Mini programs under individual (personal) accounts have no web-view permission** — it's a capability reserved for enterprise accounts.

## 1. H5 → Mini Program: A Message That Arrives Late

For H5 to send a message to the mini program, the API is this:

```javascript
// inside the H5 page
wx.miniProgram.postMessage({
  data: { type: 'form_submit', result: 'approved', ts: Date.now() },
});
```

It looks like `postMessage`, so you'd expect it to deliver in real time, like a WebSocket — **it doesn't**. Although the mini program side attaches a `bindmessage` listener on the `web-view` component, the message does **not** arrive at the moment of postMessage. It waits until one of these moments:

- the mini program page navigates back or is destroyed;
- the user taps share inside the web-view;
- the component is destroyed.

In other words, messages are **buffered**. When the triggering moment arrives, all postMessage calls accumulated in the meantime are handed to the mini program, in order. We fell into this on our very first integration: the H5 posted a message right after a form submission, the listener on the mini program side sat completely still, and we spent ages suspecting the domain config and the SDK version — neither was the problem. The message was simply still stuck in the pipe.

This design dictates how it should be used: **postMessage is for passing "results", not for passing "events".** Filling out an entire form in H5, tapping submit, and bundling the final result into one message to carry back — that works fine. Trying to do real-time interaction like "tap a button in H5 and the mini program immediately shows a toast" — this road won't get you there.

So how do you do real-time interaction? Look at what's on the API surface: navigation methods like `wx.miniProgram.navigateTo` / `navigateBack` / `switchTab` **take effect in real time**. So the practical way to do "H5 finishes the task → notify the mini program" in real time is:

```javascript
// in H5: navigate back to a mini program page, carrying the result
wx.miniProgram.navigateTo({
  url: `/pages/result/result?status=approved&id=8842`,
});
```

Navigation is the notification; parameters are the message. Not elegant, but it's real-time.

## 2. Mini Program → H5: Really Just the URL

The channel in the other direction is even narrower: for the mini program to pass data into the H5, **the official channel is URL parameters**.

```html
<!-- mini program wxml -->
<web-view src="https://example.com/page?token={{oneTimeToken}}&from=mp" bindmessage="onMessage" />
```

The H5 parses `location.search` at startup and gets its input. Want to push new data to the H5 mid-session? There's no direct API. The practical approach is to change the web-view's `src` (reloading with new parameters) — the page refreshes, so this only suits "switching to a different context", not "pushing an update".

Two things you must think through about URL parameters:

**Never put a long-lived token in the URL.** URLs end up in gateway logs, analytics logs, browser history. When you need to bridge login state between the mini program and the H5, the recommended approach is: the mini program side first calls `wx.login()` to get a code, sends it to its own backend to exchange for a **short-lived one-time ticket**, and puts the ticket in the URL; after startup, the H5 exchanges the ticket with the backend for the real session. The ticket is one-time and expires within minutes, so even if it leaks it's unusable. The backend's existing flow of using the code with `jscode2session` to get the openid stays unchanged; you've just added a "ticket for session" hop in the middle.

**Parameters are an initialization contract; versions must stay aligned.** The H5 will rename parameters across releases, but the mini program ships on a different cadence. The combination of an old mini program and a new H5 can appear at any time, so parameter parsing must be lenient: missing parameters fall back to defaults instead of throwing, extra parameters are ignored. Desynchronized releases on the two ends are the norm — design the code for that norm.

## 3. Four Real Pitfalls

**Pitfall one: postMessage is not real-time.** Covered above, but it gets its own entry because it's too famous. Every newcomer who touches web-view on this team falls for it once. Just remember this sentence: **what bindmessage receives is a batched replay of historical messages, not a live push.**

**Pitfall two: message timing collides with navigation timing.** "H5 fills out the form, postMessage carries the result back, then the mini program jumps to the result page" — if `navigateBack` comes right after postMessage, the message arrives via bindmessage at the moment of going back, and the timing works out. But if the H5 calls `navigateTo` directly to the result page, the destruction of the original page also triggers bindmessage — two channels deliver data at the same time, so the mini program side needs deduplication for "the same event arriving by two routes".

**Pitfall three: going back gives a blank screen, or back doesn't go back.** Tapping links inside the H5 pushes history entries layer by layer. When the user presses the mini program's back button, sometimes what goes back is the H5's history rather than the mini program's page — which feels like "pressed back and nothing happened". You need handling around `bindload` and the back-press timing: when the H5 is at its first level of history, back should pop the mini program page. WeChat has adjusted this behavior across versions, so before launch, walking the back-navigation path on a real device is mandatory.

**Pitfall four: the business domain is a hard constraint.** If the H5 navigates internally to a domain that isn't registered, the web-view blocks it outright. Campaign pages frequently link out to third-party landing pages — either collect every domain you might jump to in advance and register them all under the business domain, or funnel those jumps back into the mini program's own pages. Before launch, click through the full flow on a real device with production domains; that beats any documentation.

## 4. What Belongs in H5, and What Belongs in the Mini Program

Finally, back to the architecture decision. Embedding H5 via web-view is not a free lunch: you give up the performance of native mini program components, you're bound by the business domain restriction, and the communication channel is a one-way narrow pipe. My criterion is **change frequency and platform coupling**:

Operations campaigns, content display, rules explanations — pages that get **redesigned frequently and don't need deep system capabilities** — go into H5. The release cadence stays decoupled from the app, and that justifies the cost of isolation.

Payments, authorization, maps, Bluetooth — interactions that **depend heavily on WeChat capabilities** — go into native mini program pages. Don't detour through the web-view.

For the communication channel at the boundary between the two, keep it narrow as long as you can: pass results, pass tickets, pass context — say it once, clearly. Before you design "real-time interaction" into the plan, first ask whether the architecture put the piece in the wrong place.
