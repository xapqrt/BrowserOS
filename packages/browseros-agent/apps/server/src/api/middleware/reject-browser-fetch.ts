/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { MiddlewareHandler } from 'hono'

// Browser-page CSRF: reject cross-site / same-site fetches.
// Native Electron MCP clients send `Sec-Fetch-Site: none` (or omit it).
// Blocking any Sec-Fetch-Site header 403'd Cherry Studio and similar (#2458).
export function rejectBrowserFetch(): MiddlewareHandler {
  return async (c, next) => {
    const site = c.req.header('Sec-Fetch-Site')?.trim().toLowerCase()
    if (site === 'cross-site' || site === 'same-site') {
      return c.json(
        {
          error: {
            name: 'ForbiddenBrowserRequest',
            message: 'Browser requests are not allowed on this endpoint',
            code: 'FORBIDDEN_BROWSER_REQUEST',
            statusCode: 403,
          },
        },
        403,
      )
    }
    return next()
  }
}
