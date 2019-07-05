/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/**
 * 数据对象代理到 vm 实例上
 *
 * @param {*} target 代理目标 vm
 * @param {*} sourceKey 代理源
 * @param {*} key 键
 * @example 将 vm._data.foo => vm.foo
 */
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }

  // vm.key.getter => sharedPropertyDefinition.get => vm[sourceKey][key]
  // vm.key.setter => sharedPropertyDefinition.set
  // 相当于
  // vm.message => vm._data.message
  // _data 不要使用
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 初始化 Props
  if (opts.props) initProps(vm, opts.props)
  // 初始化 Methods
  if (opts.methods) initMethods(vm, opts.methods)
  // 初始化 Data
  if (opts.data) {
    initData(vm)
  } else {
    // observe 是将 data 转换成响应式数据的核心入口
    // 该组件没有 data 的时候绑定一个空对象
    // $data 是访问器属性，其代理的值就是 vm._data
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化 Computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化 Watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// 初始化 Props
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 初始化 Data 函数
function initData(vm: Component) {
  // vm.$options.data 最终被处理成函数，该函数的执行结果才是真正的数据
  let data = vm.$options.data
  // 获取数据对象，赋值给 vm._data 属性，并重写需要返回的最终的数据对象 data 变量
  data = vm._data = typeof data === 'function'
    ? getData(data, vm) /* 获取真正的数据 */
    : data || {}
  // 判断 data 是否为对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 代理 data 到 vm 实例上
  // 下面它們之间会做对比 目的是防止这些需要代理的属性方法之间出现重名情况
  // 键名优先级：props > data > methods
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // 遍历 data 对象的键名
  // while 遍历方法从后向前递减
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 判断是否是 Vue 保留字段（不会代理 $ 和 _ 开头的字段，目的是避免与 Vue 自身的属性和方法相冲突）
      // 这里是真正的将 data 上属性代理到 vm 实例上
      proxy(vm, `_data`, key)
    }
  }
  // 调用 observe 函数对 data 数据对象转换成响应式
  // 作为根数据，下面会进行递归 observe 进行深层对象的绑定
  observe(data, true /* asRootData */)
}

// initData 当传入的 data 为函数时调用该函数
// 功能：通过调用 data 选项从而获取数据对象
// 1. data 为函数
// 2. vm Vue 实例对象
// 该函数的作用其实时通过调用 data 函数获取真正的数据对象并返回，即
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // pushTarget 防止使用 props 数据初始化 data 数据时收集冗余的依赖
  pushTarget()
  // 捕获调用 data 函数时可能出现的错误
  // 如果调用出错将饭回空对象
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    // 计算属性配置对象对应的属性值（可以是函数也可以是对象）
    const userDef = computed[key]
    // 计算属性可能是一个 function，也有可能设置了 get 以及 set 的对象
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 计算属性的观察者
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions /* 用于标识一个观察者对象是计算属性的观察者 */
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // 组件实例中无同名属性
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 如果计算属性与已定义的 data 或者 props 中的名称冲突则发出 warning
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

/**
 * 通过 Object.defineProperty 函数在组件实例对象上定义与计算属性同名的组件实例属性，而且是访问器属性，属性的配置参数是 sharedPropertyDefinition
 * @param {*} target
 * @param {*} key
 * @param {*} userDef
 */
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 是否应该缓存值（只有在非服务端渲染情况下计算属性才缓存值）
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    // computed 选项为函数

    // 设置 getter / setter
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    // computed 选项为对象
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 访问 computed 值时触发的回调函数
// 生成 computed 属性的 getter
function createComputedGetter (key) {
  return function computedGetter() {
    // 用于计算 computed key 的观察者对象
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

/**
 * 通过创建 Watcher 实例对象来实现观测
 * 创建过程会读取指定到 watch 选项的 函数名、字符串等
 * @param {*} vm
 * @param {*} watch
 */
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

/**
 * 将纯对象形式的参数规范化，通过 $watch 创建观察者
 * @param {*} vm
 * @param {*} expOrFn
 * @param {*} handler
 * @param {*} options
 */
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    // handler 可以是字符串也可以是函数
    // 如果是字符串则指定 methods 中该名称的方法为回调函数
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 真正创建 watcher
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 用于观测某个数据对象的某个属性，当属性变化时执行回调
  // 本质上就是创建一个 Watcher 的实例对象
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any, /* 回调函数 */
    options?: Object
  ): Function {
    // 表示当前组件实例对象
    const vm: Component = this
    // 第二参数是否是纯对象
    if (isPlainObject(cb)) {
      // 第二参数未纯对象
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // user 模式
    // 表示创建的观察者实例 watcher 由开发者创建
    options.user = true
    // 创建观察者实例
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      // 如果 immediate 立即执行
      // 此时回调函数只有新值没有旧值
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn() {
      // 用于解除当前观察者对属性的观察
      watcher.teardown()
    }
  }
}
