import { useCallback, useEffect, useRef, useState } from 'react'
import { type Event, type EventType, isValidEvent } from '../types'

/**
 * Connection states for the event stream
 */
export type EventStreamState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed'

/**
 * Configuration options for the event stream hook
 */
export interface UseEventStreamOptions {
  /** Base URL for the SSE endpoint (defaults to window.location.origin) */
  baseUrl?: string
  /** Filter by event types (empty = all types) */
  types?: EventType[]
  /** Enable auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Maximum reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number
  /** Initial reconnect delay in ms (default: 1000) */
  initialReconnectDelay?: number
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number
  /** Called when an event is received */
  onEvent?: (event: Event) => void
  /** Called when connection state changes */
  onStateChange?: (state: EventStreamState) => void
  /** Called when an error occurs */
  onError?: (error: Error) => void
}

/**
 * Return type for the useEventStream hook
 */
export interface UseEventStreamResult {
  /** Current connection state */
  state: EventStreamState
  /** Whether currently loading (connecting or reconnecting) */
  isLoading: boolean
  /** Whether connected and receiving events */
  isConnected: boolean
  /** Current error, if any */
  error: Error | null
  /** All events received so far, ordered by seq */
  events: Event[]
  /** The last seq number received (for reconnection) */
  lastSeq: number
  /** Number of reconnect attempts */
  reconnectAttempts: number
  /** Manually connect to the stream */
  connect: () => void
  /** Manually disconnect from the stream */
  disconnect: () => void
  /** Clear all events */
  clearEvents: () => void
}

/**
 * React hook for consuming SSE event streams from a run
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Resume from lastSeq on reconnection
 * - Event filtering by type
 * - Loading and error state management
 *
 * @example
 * ```tsx
 * const { events, isLoading, error, state } = useEventStream('run-123', {
 *   types: ['tool.called', 'tool.result'],
 *   onEvent: (event) => console.log('New event:', event),
 * });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <Timeline events={events} />
 * );
 * ```
 */
export function useEventStream(
  runId: string | null,
  options: UseEventStreamOptions = {},
): UseEventStreamResult {
  const {
    baseUrl,
    types,
    autoReconnect = true,
    maxReconnectAttempts = 10,
    initialReconnectDelay = 1000,
    maxReconnectDelay = 30000,
    onEvent,
    onStateChange,
    onError,
  } = options

  // State
  const [state, setState] = useState<EventStreamState>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [lastSeq, setLastSeq] = useState<number>(-1)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  // Refs for stable callbacks and cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Stable callback refs to avoid re-renders
  const onEventRef = useRef(onEvent)
  const onStateChangeRef = useRef(onStateChange)
  const onErrorRef = useRef(onError)

  // Update callback refs when they change
  useEffect(() => {
    onEventRef.current = onEvent
    onStateChangeRef.current = onStateChange
    onErrorRef.current = onError
  }, [onEvent, onStateChange, onError])

  // Helper to update state and notify callback
  const updateState = useCallback((newState: EventStreamState) => {
    if (!mountedRef.current) return
    setState(newState)
    onStateChangeRef.current?.(newState)
  }, [])

  // Helper to handle errors
  const handleError = useCallback(
    (err: Error) => {
      if (!mountedRef.current) return
      setError(err)
      onErrorRef.current?.(err)
    },
    [],
  )

  // Build SSE URL with query params
  const buildUrl = useCallback(
    (afterSeq: number): string => {
      const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')
      const url = new URL(`/api/runs/${runId}/stream`, base)

      if (afterSeq >= 0) {
        url.searchParams.set('after_seq', String(afterSeq))
      }

      if (types && types.length > 0) {
        url.searchParams.set('types', types.join(','))
      }

      return url.toString()
    },
    [baseUrl, runId, types],
  )

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(
    (attempt: number): number => {
      const delay = initialReconnectDelay * Math.pow(2, attempt)
      return Math.min(delay, maxReconnectDelay)
    },
    [initialReconnectDelay, maxReconnectDelay],
  )

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // Connect to the event stream
  const connect = useCallback(() => {
    if (!runId) {
      return
    }

    // Cleanup any existing connection
    cleanup()

    // Reset error on new connection attempt
    setError(null)

    // Determine state based on reconnect attempts
    const isReconnecting = reconnectAttempts > 0
    updateState(isReconnecting ? 'reconnecting' : 'connecting')

    try {
      const url = buildUrl(lastSeq)
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (!mountedRef.current) return
        updateState('connected')
        setReconnectAttempts(0)
        setError(null)
      }

      eventSource.onerror = () => {
        if (!mountedRef.current) return

        // Close the current connection
        eventSource.close()
        eventSourceRef.current = null

        // Handle reconnection
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          const delay = getReconnectDelay(reconnectAttempts)
          updateState('reconnecting')

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return
            setReconnectAttempts((prev) => prev + 1)
            connect()
          }, delay)
        } else {
          const err = new Error(
            reconnectAttempts >= maxReconnectAttempts
              ? `Failed to connect after ${maxReconnectAttempts} attempts`
              : 'Connection failed',
          )
          handleError(err)
          updateState('error')
        }
      }

      // Handle incoming events
      eventSource.addEventListener('event', (e: MessageEvent) => {
        if (!mountedRef.current) return

        try {
          const parsed = JSON.parse(e.data)

          if (!isValidEvent(parsed)) {
            console.warn('Invalid event received:', parsed)
            return
          }

          const event = parsed as Event

          // Update lastSeq
          setLastSeq(event.seq)

          // Add to events list (maintaining order by seq)
          setEvents((prev) => {
            // Check if we already have this event (deduplication)
            if (prev.some((ev) => ev.event_id === event.event_id)) {
              return prev
            }

            // Insert in order by seq
            const newEvents = [...prev, event].sort((a, b) => a.seq - b.seq)
            return newEvents
          })

          // Notify callback
          onEventRef.current?.(event)
        } catch (err) {
          console.error('Failed to parse event:', err)
        }
      })

      // Handle heartbeat events (just update connection state)
      eventSource.addEventListener('heartbeat', () => {
        // Heartbeat received - connection is alive
        // Could update a "lastHeartbeat" timestamp if needed
      })

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect')
      handleError(error)
      updateState('error')
    }
  }, [
    runId,
    cleanup,
    reconnectAttempts,
    lastSeq,
    buildUrl,
    updateState,
    autoReconnect,
    maxReconnectAttempts,
    getReconnectDelay,
    handleError,
  ])

  // Disconnect from the event stream
  const disconnect = useCallback(() => {
    cleanup()
    updateState('closed')
    setReconnectAttempts(0)
  }, [cleanup, updateState])

  // Clear all events
  const clearEvents = useCallback(() => {
    setEvents([])
    setLastSeq(-1)
  }, [])

  // Auto-connect when runId changes
  useEffect(() => {
    if (runId) {
      // Reset state for new run
      setEvents([])
      setLastSeq(-1)
      setReconnectAttempts(0)
      setError(null)
      connect()
    } else {
      disconnect()
      updateState('idle')
    }

    return () => {
      cleanup()
    }
  }, [runId]) // Intentionally only depend on runId

  // Track mounted state for async operations
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  return {
    state,
    isLoading: state === 'connecting' || state === 'reconnecting',
    isConnected: state === 'connected',
    error,
    events,
    lastSeq,
    reconnectAttempts,
    connect,
    disconnect,
    clearEvents,
  }
}
