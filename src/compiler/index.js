/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // parse 解析得到 ast 树
  const ast = parse(template.trim(), options)
  // 将 AST 树进行优化
  // 优化目标：生成模版 AST 树，检测不需要进行 DOM 改变的静态子树
  // 一旦检测到这些静态树，即可
  // 把它们变成常数，这样我们就再也不需要每次重新渲染时创建新的节点
  // 在 patch 的过程中直接跳过
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 根据 ast 树生成所需的 code（内部包含 render 与 staticRenderFns）
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
