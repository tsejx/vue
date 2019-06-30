# Vue 源码注释

## 目录

**核心模块**

* compiler：编译代码，将 template 编译为 render 函数
* core：通用，与平台无关代码
  * observer：响应系统，包含数据监测的核心代码
  * vdom：虚拟 DOM 创建和打补丁的代码
  * instance：Vue 构造函数设计相关代码
  * global-api：给 Vue 构造函数挂载全局方法（静态方法）或属性的代码
  * components：抽象通用组件
* platforms：不同平台不同构建入口
  * web
  * weex
* server：服务端渲染相关代码
* sfc：单文件组件的解析逻辑，用于 vue-template-compiler
* shared：框架通用代码

## 构建输出

模块输出形式：

* UMD => umd
* CommonJS => cjs
* ES Module => es