/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
// 玄幻更新
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 * flushSchedulerQueue 是下一个 tick 时的回调函数，主要目的是执行 Watcher 的 run 函数，用来更新视图
 */
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 根据 id 排序 watcher
  // 刷新前给 queue 排序，这样做是为了保证：
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  //    组件更新从父级更新到子级（因为父级总是在子级之前创建）
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  //    user watcher 要先于 render watcher 先运行（因为 user watcher 在 render watcher 之前创建）
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  //    如果父组件 watcher run 的时候组件销毁了，这个 watcher 将被跳过
  queue.sort((a, b) => a.id - b.id)
  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 不缓存队列长度，因为在遍历的过程中可能队列的长队有变化
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    // 在这里执行用户写的 watch 的回调函数并且渲染组件
    watcher.run()
    // in dev build, check and stop circular updates.
    // 判断无限循环的情况
    // 如果出现循环更新的问题，这个时候应该检查 watcher 相关的依赖的数据对象是否有不合理的逻辑
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 得到队列的拷贝
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
  // 重置调度者的状态
  resetSchedulerState()

  // call component updated and activated hooks
  // 使子组件状态都改编成 active 同时调用 activated 钩子
  callActivatedHooks(activatedQueue)
  // 调用 updated钩子
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      // 更新完毕钩子函数
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * 派发更新，异步
 * 把所有需要更新的 watcher 往一个队列推
 * 将观察者对象 push 进观察者队列，在队列中已经存在相同的 id 则观察者对象将被跳过，除非它是在队列被刷新时推送
 *
 * @param {Watcher}
 */
export function queueWatcher(watcher: Watcher) {
  // 获取 watcher 的 id，不同 watcher id 不同
  const id = watcher.id
  // 判断 watcher 是否已经在队列中存在
  // 因为存在改变了多个数据，多个数据 watch 是同一个的情况
  // 这里的 has 是存储是否已推至队列的标识位哈希表
  if (has[id] == null) {
    has[id] = true
    // flushing 标识
    // 当更新开始时会将该标识设置为 true，代表此时正在执行更新
    if (!flushing) {
      // 因此只有当队列没有执行更新时才会简地将观察者追加到队列的尾部
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      // 在执行 flushSchedulerQueue 函数时，如果有新的派发更新会进入这里
      // 插入新的 watcher
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 最初进入这个条件，只执行一次
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      // 将所有 Watcher 统一放入 nextTick 调用
      // 因为每次派发更新都会引发渲染
      // flushSchedulerQueue 作用之一就是用来将队列中的观察者统一执行更新
      nextTick(flushSchedulerQueue)
    }
  }
}
