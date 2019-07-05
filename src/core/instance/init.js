/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {
  // 原型上挂载 init 方法
  // 1. 初始化（生命周期、事件、render 函数、state 等）
  // 2. $mount 组件
  // eslint-disable-next-line no-debugger
  debugger;
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    // Vue 实例的唯一标识
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 防止 vm 实例自身被观察的标识位
    vm._isVue = true
    // merge options
    // 合并配置
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 内置组件的初始化
      initInternalComponent(vm, options)
    } else {
      // 将 Vue 上的属性方法合并到 vm 实例上
      // 当前实例的初始化选项
      // 允许在初始化选项中定义<自定义属性>
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    // 暴露真实的实例
    vm._self = vm
    // 初始化生命周期
    initLifecycle(vm)
    // 初始化事件
    initEvents(vm)
    // 初始化 render
    initRender(vm)
    // 调用 beforeCreate 钩子函数并触发 beforeCreate 钩子函数
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    // Proxy 处理（将一些状态管理代理到 Vue 实例上）
    // 这里就是将原本 this.data、this.props 或 this.methods 的属性方法
    // 代理到 vm 实例上，开发者在调用时可以直接 this.xxx 使用相关属性或方法
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    // 调用 created 钩子函数并且触发 created 钩子函数
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      // 格式化组件名
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 判断实例化配置对象是否有指定挂载的 DOM 对象
    // 如果实例没有 el 则，当 vm.$mount(el) 调用时才触发相关 vm 实例的渲染
    if (vm.$options.el) {
      // 挂载组件
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 如果存在父类
  if (Ctor.super) {
    // 对父类进行 resolveConstructorOptions 获取父类 options
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 之前已经缓存起来的父类的 iption，用以检测是否更新
    const cachedSuperOptions = Ctor.superOptions
    // 对比当前父类的 option 以及缓存中的 option，两个不一样则代表已经被更新
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 父类的 option 已经改变，需要去处理新的 option

      // 把新的 option 缓存起来
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
