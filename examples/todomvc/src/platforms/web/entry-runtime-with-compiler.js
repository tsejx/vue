/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})


// 缓存（保留了）原型上的 $mount
const mount = Vue.prototype.$mount
// 重新定义原型上的 $mount
// 因为此时是需要添加编译的过程的（为 $mount 添加了编译模版的能力）
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 挂载点
  el = el && query(el)

  /* istanbul ignore if */
  // Vue 不可以挂载到 body 或 html 上
  // 否则会覆盖文档
  // 因为挂载点的本意是组件挂载的占位，它将会被组件自身的模版替换掉，而 body 和 html 显然是不能被替换掉的
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 判定构造函数的配置对象中是否有指定 render 选项（渲染函数）
  // 如果存在渲染函数，则什么都不用做，直接调用运行时 $mount（可得知 mountComponent 完成挂载的必要条件是：提供渲染函数给 mountComponent）
  // 如果没有渲染函数，则使用 template 或 el 选项构建渲染函数
  if (!options.render) {
    // 在没有 render 渲染函数的情况下，会优先使用 template 选项，并尝试将 template 编译成渲染函数
    // 但开发者未必传递了 template 选项，这时会检测 el 选项是否存在，存在的话 el.outerHTML 作为 template 的值
    // 这段代码目标只有一个，即获取合适的内容作为模版
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        // template 选项为字符串类型
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // template 选项为元素节点
        template = template.innerHTML
      } else {
        // template 选项无效
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    // 理想情况下，template 应该为模版字符串，将来用于渲染函数的生成
    if (template) {
      /* istanbul ignore if */
      // 用于统计编译器性能
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 将 template 模版字符串编译为 render 函数
      // 并将渲染函数添加到 vm.$options 选项中 => vm.$options.render
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 缓存的 mount
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 * 获取 HTML
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
