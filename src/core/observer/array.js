/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// Array 内置对象的原型
const arrayProto = Array.prototype
// 创建新的数组对象，修改该对象上的数组的七个方法，防止污染原生数组方法
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 截获数组的成员发生的变化
 * 执行原生数组操作的同时 Dep 通过关联的所有观察者进行响应式处理
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 将数组的原生方法缓存起来 后面要调用
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator(...args) {
    // 调用原生的数组方法
    const result = original.apply(this, args)
    // 数组新插入的元素需要重新进行 observe 才能响应
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    // dep 通知所有注册的观察者进行响应式处理
    ob.dep.notify()
    return result
  })
})
