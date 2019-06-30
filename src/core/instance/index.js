import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue 构造函数
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 根据初始化 Vue 配置进行初始化
  // 相当于 Vue.prototype._init
  this._init(options)
}

// 每个 mixin 为 Vue 原型挂载方法
// ES6 实现较难，所以使用 ES5 实现
// 不同模块功能拆分利于管理和维护
// initMixin 定义 Vue.prototype._init
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
