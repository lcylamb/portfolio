# Vue 响应式：从 defineProperty 到 Proxy

> 学习笔记。素材是自己整理的 Vue2 / Vue3 双栈开发中撞到过的差异，图是自己画的，代码段都能跑。

双栈开发有个特别的体验：同一个业务、同一份表单逻辑，Vue2 里「改了没反应」的写法，Vue3 里忽然就通了——`this.obj.newKey = 1` 在 Vue2 里页面纹丝不动，Proxy 版里直接生效。

这不是魔法升级，是响应式系统换了实现根基。把这次更换捋清楚，两代框架一大半的「行为差异」都能解释。按顺序来：Vue2 怎么做的、缺什么、Proxy 补了什么、以及为什么 Proxy 一定要配 Reflect。

## 一、Vue2：初始化时递归劫持每个属性

`Object.defineProperty` 一次只能劫持**一个已存在的属性**的读写。要响应式整个对象，就得在初始化时递归遍历，为每个属性都包一层：

```javascript
function defineReactive(obj, key, val) {
  observe(val); // 嵌套对象继续递归
  const dep = new Dep();
  Object.defineProperty(obj, key, {
    get() {
      Dep.target && dep.depend(); // 渲染时收集：谁在读我
      return val;
    },
    set(newVal) {
      if (newVal === val) return;
      val = newVal;
      observe(newVal);
      dep.notify(); // 派发更新：刚才读我的都重来
    },
  });
}
```

![Vue2 响应式：初始化递归 + getter 收集 / setter 派发](/diagrams/reactivity-defineproperty.svg)
> 图 1 · 初始化时递归遍历整棵数据树，给每个已有属性装上 getter / setter；红色三类是这套机制天生够不着的

getter 里收集依赖、setter 里派发更新，思路本身是通顺的。问题全出在「**初始化时**」和「**每个已存在的属性**」这两个定语上。

**新增、删除属性，抓不到。** `defineProperty` 是按属性名逐个注册的，新增的属性没注册过，没有 setter，改了也没人知道。`delete` 同理——删除只是让属性消失，不会触发任何回调。所以 Vue2 一定要有 `Vue.set` / `Vue.delete`，本质是绕过对象自己，用「改完手动通知」补上缺口。

**数组索引和 `length`，抓不到。** 给 `list[3]` 赋值、改 `list.length`，`defineProperty` 都不感知。Vue2 的补丁是重写数组的七个变异方法——`push / pop / shift / unshift / splice / sort / reverse`。为什么是这七个？因为它们是唯一会**改变数组内容**的方法，其它（`map`、`filter`、`slice`）都返回新数组，重新赋值就能触发 setter。这七个方法被换成了「先执行原生操作、再手动 `dep.notify()`」的版本。

**初始化开销大。** 不管一个嵌套属性将来用不用，初始化时都要全量递归、逐个 `defineProperty`。一个大对象（比如整份理赔单数据）放进 `data`，首屏就多了一笔遍历税。

这三个缺陷是同一个根源的三个投影：**劫持的单位是「属性」，而属性之外的操作——新增、删除、索引——都不在射程里。**

## 二、Vue3：从「劫持属性」换成「代理对象」

Proxy 的拦截单位不是属性，是**对整个对象的操作**：

| 拦截的操作 | handler 方法 | 对应写法 |
| --- | --- | --- |
| 属性读取 | `get` | `obj.prop`、`obj['prop']` |
| 属性写入 | `set` | `obj.prop = val` |
| 属性删除 | `deleteProperty` | `delete obj.prop` |
| 存在性检查 | `has` | `'prop' in obj` |
| 列举键名 | `ownKeys` | `Object.keys(obj)` |

新增属性走 `set`，删除走 `deleteProperty`，数组索引和 `length` 也是普通的 `get` / `set`——Vue2 的三个缺陷，是同一个替换的三份红利。`Vue.set` 被废弃了，七个变异方法不用重写了。

还有一个不那么显眼的收益：**懒代理**。Vue2 是初始化时把整棵树递归劫持完；Vue3 是访问到哪一层，才代理哪一层：

```javascript
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      const result = Reflect.get(target, key, receiver);
      // 访问到的嵌套对象才转响应式，没访问到的分支一分钱不花
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

![defineProperty 全量递归 vs Proxy 懒代理](/diagrams/reactivity-proxy-lazy.svg)
> 图 2 · 上半：Vue2 在初始化时递归整棵树，每个属性都要装 getter / setter；下半：Vue3 只有被访问到的分支才逐层建代理，深层的、没用到的字段保持原样

一个大对象只渲染其中两三个字段，Vue2 照样全量递归，Vue3 只碰被读取的路径。列表页拿到的接口数据往往是「几十个字段用三个」，这笔账平时不显眼，首屏指标紧的时候很显眼。

## 三、为什么一定要配 Reflect

`reactive` 实现里最容易被问的问题：`Reflect.get(target, key, receiver)` 为什么不直接写 `target[key]`？

关键场景是**嵌套的 getter**：

```javascript
const raw = {
  get fullName() {
    return `${this.first} ${this.last}`;
  },
};

