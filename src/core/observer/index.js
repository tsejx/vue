/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 *
 * 在某些情况下，我们可能希望在组件的更新计算中禁用 observe
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 *
 * 附加到每个被观察对象的观察者类
 * 一旦被添加，观察者就将目标对象的属性键转换为 getter / setter，
 * 这些 getter / setter 负责 收集依赖 以及 调度更新
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    // 观察值
    this.value = value
    // 用于收集订阅者，并在数据变更时发布更新
    // 可以理解为收集依赖的容器
    this.dep = new Dep()
    this.vmCount = 0

    // 将 Observe 实例绑定到 data 的 __ob__ 属性上
    // 之前说过 observe 的时候会先检测是否已经有 __ob__ 对象存放 Observer 实例
    // def 方法定义参考 https://github.com/vuejs/vue/blob/dev/src/core/util/lang.js#L16
    // 如果该值下次被 observe 时，则直接返回 __ob__，避免重复 observe
    // __ob__ 不能枚举，这样后面遍历数据对象的时候就能够防止遍历到 __ob__ 属性
    def(value, '__ob__', this)

    if (Array.isArray(value)) {
      // 如果观察的属性为数组类型，将修改后可以截获响应的数组方法替换掉该数组原型中的原生方法，达到监听数组数据变化响应的效果
      // 如果浏览器支持隐式原型对象（__proto__），则直接覆盖当前数组对象原型上的原生数组方法
      // 如果不支持，则直接覆盖数组对象的原型
      if (hasProto) {
        // 直接覆盖原型的方法来修改目标对象
        protoAugment(value, arrayMethods)
      } else {
        // 定义（覆盖目标对象或数组的某个方法）
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 如果是数组则需要遍历数组的每个成员进行观察 递归
      this.observeArray(value)
    } else {
      // 如果是对象则直接 walk 进行绑定
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   *
   * 遍历对象所有可枚举属性，并且在它们上面绑定 getter 与 setter
   * walk 方法只有在 value 的类型是对象的时候才能被调用
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 在 walk 函数中调用 defineReactive 函数时不获取属性值
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   *
   * 对数组每个成员进行观察
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * 直接覆盖原型的方法来修改目标对象或数组
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 *
 * 定义（覆盖）目标对象或数组的某个方法
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * 尝试为一个值创建一个观察者实例（__ob__）
 * 如果观察成功，则返回新的观察者
 * 如果该值已有一个观察者，则返回现有的观察者
 *
 * @param {object} value 要观察的对象
 * @param {boolean} asRootData 将要被观测的数据是否是根级数据
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // 观测的对象必须是对象，并且是 VNode 的实例
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 判断将要观察的对象是否含有 __ob__ 属性，并且 __ob__ 属性应该是 Observer 的实例
  // 如果为真则直接将数据对象自身的 __ob__ 属性的值作为 ob 的值
  // 作用：避免重复观察同一个数据对象
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    // 如果据对象上没有定义 __ob__ 属性，那么说明该对象没有被观测过
    // 这里的判断是为了确保 value 是单纯的对象，而不是 函数 或者是 Regexp 等情况
    shouldObserve && /* 数据对象是否可观测的开关 */
    !isServerRendering() && /* 是否是服务端渲染 */
    (Array.isArray(value) || isPlainObject(value)) && /* 当数据对象是数组或纯对象的时候 */
    Object.isExtensible(value) && /* 被观测的对象是可扩展的 */
    !value._isVue /* 避免 Vue 实例被观测 */
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    // 如果是根数据则计数
    // 后面 Observer 中的 observe 的 asRouutData 非 true
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 *
 * 在对象上定义响应式特性
 *
 * @param {*} obj 数据对象
 * @param {*} key 键名
 * @param {*} val 键值
 * @param {*} customSetter
 * @param {*} shallow
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 发布者
  // 为什么是闭包？因为 dep 定义在 defineReactive 内部
  // 但是在在数据对象的 getters 和 setters 都有使用到
  // 每个数据字段都通过了闭包引用者着属于自己的 dep 常量
  // 因为在 walk 函数中通过循环遍历了所有数据对象的属性，并带哦用 defineReactive 函数，所以每次调用 defineReactive 定义访问器属性时，该属性的 setter /setter 都闭包引用了一个属于自己的容器
  // 每个字段的 Dep 对象都被用来收集那些属于对应字段的依赖
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 对象不可配置则不必对该值修改
  // 小技巧：如果有纯展示数据可 Object.freeze 则数据不必响应式化，减少内存消耗
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 如果之前该对象已经预设了 getter 以及 setter 函数则将其取出来
  // 并在新定义的 getter / setter 中会将其执行
  // 保证不会覆盖之前已经定义的 getter / setter
  const getter = property && property.get
  const setter = property && property.set
  // 当属性原本存在  get 拦截器函数，在初始化的时候不要触发 get 函数，只有当真正地获取该属性的值的时候，
  // 再通过调用缓存下来的属性原本的 getter 函数取值即可
  // 如果数据对象的某个属性原本就拥有自己的 get 函数，那么这个属性就不会被深度观测
  // 因为当属性原本存在 getter 时，是不会触发取值动作的，即 val = obj[key] 不会执行，即 val 时 undefined
  // 这就导致在后面深度观测的语句中传递给 observe 函数的参数是 undefined
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 深度观测对象（默认深度观测）
  // 对对象的子对象递归进行 observe 并返回子节点的 Observer 对象
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      // 如果原本对象拥有 getter 方法则执行
      const value = getter ? getter.call(obj) : val
      // Dep.target 的值为将被收集的依赖（观察者）
      // 因此 Dep.target 存在的话说明有依赖需要被收集
      if (Dep.target) {
        // 进行依赖收集
        dep.depend()
        if (childOb) {
          // 子对象进行「依赖收集」，其实就是将同一个 watcher 观察者实例放进了两个 depend 中
          // 一个是正在本身闭包中的 depend，另一个是子元素的 depend
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // 是数组则需要对每个成员都进行依赖收集，如果数组的成员还是数组，则递归
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter(newVal) {
      // 通过 getter 方法获取当前值，与新值进行比较，新旧值一致则不需要执行下面的操作（也就是监听值没变化）
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        // 如果原本对象拥有 setter 方法则执行 setter
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 新的值需要重新进行 observe，保证数据响应式
      childOb = !shallow && observe(newVal)
      // dep 对象通知所有的观察者（派发更新）
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 *
 * @param {array|object} 将要被添加属性的对象
 * @param {any} 键名
 * @param {any} 值
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  // Vue.set 头参为 undefined/null 及其他基础数据类型，非生产环境会警告
  // 理论上只为对象（数组）添加属性（元素）
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 如果需要添加属性的对象为数组类型
  // 则在指定位置插入 val
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    // 因为数组不需要进行响应式处理，数组会修改7个 Array 原型方法进行响应式处理
    return val
  }
  // 如果需要添加属性的对象为纯对象类型，并且已经存在了这个 key 则直接返回
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  // 获得 target 的 Observer 实例
  const ob = (target: any).__ob__
  // _isVue 一个防止 vm 实例自身被观察的标识位，true 表示 vm 实例，也就是 this
  // vmCount 判断是否为根节点，存在则代表是 data 的根节点，Vue 不允许在已经创建的实例上动态添加新的根级响应式属性
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  // 为对象 defineProperty 上在变化时通知的属性
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 通过对象上的观察者进行依赖收集
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      // 当数组成员还是数组的时候，执行该方法继续深层依赖收集，直到是对象为止
      dependArray(e)
    }
  }
}
