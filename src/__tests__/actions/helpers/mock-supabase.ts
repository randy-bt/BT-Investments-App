/* eslint-disable @typescript-eslint/no-explicit-any */
// Chainable Supabase client mock for server-action tests.
//
// Supports the query shapes the actions use:
//   from(t).select(...).eq(...).single()
//   from(t).update(payload).eq(...)                    (awaited directly)
//   from(t).update(payload).eq(...).select().single()
//   from(t).insert(payload)                            (awaited directly)
//   from(t).insert(payload).select().single()
//   from(t).select(...).eq(...).order(...).limit(...)
//
// Responses are configured per `${table}.${op}`:
//   respond(table, op, ...responses)  — consumed in FIFO order
//   always(table, op, fn)             — fallback fn(call) when the queue is empty
// Every from().select/insert/update invocation is recorded in `calls`
// (with payload and eq/in filters) so tests can assert what was written
// and — critically — what was NOT written.

export type MockResponse = { data?: unknown; error?: { message: string } | null }

export type RecordedCall = {
  table: string
  op: 'select' | 'insert' | 'update'
  payload: unknown
  filters: Array<[string, unknown]>
}

type Responder = MockResponse | ((call: RecordedCall) => MockResponse)

const DEFAULT_RESPONSE: MockResponse = { data: null, error: null }

export function createMockSupabase() {
  const queues = new Map<string, Responder[]>()
  const fallbacks = new Map<string, (call: RecordedCall) => MockResponse>()
  const calls: RecordedCall[] = []

  const key = (table: string, op: string) => `${table}.${op}`

  function respond(table: string, op: RecordedCall['op'], ...responders: Responder[]) {
    const k = key(table, op)
    queues.set(k, [...(queues.get(k) ?? []), ...responders])
  }

  function always(
    table: string,
    op: RecordedCall['op'],
    fn: (call: RecordedCall) => MockResponse
  ) {
    fallbacks.set(key(table, op), fn)
  }

  function resolveResponse(call: RecordedCall): MockResponse {
    const queue = queues.get(key(call.table, call.op))
    if (queue && queue.length > 0) {
      const next = queue.shift()!
      return typeof next === 'function' ? next(call) : next
    }
    const fallback = fallbacks.get(key(call.table, call.op))
    return fallback ? fallback(call) : DEFAULT_RESPONSE
  }

  function from(table: string) {
    const start = (op: RecordedCall['op']) => (payload?: unknown) => {
      const call: RecordedCall = { table, op, payload, filters: [] }
      calls.push(call)
      let resolved: MockResponse | undefined
      const resolve = () => {
        if (!resolved) resolved = resolveResponse(call)
        return { data: null, error: null, ...resolved }
      }
      const chain: any = {
        eq: (column: string, value: unknown) => {
          call.filters.push([column, value])
          return chain
        },
        in: (column: string, values: unknown) => {
          call.filters.push([column, values])
          return chain
        },
        order: () => chain,
        limit: () => chain,
        select: () => chain,
        single: () => Promise.resolve(resolve()),
        // Makes the chain awaitable (e.g. `await supabase.from(t).update(x).eq(...)`)
        then: (onFulfilled?: (v: any) => any, onRejected?: (e: any) => any) =>
          Promise.resolve(resolve()).then(onFulfilled, onRejected),
      }
      return chain
    }
    return { select: start('select'), insert: start('insert'), update: start('update') }
  }

  const client = { from }

  const callsFor = (table: string, op?: RecordedCall['op']) =>
    calls.filter((c) => c.table === table && (op === undefined || c.op === op))

  const filterValue = (call: RecordedCall, column: string) =>
    call.filters.find(([col]) => col === column)?.[1]

  return { client, respond, always, calls, callsFor, filterValue }
}

export type MockSupabase = ReturnType<typeof createMockSupabase>