const proxy = new Proxy(raw, {
  get(target, key, receiver) {
    return Reflect.get(target, key, receiver); // this 指向 proxy
    // return target[key];  // this 指向 raw，灾难
  },
});
```

`target[key]` 走的是原始对象，getter 里的 `this` 就是 `raw`。`this.first` 这次读取**不经过代理**，`track` 收集不到依赖——页面上的后果是「first / last 变了，fullName 不更新」。

`Reflect.get(target, key, receiver)` 的第三个参数把 `receiver`（也就是代理对象）指定为 getter 里的 `this`，于是 `this.first` 又被送回代理的 `get` 拦截器，依赖收集接上了。**Proxy 负责拦，Reflect 负责「按原始语义放行但把 this 修对」，两者是搭档不是重复。**

另一层原因是返回值规范：`Reflect.set` 返回布尔值表示成败，直接适配 Proxy handler 的返回要求（`set` 拦截器被要求返回布尔）。手写 `target[key] = value` 拿不到这个信号，操作失败（比如属性是只读的）只能靠异常去猜。

顺带解释 `ref` 的 `.value`：Proxy 只能包对象，`number` / `string` 这种基本类型包不住。`ref` 的做法是把值装进 `{ value: x }` 的对象里，对这个对象做响应式——模板里自动解包，只是把这层包装藏了起来。**`.value` 不是 API 设计偏好，是「基本类型没有 proxy 通道」的必然产物。**

## 四、依赖收集到哪去了：targetMap

Vue2 每个属性闭包里揣着一个 `Dep`；Vue3 的 Proxy 拦截器是所有属性共用的，依赖改放在一张全局表里：

```typescript
const targetMap = new WeakMap(); // 原始对象 → (key → 依赖它的 effect 集合)
let activeEffect: (() => void) | null = null;

function track(target: object, key: string | symbol) {
  if (!activeEffect) return; // 不在 effect 里读，不用记
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

三层结构各管一件事：`WeakMap` 按对象分（key 弱引用，对象被销毁，依赖跟着回收，不用手动清理）；`Map` 按属性分；`Set` 去重——同一个 effect 读同一个属性十次，也只记一份。

用 `Set` 去重这件事，顺便解释了一个 Vue3 的著名行为：组件里连续改同一个 ref 三次，视图只更新一次——三次 `trigger` 往同一个 `Set` 里塞的是同一个 effect，批处理之后跑一遍。

## 五、串起来看

| | Vue2（defineProperty） | Vue3（Proxy） |
| --- | --- | --- |
| 拦截单位 | 单个已存在的属性 | 整个对象的操作 |
| 新增 / 删除属性 | 抓不到，要 `Vue.set` / `Vue.delete` | 原生支持 |
| 数组索引 / length | 抓不到，要重写 7 个变异方法 | 原生支持 |
| 初始化 | 全量递归劫持 | 懒代理，访问到才转 |
| 依赖存放 | 每个属性闭包里的 Dep | 全局 targetMap（WeakMap） |
| Map / Set | 不支持 | 支持专门的处理 |

落到日常写代码，真正要记住的是这几条：

**解构会断。** `const { name } = reactive(obj)` 拿到的是原始值，和代理断开了——之后改 `obj.name`，`name` 不会更新。要解构用 `toRefs`。这不是 Proxy 的 bug，是「值拷贝」和「引用追踪」的本义冲突。

**整对象替换要小心。** `state = { ...newData }` 换的是变量指向，不是代理里的属性，监听不到。该逐字段赋值就逐字段赋值。

**Vue2 的七个变异方法名单值得背。** 判断「这个操作在老项目里能不能被侦测到」，靠的就是知道哪些方法被重写过：会改变数组内容的被重写了，返回新数组的都要重新赋值。

最后一点感受：Vue3 换 Proxy 不是「新技术替换旧技术」，而是**拦截的抽象层级上移了一层**——从「属性的读写」上移到「对对象的操作」。当年 `Vue.set`、重写数组方法，都是在旧层级上打补丁；层级一换，补丁全部失去存在意义。很多「框架行为差异」，根子都在这种抽象层级上。
