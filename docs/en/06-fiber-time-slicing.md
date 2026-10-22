# React Fiber: Why Rendering Can Pause

> Study notes. The previous post on garbage collection covered how the engine **frees up** time; this one covers how React **spends** it — Fiber, time slicing, and interruptible rendering are really three names for the same problem: a frame is only 16.6ms, and what do you do when that's not enough. The diagrams are my own.

Before React 15 (more precisely, before the Fiber architecture), a component tree update ran **in one breath**: reconcile recursively from the root, compare the whole tree, finish every DOM update, and only then hand the main thread back. Small trees were fine. But once the tree got deep and a single update took tens or even a hundred-plus milliseconds, user input and animations all froze — with no way to interrupt, because the recursion's state lived on the call stack. Break the stack, and you lose where you were.

Fiber exists to solve exactly one thing: **turn the recursion that can't stop into a work loop that can stop anytime and pick up where it left off.**

## 1. What Fiber Is: One Word, Three Meanings

In React's context, "Fiber" gets used in three places. Keep them separate or they blur together:

**An architecture.** React 15's Reconciler was the Stack Reconciler — the name says it all: execution state is pushed onto the call stack, and once the recursion starts, it runs to the bottom. The new architecture replaced it with a self-maintained scheduling loop, moving execution state from the stack to the heap.

**A data structure.** Each React element maps to a Fiber node, and the nodes are no longer parent-child function calls. They're a linked list held together by three pointers:

```typescript
interface Fiber {
  child: Fiber | null;    // first child
  sibling: Fiber | null;  // next sibling
  return: Fiber | null;   // parent
  // ...
}
```

This step is the foundation of the whole architecture: **recursion is uninterruptible because "where am I" is recorded on the call stack; once it's a linked list, "where am I" is just the node currently pointed at — a single variable.** Save that variable when you stop, resume from it when you come back, and nothing falls apart.

**A unit of work.** Each Fiber node also stores what needs doing this round: what changed in props, whether DOM has to move (effectTag), whether to mount or unmount. The scheduler takes one node at a time, processes it, checks the clock — budget left, keep going; none, yield.

![From recursion to linked list: the call stack replaced by list pointers](/diagrams/fiber-linked-list.svg)
> Figure 1 · Top: Stack Reconciler recurses — A calls B, B calls C, no stopping midway. Bottom: Fiber flattens the tree into a linked list with child / sibling / return pointers, and the work loop advances along the list, pausable at any step

## 2. The Frame Budget, and When to Yield

A browser frame has a budget of 16.6ms (60fps), and what runs inside it is fixed: handle events → run JS → `requestAnimationFrame` callbacks → style → layout → paint. JS is a tenant, not the landlord.

If this round of JS takes only 5ms, the browser sits idle for the remaining 11.6ms waiting for the next frame — **that idle time is exactly what Fiber wants to borrow**.

React splits render into small work units and checks the clock after each one:

```javascript
function workLoop(deadline) {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    // budget left, process the next unit of work
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  if (nextUnitOfWork) {
    // budget spent, book the next frame and continue
    requestIdleCallback(workLoop);
  }
}
```

That's time slicing: one 50ms monolithic render becomes a dozen or so 3–5ms chunks, slotted into the idle time of each frame. JS is working in every frame, but **no single frame is monopolized** — input events respond as usual, animations run as usual.

![A 16.6ms frame budget and time slicing](/diagrams/fiber-frame-budget.svg)
> Figure 2 · Top: without slicing, one long render monopolizes several whole frames and input events and paints queue up behind it. Bottom: with slicing, render is broken into small chunks fitted into each frame's idle time, and input and painting are no longer starved

React doesn't actually use `requestIdleCallback` — its support is spotty, its firing frequency doesn't align with screen refresh, and it can get throttled. React built its own scheduler on `MessageChannel`, semantically the same thing: **"main thread is free for a moment — ping me."**

A common follow-up: **why not generators?** A generator can indeed `yield` and pause midway, but what it pauses is the function call stack — resuming means walking back down the same call chain. There's no "pause here, go handle a higher-priority input first, then come back". And once any layer in the middle gets wrapped in a try-catch or other logic, the yield's propagation is cut off. Maintaining your own linked list with explicit checkpoints is a different order of control.

## 3. Two Phases: What Can Stop and What Can't

Fiber splits an update into two phases, with a hard boundary:

**The render phase — interruptible.** Compare the old and new Fiber trees (this is the diff) and mark nodes that need changes with side-effect flags. This phase **never touches real DOM** — it's pure in-memory computation — so it can stop anytime and be thrown away and redone.

**The commit phase — uninterruptible.** Execute all the side effects collected during render in one pass: real DOM insertions, updates, deletions; `getSnapshotBeforeUpdate`; `useLayoutEffect`; then `useEffect` asynchronously.

Why can't commit stop? **Because the user can see it.** Stop halfway through DOM changes and the user is looking at a half-new, half-old interface — layout doesn't add up, event listeners are half attached. If render computes something wrong, you recompute; if commit goes wrong, it's a display incident. So render can slice along slowly, but commit must be fast and done in one pass. This also explains a practical rule in reverse: **don't do heavy work in commit-phase hooks (`useLayoutEffect`)** — that hook sits on the uninterruptible channel, and heavy work there tears a hole in the slicing.

### Double Buffering: How Two Trees Swap

Render stops and resumes, so where does "the half-built new tree" live? The answer is two trees:

- **The current tree**: what's on screen right now, the product of commit;
- **The work-in-progress tree**: what render is building in memory.

Render advances on the work-in-progress tree (interruptible — doesn't matter, it's not on screen yet). When render finishes, commit flushes the work-in-progress tree's side effects to the screen in one pass, and the two trees swap roles — the work-in-progress tree becomes the new current tree, and the next update starts building on the old current tree.

![Double buffering and the two phases](/diagrams/fiber-two-phases.svg)
> Figure 3 · The render phase advances on the work-in-progress tree, pausable and recomputable; the commit phase flushes side effects to the screen in one pass, and the two trees swap the current / work-in-progress roles

Double buffering also makes "why keys must be stable" click: the diff runs between the old and new Fiber trees, and the key is the only credential for recognizing "this is still that node" across renders. Use array indices as keys, insert an item at the head of the list, and every node's identity shifts — React can't tell who is who and has no choice but to treat everything after it as new nodes and rebuild them.

## 4. Priorities: Not All Updates Are Equally Urgent

Slicing yields the main thread — and creates a new problem: what if a higher-priority update arrives mid-render?

Fiber's scheduler assigns tasks priorities. Synchronous interactions like user input come first; updates wrapped in `useTransition` are marked "transitional" and may compute slowly — if something more urgent cuts in line, they're discarded and redone. That's where `useTransition` comes from — it's not performance-optimization syntactic sugar; it's the interface for handing the scheduler the information that "this update can wait".

Filtering a large list on input is the classic case: the controlled update on the input box must be instant; filtering ten thousand rows can compute at leisure. You used to force it with debounce; now the scheduler arranges it — the input frame stays smooth first, and the filter slices run slowly behind it.

## 5. Putting It Together

| Concept | Problem it solves | How |
| --- | --- | --- |
| Stack Reconciler → Fiber | Recursion can't be interrupted | Call stack → linked list, execution state moved to the heap |
| Time slicing | Long renders jank frames | Work units + idle-time checks, yielding every 5ms |
| render / commit two phases | Consistency | Pure in-memory computation can be interrupted; DOM operations can't |
| Double buffering | Where progress lives after an interruption | The work-in-progress tree and current tree swap roles |
| Priority scheduling | Updates competing for time | Synchronous vs transitional updates, with preemption and recompute |

For everyday work, the usable takeaways:

**"The view didn't update right after setState" is not a bug.** The update enters a scheduling queue; render gets sliced and can be interrupted and redone by a higher-priority task. Build an "read the DOM immediately after update" assumption into display logic, and under concurrent mode it will bite you sooner or later.

**Don't do heavy work in `useLayoutEffect`.** It runs on the uninterruptible commit channel; heavy work there is adding the jank back yourself. Measuring layout is fine. Running computations is not.

**When a long list is slow, first ask whether render is doing too much pure computation.** Slicing fixes "interaction stutters", not "total time is long". Virtual scrolling cuts node count; `useMemo` cuts recomputation — Fiber can't do those jobs for you.

One last thread connecting the two notes: GC's incremental marking and tri-color marking, and Fiber's time slicing and interruptible rendering, are almost mirror images — while marking the memory graph, the engine needs to "mark a little, give a little time back"; while building the component tree, React needs to "compute a little, give a little time back". **Slicing long tasks plus explicitly checkpointing progress is the universal solution in the main-thread world** — work through one of them, and the other comes free.
