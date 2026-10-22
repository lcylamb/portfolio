# JS Garbage Collection: From Reference Counting to V8's Generational GC

> Study notes. Main references: *Deep Understanding of the V8 JavaScript Engine* and a few browser-engine write-ups. The diagrams are my own; every example runs.

When you write JS you don't manage memory. Declare an object, use it, stop caring — eventually it gets collected. Collection is the garbage collector's job, and its implementation lives in the host environment: the browser and Node.js each embed an engine, and V8 is one of them.

The test for "garbage" comes down to one sentence: can this object still be reached? Reachable means keep; unreachable means clear. The test itself is easy. What's hard is making the test cheap, and tidying up memory afterward.

Around that test, the mainstream has walked two roads: reference counting, and mark-and-sweep. On top of mark-and-sweep, V8 added a layer of generations. Followed in that order, a lot of things start to make sense.

## 1. Reference Counting: Count How Many Are Using It

The most direct idea. Each object keeps a number: incremented once per reference, decremented when a reference dies. At zero it's garbage — collect it on the spot.

```javascript
let a = { name: 'Object A' }; // A is referenced once
let b = a;                    // A is referenced twice
b = null;                     // once
a = null;                     // zero → A is garbage, collected immediately
```

The upside is immediacy. Collect at zero, no need to wait for the right moment, and the main thread never gets stuck on one big collection pass.

The problem is circular references — the fatal weakness of reference counting:

```javascript
function fight() {
  const objA = {};
  const objB = {};
  objA.ref = objB; // A references B
  objB.ref = objA; // B references A
}
fight(); // once the function returns, nothing outside can reach objA / objB anymore
```

The moment `fight()` returns, nothing outside can reach these two objects; they should be garbage. But they reference each other, so each one's count stays at 1 forever and never reaches zero. Every call to the function leaks two objects. Early IE's DOM objects died in exactly this pit.

This road ends here.

## 2. Mark-and-Sweep: From "Is Anyone Referencing It" to "Can It Still Be Found"

A different question. Don't look at who references it; look at whether it's reachable from the root objects. The roots are the global object, local variables on the current call stack, and the like.

Traverse recursively from the roots and mark every reachable object "in use". When traversal ends, whatever wasn't marked is garbage — clear it all at once.

Circular references stop being a problem here automatically: after `fight()` returns, the paths from the roots to `objA` and `objB` are gone, the traversal can never reach them, neither gets marked, and both get collected.

![Reachability in mark-and-sweep](/diagrams/gc-reachability.svg)
> Figure 1 · One reachability traversal from the root objects: the green objects are marked live; the red pair of circularly-referencing objects is off every reference chain and gets collected together

This also explains something else: assigning `null` to a variable is often called "manually breaking the reference". What it breaks isn't a count — it's reachability.

### 2.1 Cost One: Memory Fragmentation

Mark-and-sweep doesn't move objects. Whichever block gets cleared is where the space opens up. Free blocks end up scattered between live objects, so memory is no longer contiguous — that's fragmentation.

Fragmentation isn't fatal by itself. What's fatal is that it makes later allocations hard: you ask for 200KB, no single free block is big enough, and the allocation fails even though the total is sufficient. Hence three strategies for "which block to pick from the free list":

| Strategy | How it works | Notes |
| --- | --- | --- |
| First-fit | Return the first free block at least as large as the request | Fastest allocation, but leaves many small unusable tails |
| Best-fit | Walk the whole free list, pick the smallest block that fits | Best space utilization, but requires a full walk — slow |
| Worst-fit | Walk the whole free list, take the largest block and cut the request out of it | The remaining half is still large and reusable |

Real implementations lean on First-fit for speed, falling back to the other two when nothing fits. But all three only mitigate — fragmentation is always there, because the root cause is non-contiguous memory.

![Fragmentation vs. mark-compact](/diagrams/gc-fragmentation.svg)
> Figure 2 · Top: memory after mark-and-sweep — free blocks are scattered, total space is enough but no single block satisfies the request. Bottom: after mark-compact, live objects are packed to one end and the free memory is one contiguous block

### 2.2 Answer to Cost Two: Mark-Compact

If the problem is "memory isn't contiguous after sweeping", tidy up after sweeping. Mark-Compact's mark phase is identical to mark-and-sweep's; the difference comes after marking: push all live objects to one end of memory, then clear the entire block beyond the boundary.

After the move, objects sit flush against each other and the free region is one contiguous block — no fragmentation. The cost is that moving objects isn't cheap: every reference pointing at those objects has to be updated too. So mark-compact is generally not the default action on every collection; it runs only when needed. V8's old space works exactly this way, covered below.

## 3. V8: Generational GC

These algorithms share one waste: every collection inspects every object in the heap.

But objects aren't alike. A temporary object created inside an event callback lives for a few milliseconds; global config and caches live as long as the page does. Sweeping both kinds at the same frequency is never economical.

V8's answer: split the heap by lifespan into new space and old space, each with its own algorithm and its own collection frequency.

![V8 generational GC overview](/diagrams/gc-generations.svg)
> Figure 3 · The generational layout of the V8 heap: new space runs Scavenge with parallel collection; old space uses mark-and-sweep / mark-compact / incremental marking; objects that qualify get promoted from new space to old space

### 3.1 New Space: Scavenge, Move the Survivors Out

