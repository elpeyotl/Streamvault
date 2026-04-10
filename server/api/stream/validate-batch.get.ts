import type { StreamValidationResult } from './validate.post'

/**
 * Batch validate multiple streams via Server-Sent Events.
 * The client opens this as an EventSource and receives live status updates
 * as each stream is validated in the background.
 *
 * GET /api/stream/validate-batch?hashes=abc,def,ghi&token=xxx&max=5
 *
 * Events emitted:
 *   event: validation
 *   data: { hash, status, url, speed, error, ... }
 *
 *   event: done
 *   data: { validated: 5, verified: 3, dead: 2 }
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const hashesRaw = String(query.hashes || '')
  const token = String(query.token || '')
  const max = Math.min(Number(query.max) || 5, 8) // Cap at 8

  if (!hashesRaw || !token) {
    throw createError({ statusCode: 400, message: 'hashes and token are required' })
  }

  const hashes = hashesRaw.split(',').slice(0, max)

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  })

  const response = event.node.res

  function sendEvent(eventName: string, data: any) {
    response.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Validate streams concurrently with a concurrency limit of 2
  // (avoid hitting RD rate limits too hard)
  const concurrency = 2
  const results: StreamValidationResult[] = []
  let verifiedCount = 0
  let deadCount = 0

  // Process in batches of `concurrency`
  for (let i = 0; i < hashes.length; i += concurrency) {
    const batch = hashes.slice(i, i + concurrency)

    const batchResults = await Promise.allSettled(
      batch.map(async (hash) => {
        try {
          const result = await $fetch<StreamValidationResult>('/api/stream/validate', {
            method: 'POST',
            body: { hash, token, cleanup: true },
            baseURL: getRequestURL(event).origin,
          })
          return result
        } catch (err: any) {
          return {
            hash,
            status: 'dead' as const,
            error: err.message || 'Validation request failed',
          } satisfies StreamValidationResult
        }
      })
    )

    for (const settled of batchResults) {
      const result = settled.status === 'fulfilled'
        ? settled.value
        : { hash: 'unknown', status: 'dead' as const, error: 'Promise rejected' }

      results.push(result)
      if (result.status === 'verified') verifiedCount++
      if (result.status === 'dead') deadCount++

      // Send live update to client
      sendEvent('validation', result)
    }

    // Early exit: if we have 3+ verified streams, no need to check more
    if (verifiedCount >= 3) break
  }

  // Send completion event
  sendEvent('done', {
    validated: results.length,
    verified: verifiedCount,
    dead: deadCount,
  })

  response.end()
})
