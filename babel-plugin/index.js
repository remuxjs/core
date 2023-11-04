// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * @remux/babel-plugin - remux babel compiler plugin
 *
 * Copyright 2023 huangziyi. All rights reserved.
 */

const keyword = '@remux'
const regex = new RegExp(`${keyword}\\s([\\w\\-]+)\\s?`)

function getRole(path) {
  const comments = path.node.leadingComments || []
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i]
    if (comment.value.indexOf(keyword) >= 0) {
      return regex.exec(comment.value)[1]
    }
  }
  return null
}

export default function ({ types: t }) {
  return {
    visitor: {
      Program: {
        enter(p, state) {
          // handle ignoring mark
          for (const comment of p.node.body[0]?.leadingComments || []) {
            if (comment.value.indexOf(keyword + '-ignore') >= 0) {
              return
            }
          }
          // transpile
          const rpcWraps = new Set()
          const rpcOffered = new Set()
          p.get('body').forEach(path => {
            switch (path.node.type) {
              case 'ExportDefaultDeclaration':
              case 'ExportNamedDeclaration': {
                const role = getRole(path)
                if (role === null) {
                  // no role, do nothing
                  break
                }
                if (path.node.declaration.type === 'VariableDeclaration') {
                  if (state.opts.role !== role) {
                    path.remove()
                  }
                } else if (path.node.declaration.type === 'FunctionDeclaration') {
                  // FIXME: duplicated code
                  const id = path.node.declaration.id.name
                  // serve function
                  if (state.opts.role === role) {
                    break
                  }
                  // FIXME: warning
                  if (id === '_remuxHandle') {
                    if (state.opts.role === role) {
                      // mark, replace to ours
                      handlerPath = path
                    } else {
                      // others handler
                      path.remove()
                    }
                  }
                  // remote function, wrap to RPC
                  path.get('declaration').replaceWith(t.functionDeclaration(
                    t.identifier(id),
                    [t.restElement(t.identifier('params'))],
                    t.blockStatement([
                      t.returnStatement(t.awaitExpression(t.callExpression(
                        t.identifier('_remuxInvoke'), [
                          t.stringLiteral(role),
                          // FIXME: file path
                          t.stringLiteral(state.opts.id || state.filename),
                          t.stringLiteral(id),
                          t.identifier('params')
                        ]
                      )))
                    ]),
                    false, true
                  ))
                  rpcWraps.add(id)
                } else if (path.node.declaration.type === 'ClassDeclaration') {
                  // TODO
                }
                break
              }
              case 'ImportDeclaration':
              case 'ExpressionStatement':
              case 'BlockStatement': {
                const role = getRole(path)
                if (role !== null && state.opts.role !== role) {
                  path.remove()
                }
                break
              }
              case 'FunctionDeclaration': {
                const role = getRole(path)
                const id = path.node.id.name
                // local function
                if (role === null) {
                  // path.skip()
                  break
                }
                // serve function
                if (state.opts.role === role) {
                  rpcOffered.add(id)
                  // path.skip()
                  break
                }
                // remote function, wrap to RPC
                path.replaceWith(t.functionDeclaration(
                  path.node.id,
                  [t.restElement(t.identifier('params'))],
                  t.blockStatement([
                    t.returnStatement(t.awaitExpression(t.callExpression(
                      t.identifier('_remuxInvoke'), [
                        t.stringLiteral(role),
                        // TODO: file path
                        t.stringLiteral(state.filename),
                        t.stringLiteral(id),
                        t.identifier('params')
                      ]
                    )))
                  ]),
                  false, true
                ))
                // path.skip()
                rpcWraps.add(id)
                break
              }
              default:
                break
            }
          })
          // FIXME: should raise manualy instead of TypeError
          const handleNode = t.exportNamedDeclaration(
            t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('_remuxHandle'),
                t.objectExpression(
                  Array.from(rpcOffered).map(v => t.objectProperty(
                    t.identifier(v),
                    t.identifier(v),
                    false, true
                  ))
                )
              )
            ])
          )
          // append handle
          p.node.body.push(handleNode)
          // import { _remuxInvoke } from 'virtual:remux'
          p.node.body.unshift(t.importDeclaration([
            t.importSpecifier(
              t.identifier('_remuxInvoke'),
              t.identifier('_remuxInvoke')
            )],
            t.stringLiteral(state.opts.lib || 'virtual:remux')
          ))
          // FIXME: self reference & recursive
          // FIXME: use rollup/vite tree-shaking instead
          // remove unused element
          p.scope.crawl()
          for (const v in p.scope.bindings) {
            // console.log(p.scope.bindings[v].identifier.name, p.scope.bindings[v].references)
            if (!p.scope.bindings[v].referenced) {
              const path = p.scope.bindings[v].path
              if (path.node.type === 'ImportDeclaration') {
                // FIXME: multiple import
                path.parentPath.remove()
              } else {
                path.remove()
              }
            }
          }
        }
      }
    }
  }
}