New space holds short-lived objects. The overwhelming majority of objects die here, so this region collects very frequently.

If objects live and die this fast, don't mark and sweep in place — just move the survivors out. That's the Scavenge algorithm, typically implemented as Cheney's copying algorithm.

Memory is split in two: the in-use half (From) and the idle half (To). The flow:

1. All new objects are allocated in From;
2. When From is nearly full, a collection triggers;
3. Mark the objects in From once;
4. Copy the marked live objects into To. Copying isn't a straight relocation — starting from the roots, objects are placed as they're traversed by reference, so they land in To naturally compact and adjacent. No separate compaction needed;
5. Clear From entirely;
6. The two halves swap roles; the next round runs the other way.

In plain terms, it trades space for time: only half the memory is ever used, but collection only touches live objects — dead ones are never handled at all — and no fragmentation is left behind.

![The three steps of Scavenge](/diagrams/gc-scavenge.svg)
> Figure 4 · Scavenge's three phases: mark → copy survivors into the To space, packed tight → clear the From space and swap the two halves' roles

An object is promoted to old space when it meets either condition:

**It has survived long enough.** Surviving multiple Scavenges means a long lifecycle; no reason to drag it back and forth every round.

**To space would pass 25% occupancy.** If promoting an object during the copy would push the idle half past 25% usage, promote it directly. The two halves are about to swap roles, so that region immediately becomes the new From; if its occupancy is too high, too little room remains and later allocations slow down noticeably.

New space collects so often that stopping the main thread every time would produce visible jank. So V8 runs marking and copying in parallel on multiple helper threads; the main thread only synchronizes on a few critical steps.

### 3.2 Old Space: Two Tools Plus Incremental Marking

Old space holds long-lived objects — the promoted ones, plus large objects allocated directly. Big in volume, collected rarely.

It uses the two tools from earlier: mark-and-sweep as the main pass, and mark-compact to move objects together when fragmentation starts hurting allocation.

The trouble is pausing. Old space is large; a full mark-and-sweep pass takes a while, and doing it in one go stops the main thread for tens or even a hundred-plus milliseconds — visibly noticeable jank on a 60fps page.

Hence incremental marking: cut marking into many small steps. Mark a bit, hand the main thread back to run some JS, alternate. One long pause becomes many short pauses of a few milliseconds, and users don't feel them.

### 3.3 Tri-Color Marking: Where Does Half-Finished Progress Live

Incremental marking raises a new problem: marking is no longer done in one breath. It gets interrupted, other work happens, then marking resumes. So where do you record "how far did I get"?

The old two states, "marked / unmarked", aren't enough. There must be a third in between:

White means not yet visited — anything still white when marking ends is garbage. Gray means the object itself was visited but the children it references haven't been scanned yet. Black means the object and everything it references have been fully scanned.

![Tri-color marking and the write barrier](/diagrams/gc-tricolor.svg)
> Figure 5 · Top: what the three states mean. Bottom: a heap snapshot taken mid-marking — the gray object B is the breakpoint, and the write barrier is what intercepts A's newly added reference to a white object

The progress at the moment of interruption lives on the gray objects. Resume by continuing downward from them; when everything is scanned and no gray remains, the leftover white objects are the garbage to clear this round.

But incremental marking (and later, concurrent marking) left a gap: while marking is paused, application code is still mutating references. The classic missed-mark scenario is a black object gaining a reference to a white object — the black object has been fully scanned and will never be looked at again:

```javascript
// user code runs while marking is paused:
blackObj.child = whiteObj; // a black → white reference; this edge will not be rescanned
```

When marking resumes, nobody re-checks that black object, and the white object it now points to gets misjudged as garbage and deleted. The thing that plugs this gap is the write barrier: a hook on the action "write a reference into an object property". The moment a black object references a white one, the barrier immediately turns that white object gray, forcing it into the next scan round. Only with the write barrier as a backstop does incremental marking dare to interleave with application code.

## 4. Putting It Together

| Stage | Strategy | Core idea | What it solved | What it left open |
| --- | --- | --- | --- | --- |
| 1 | Reference counting | Zero references = garbage | Immediate collection | Circular references never collected |
| 2 | Mark-and-sweep | Reachability from the roots | Circular references | Memory fragmentation, slow allocation |
| 2.5 | Mark-compact | Move live objects to one end | Fragmentation | Moving objects has its own cost |
| 3 | V8 generational GC | New space / old space by lifespan, each with its own algorithm | Unnecessary full-heap scans | — |
| 3.1 | New space: Scavenge | From/To copying + parallel collection | Fast collection, no fragmentation, no main-thread stalls | 50% space utilization |
| 3.2 | Old space | Mark-and-sweep + mark-compact + incremental marking | Large-heap collection without jank | Needs tri-color marking + write barrier bookkeeping |

For everyday coding, the usable takeaways are few:

Circular references don't cause leaks today — mark-and-sweep exists precisely to solve them. But timers, event listeners, and closures that hold large objects for a long time still keep those objects reachable, and uncollectable.

A cache hanging off `window` is a naturally resident object. When it should be cleared, explicitly set it to `null` to break reachability.

Don't create large objects repeatedly on hot paths. Even when they can be collected, they make new-space GC trigger more often — collection itself is cheap; it's the frequency that costs.
