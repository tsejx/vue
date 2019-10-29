/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * 渲染函数的观察者
 * 观察程序解析表达式，收集依赖，并在表达式值更改时触发回调
 * 它被用于 $watch API 以及指令
 *
 * 每个 vm 对应一个 watcher，其依赖的 data 中的一个或多个属性，而不是一个 data 的属性对应一个 watcher
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component, /* 组件实例对象 */
    expOrFn: string | Function, /* 要观察的表达式 */
    cb: Function, /* 当被观察的表达式的值发生变化时触发的回调函数 */
    options?: ?Object, /* 一些传递给当前观察者对象的选项 */
    isRenderWatcher?: boolean /* 标识该观察者对实例是否是渲染函数的观察者（除了渲染函数的观察者，还有用户设定的观察则） */
  ) {
    // 组件实例
    // 该属性指明了当前观察者是属于哪个组件实例的
    this.vm = vm
    // 标识是否渲染函数的观察者
    // 只有在 mountComponent 函数中创建渲染函数时这个参数才为真
    if (isRenderWatcher) {
      // 将当前观察者实例赋值，因此 vm._watchers 引用着当前组件的渲染函数观察者
      vm._watcher = this
    }
    // _watchers 存放订阅者实例
    // 说明属于该组件实例的观察者都会被添加到该组件实例对象的 vm._watchers 数组中
    // 包括渲染函数的观察者和非渲染函数的观察者
    vm._watchers.push(this)
    // options
    if (options) {
      // 用来告诉当前观察者实例对象是否是深度观测
      this.deep = !!options.deep
      // 标识当前观察者实例对象是 开发者定义的 还是 内部定义的
      // 内部定义包括渲染函数的观察者和计算属性的观察者
      this.user = !!options.user
      this.lazy = !!options.lazy
      // 用来告诉观察者当数据变化时是否同步求值并执行回调
      this.sync = !!options.sync
      // 可以理解为 Watcher 实例的钩子，当数据变化之后，触发更新之前，调用在创建渲染函数的观察者实例对象时传递的 before 选项。
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    // 回调函数
    this.cb = cb
    // 观察者实例的唯一标识
    this.id = ++uid // uid for batching
    // 标识该观察者实例是否是激活状态
    this.active = true
    // 只有计算属性的观察者实例对象为真，因为计算属性是惰性求值
    this.dirty = this.lazy // for lazy watchers
    // 以下四组用于实现避免重复收集依赖，且移除无用依赖的功能也依赖于它们
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      // 如果是函数，则作为 this.getter
      this.getter = expOrFn
    } else {
      // 如果不是函数，则通过 parsePath 转换表达式为一个新的函数
      // 这里处理的是 $watch 的键路径
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 保存着被观察目标的值
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   *
   * 作用：求值
   * 1.能够触发访问器属性的 get 拦截器函数
   * 2.能够获得被观察目标的值
   * 能够触发 getter 拦截器是依赖收集的关键
   */
  get() {
    // 该函数用于缓存 Watcher
    // 因为在组件含有嵌套组件的情况下，需要恢复父组件的 Watcher
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 调用回调函数，也就是 updateComponent 函数
      // 在这个函数中会对需要双向绑定的对象「求值」，从而触发依赖收集
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 递归地读取被观察属性的所有子属性的值
        // 这样被观察属性的所有子属性都将会收集到观察者
        traverse(value)
      }
      // 恢复 Watcher
      popTarget()
      // 清理依赖，判断是否还需要某些依赖，不需要的清除
      // 该函数的主要目的是性能优化
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   *
   * @param {Dep} 依赖容器
   * 添加依赖关系到 Deps 集合中
   *
   * newDepIds 用于避免「一次求值过程中收集重复的依赖」
   * depIds 用于多次求值中避免收集重复依赖（多次求值是指当数据变化时重新求值的过程）
   * 每次求值后 newDepIds 都会清空，也就是说每次重新求值的时候对于观察者实例对象来讲 newDepIds 属性始终是全新的，虽然会清空，但是他们在清空之前会赋值给 depIds 和 deps，这样重新求值的时候 depIds 和 deps 属性将保存上次求值中 newDepIds 属性以及 newDeps 属性的值
   *
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 以下判断是用于避免收集重复依赖的
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        // 调用 Dep 中的 addSub 函数
        // 将当前 Watcher push 进数组
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   *
   * 清理依赖收集
   */
  cleanupDeps() {
    // 移除所有观察者对象
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   *
   * 派发更新，当依赖发生改变的时候进行回调
   * 遍历数据对象所有依赖，并调用 watcher 实例的 update
   *
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 同步，则执行 run 直接渲染视图
      this.run()
    } else {
      // 异步，把观察者推送到异步更新队列中，这个队列会在调用栈被清空之后按照一定的顺序执行
      // 真正的更新变化操作都是通过调用观察者实例对象的 run 方法完成的
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   *
   * 调度者工作接口，将被调度者回调
   */
  run() {
    // 当前观察者是否处于激活状态，或者可用状态
    if (this.active) {
      // 重新求值
      // get 操作在获取 value 本身也会执行 getter 从而调用 update 更新视图
      // 对于渲染函数的观察者来讲，重新求值其实等价于重新执行渲染函数，最终结果就是重新生成了虚拟 DOM 并更新真实 DOM，实际上就完成了重新渲染的过程
      const value = this.get()
      // 对于渲染函数的观察者来讲并不会执行以下逻辑
      // 因为 this.get 返回值其实等价于 updateComponent 函数返回值，这个值永远都是 undefined
      // 以下逻辑是为非渲染函数类型的观察者准备的，它用于对比新旧两次求值的结果，当值不想等的时候会调用通过参数传递进来的回调
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        // 即便值相同，拥有 Deep 属性的观察者以及在对象/数组上的观察者应该被触发更新，因为它们的值可能发生改变
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        // 设置新的值
        this.value = value

        // 触发回调
        if (this.user) {
          // this.user 为真意味当前观察者由开发者定义
          // 所谓开发者定义即 watch 选项或 $watch 函数定义的观察者
          // 这些观察者的特点是回调函数是由开发者编写的，所以这些回调函数在执行过程中其行为是不可知的
          try {
            // 回调函数作用域设置为 Vue 组件对象
            // 新旧值
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   *
   * 获取观察者的值（只用于惰性观察者，例如 computed watcher）
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   *
   * 收集该 watcher 的所有 deps 依赖
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   *
   * 将自身从所有依赖收集订阅列表删除
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      //
      // 每个组件实例都有 vm._isBeingDestroyed 说明该组件实例已经被销毁
      // 由于该操作比较耗费资源，所以仅在 vm 实例组件「未被」或「非正在」销毁情况下执行
      if (!this.vm._isBeingDestroyed) {
        // 从 vm 实例的订阅者列表中将自身移除
        remove(this.vm._watchers, this)
      }
      // 将当前观察者实例对象从 Dep 实例对象中移除
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 表示观察者对象实例处于非激活状态
      this.active = false
    }
  }
}
