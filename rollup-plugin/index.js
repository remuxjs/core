// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * @remux/rollup-plugin - remux rollup & vite plugin
 *
 * Copyright 2023 huangziyi. All rights reserved.
 */

import babel from '@babel/core'
import remuxPlugin from '@remux/babel-plugin'

export default function remuxRollupPlugin(role, lib='@remux/lib') {
    const handlesId = 'virtual:remux/handles'
    const resolvedHandlesId = '\0' + handlesId
    const me = {
        name: 'remux',
        _isFirstPass: false,
        _importedModules: new Set(),
        async config(config) {
            // vite
            const { build } = await import('vite')
            // FIXME: HMR
            if (!me._isFirstPass) {
                me._isFirstPass = true
                // run build to collect module paths
                const originalConfigFile = config.configFile
                const originalBuildWrite = config.build?.write
                config.configFile = false
                // FIXME: do not generate output
                if ('build' in config) {
                    config.build.write = false
                } else {
                    config.build = { write: false }
                }
                await build(config)
                // restore configFile
                config.configFile = originalConfigFile
                config.build.write = originalBuildWrite
                me._isFirstPass = false
            }
        },
        async buildStart(options) {
            if ('plugins' in options) {
                const { rollup } = await import('rollup')
                // start a pass to collect module paths
                if (!me._isFirstPass) {
                    me._isFirstPass = true
                    await rollup(options)
                    me._isFirstPass = false
                }
            } else {
                // vite
            }
        },
        resolveId(id) {
            if (id === handlesId) {
                return resolvedHandlesId
            }
            return null
        },
        async load(id) {
            if (id === resolvedHandlesId) {
                // put all transformed module path here
                if (me._isFirstPass) {
                    return 'export const nameMap = {};'
                } else {
                    // static import for tree-shaking
                    let code = Array.from(me._importedModules).map((m, idx) => {
                        const escaped = JSON.stringify(m)
                        return `export { _remuxHandle as _remux$${idx}} from ${escaped};`
                    }).join('\n')
                    code += '\nexport const nameMap = {\n' +
                        Array.from(me._importedModules).map((m, idx) => {
                            const escaped = JSON.stringify(m)
                            return `${escaped}: '_remux$${idx}'`
                        }).join(',\n') + '};'
                    return code
                }
            }
        },
        async transform(code, id) {
            // FIXME: vite, html
            if (id.startsWith('\0') || id.endsWith('.html')) {
                return
            }
            // FIXME: better solution
            if (code.startsWith('// @remux-ignore')) {
                return
            }
            if (me._isFirstPass) {
                me._importedModules.add(id)
            }
            if (id === resolvedHandlesId) {
                return code
            }
            const transformCode = await babel.transformAsync(code, {
                presets: [],
                filename: id,
                plugins: [
                    [remuxPlugin, { role, id, lib }]
                ]
            })
            return transformCode.code
        }
    }
    return me
}
