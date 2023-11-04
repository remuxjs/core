// @remux-ignore
// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * @remux/lib - remux library
 *
 * Copyright 2023 huangziyi. All rights reserved.
 */

/**
 * @callback Send
 * @param {string} role 
 * @param {string} module 
 * @param {string} func 
 * @param {Array<any>} params 
 * @returns {Promise<any>}
 */

/**
 * 
 * @param {string} role 
 * @param {string} module 
 * @param {string} func 
 * @param {Array<any>} params 
 * @returns {Promise<any>}
 */
export async function dispatch(role, module, func, params) {
    const handles = await import('virtual:remux/handles')
    return await handles[handles.nameMap[module]][func](...params);
}

let _send = null;

/**
 * 
 * @param {Send} _send
 */
export function use(send) {
    _send = send;
}

/**
 * 
 * @param {string} role 
 * @param {string} module 
 * @param {string} func 
 * @param {Array<any>} params 
 * @returns {Promise<any>}
 */
export async function _remuxInvoke(role, module, func, params) {
    return await _send(role, module, func, params);
}
