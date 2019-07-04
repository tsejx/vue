/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * get 数据的时候，收集订阅者，触发 Watcher 的依赖收集
 * set 数据的时候，发布更新，通知 Watcher
 * 一个 Dep 实例 对应一个对象属性或一个被观察的对象，用于收集订阅者和在数据改变时，发布更新
 *
 * Dep 目的是建立 数据 与 Watcher 之间的桥梁
 */
export default class Dep {
  static target: ?Watcher;
  // 每创建一个实例递增
  id: number;
  // Watcher 保存的队列
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  // 添加一个观察者对象
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 移除一个观察者对象
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 依赖收集，当存在 Dep.target 的时候添加观察者对象
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 通知所有订阅者
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// Dep.target 作为 Dep 类的静态属性，相当于全局的 Watcher
// Dep.target 相当于正在被计算处理的 Watacher 实例
// 依赖收集完需要将 Dep.target 设为 null，防止后面重复添加依赖
// 因为同一时间只有一个 Watcher 会被计算
Dep.target = null

// 利用栈的数据结构保存当前计算的 target，因为会有嵌套的子组件
const targetStack = []

// 主要作用是为 Dep.target 赋值
// 将 watcher 观察者实例设置给 Dep.target（表示即将要收集的目标），用以依赖收集。
// 同时该实例存入 targetStack 栈中
// 将上个 watcher，可以理解为父组件的 watcher 放入栈中保存，然后处理子组件的 target
// 当子组件的 target 处理完后，会调用 popTarget 弹出栈，然后继续处理父组件的 target
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

// 将观察者实例从 taget 栈中取出并设置给 Dep.target
export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
