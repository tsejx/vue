# Vue 源码注释

进度：

- [ x ] 初始化
- [ x ] 响应式系统
- [ ] 虚拟 DOM
- [ ] 编译
- [ ] 扩展（API 实现原理）
- [ ] 服务端渲染

## 目录

**核心模块**

- compiler：编译代码，将 template 编译为 render 函数
- core：通用，与平台无关代码
  - observer：响应系统，包含数据监测的核心代码
  - vdom：虚拟 DOM 创建和打补丁的代码
  - instance：Vue 构造函数设计相关代码
  - global-api：给 Vue 构造函数挂载全局方法（静态方法）或属性的代码
  - components：抽象通用组件
- platforms：不同平台不同构建入口
  - web
  - weex
- server：服务端渲染相关代码
- sfc：单文件组件的解析逻辑，用于 vue-template-compiler
- shared：框架通用代码

## 构建输出

模块输出形式：

- UMD => umd
- CommonJS => cjs
- ES Module => es

## 功能模块

### 初始化

```js
// core/instance/index.js

// Vue 构造函数
function Vue(){/* ... */}
```

```js
// core/instance/init.js

// 挂载 _init 至 Vue.prototype
function initMixin() {/* ... */}
```

```js
// core/instance/state.js

// 初始化 props、methods、data、computed、watch
function initState() {/* ... */}

// 数据对象代理至 vm 实例上
function proxy() {/* ... */}

// 初始化 Props
function initProps() {/* ... */}

// 初始化 Data 函数
function initData() {/* ... */}

// initData 当传入 data 为函数类型时调用以获取数据对象
function getData() {/* ... */}

// 初始化 Computed
function initComputed() {/* ... */}

// 通过 Object.defineProperty 函数在组件实例上定义与计算属性同名的数据对象字段的访问器属性
function defineComputed() {/* ... */}

// 访问 computed 值时触发的回调函数，生成 computed 属性的 getter
function createComputedGetter() {/* ... */}

// 初始化 Methods
function initMethods() { /* ... */ }

// 初始化 Watch
function initWatch() {/* ... */}

// 将纯对象形式的参数规范化，通过 $watch 创建观察者
function createWatcher() {/* ... */}

// 定义 $data、$props、$set、$delete、$watch 等全局方法
function stateMixin() {/* ... */}
```

```js
// core/instance/eventsMixin.js

// 定义 $on、$off、$once、$emit
function eventsMixin() {/* ... */}
```

### 观察数据

```js
// core/observer/index.js

// 附加至每个数据对象字段的观察者类（data、props）
class Observer {
  // 遍历对象类型的数据对象的所有可枚举属性，并执行 defineReactive
  walk() { /* ... */ }
  // 遍历数组类型的数据对象的每个成员并 observe
  observeArray() { /* ... */ }
}

// 尝试为每个数据对象的字段创建观察者实例
function observe() { /* ... */ }

// 为数据字段创建依赖收集容器，并进行响应式化（初始化双向绑定）
function defineReactive() { /* ... */ }

// 与 Vue.$set 一致，手动地针对对象某个键值作响应式化
function set() { /* ... */ }

// 与 Vue.$delete 一致，手动地针对对象某个键值去除数据观察
function del() { /* ... */ }
```

```js
// core/observer/dep.js

class Dep {
  // 添加依赖
  addSub() { /* ... */ }

  // 移除依赖
  removeSub() { /* ... */ }

  // 依赖收集，调用 watcher.addDep => Dep.addSub
  depend() { /* ... */ }

  // 通知订阅容器内所有 watcher 进行更新 update
  notify() { /* ... */ }
}

// 把 watcher 储存于缓存栈中
function pushTarget() { /* ... */ }

// 从缓存栈中取出 watcher
function pushTarget() { /* ... */ }
```

```js
// core/observer/watcher.js
class Watcher {
  // 获取观察目标值，相当于触发相关数据字段 getter 拦截函数，从而进行依赖收集
  get() { /* ... */ }

  // 添加依赖至 Dep 实例的依赖容器内
  // 对重复追踪依赖的可能作了优化
  addDep() { /* ... */ }

  // 清理依赖收集
  cleanupDeps() { /* ... */ }

  // 派发更新，当观察数据字段发生改变时进行回调
  update() { /* ... */ }

  // 重新求值，将被调度者回调
  // 处理 user watcher 的回调函数执行
  run() { /* ... */ }

  // 获取观察者的值，指用于惰性观察者，如 computed watcher
  evaluate() { /* ... */ }

  // 收集该 watcher 的所有 deps 依赖
  depend() { /* ... */ }

  // 将自身从所有依赖收集订阅容器中删除
  teardown() { /* ... */ }
}
```
