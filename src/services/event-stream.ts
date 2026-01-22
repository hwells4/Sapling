import { type Event, type EventType } from '../types'
import { type EventEmitter, type Subscription, type SubscriptionOptions } from './events'

/**
 * Connection types supported by the event stream
 */
export type ConnectionType = 'sse' | 'websocket'

/**
 * Connection state for tracking client connections
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Connection metadata for a streaming client
 */
export interface StreamConnection {
  /** Unique connection ID */
  id: string
  /** Run ID being streamed */
  runId: string
  /** Connection type (SSE or WebSocket) */
  type: ConnectionType
  /** Current connection state */
  state: ConnectionState
  /** Last seq sent to this connection */
  lastSeq: number
  /** Connection established timestamp */
  connectedAt: string
  /** Last activity timestamp (last event sent or heartbeat) */
  lastActivityAt: string
}

/**
 * Options for creating an event stream
 */
export interface StreamOptions {
  /** Filter by event types (empty = all types) */
  types?: EventType[]
  /** Start streaming from after this seq (for reconnection) */
  afterSeq?: number
  /** Heartbeat interval in milliseconds (SSE only, default 30000) */
  heartbeatMs?: number
  /** Ping interval in milliseconds (WebSocket only, default 30000) */
  pingMs?: number
}

/**
 * SSE message format
 */
export interface SSEMessage {
  /** Event type for SSE (e.g., 'event', 'heartbeat', 'error') */
  event: string
  /** Message data (JSON stringified for events) */
  data: string
  /** Optional event ID (seq for ordering) */
  id?: string
  /** Retry hint in milliseconds */
  retry?: number
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 'event' | 'heartbeat' | 'ping' | 'pong' | 'error' | 'subscribed'

/**
 * WebSocket message format (JSON)
 */
export interface WebSocketMessage {
  type: WebSocketMessageType
  /** For 'event' type: the actual event */
  event?: Event
  /** For 'heartbeat'/'ping'/'pong': current timestamp */
  ts?: string
  /** For 'subscribed': current seq position */
  seq?: number
  /** For 'error': error message */
  error?: string
}

/**
 * Callback for sending SSE messages to the client
 */
export type SSESender = (message: SSEMessage) => void

/**
 * Callback for sending WebSocket messages to the client
 */
export type WebSocketSender = (message: WebSocketMessage) => void

/**
 * Stream handle returned when creating a stream
 */
export interface StreamHandle {
  /** Connection metadata */
  connection: StreamConnection
  /** Stop the stream and clean up */
  close: () => void
}

/**
 * EventStreamService - manages real-time event streaming to clients
 *
 * This service bridges the EventEmitter to HTTP clients via:
 * - Server-Sent Events (SSE) for simple HTTP streaming
 * - WebSocket for bi-directional communication
 *
 * Features:
 * - Reconnection support via afterSeq cursor
 * - Heartbeat/ping to detect stale connections
 * - Connection tracking for monitoring
 */
export interface EventStreamService {
  /**
   * Create an SSE stream for a run
   *
   * @param runId - The run to stream events for
   * @param sender - Callback to send SSE messages to the client
   * @param options - Stream options (types filter, afterSeq, heartbeatMs)
   * @returns StreamHandle for the connection
   */
  createSSEStream(runId: string, sender: SSESender, options?: StreamOptions): StreamHandle

  /**
   * Create a WebSocket stream for a run
   *
   * @param runId - The run to stream events for
   * @param sender - Callback to send WebSocket messages to the client
   * @param options - Stream options (types filter, afterSeq, pingMs)
   * @returns StreamHandle for the connection
   */
  createWebSocketStream(runId: string, sender: WebSocketSender, options?: StreamOptions): StreamHandle

  /**
   * Handle incoming WebSocket message (for ping/pong)
   *
   * @param connectionId - The connection ID
   * @param message - The received message
   */
  handleWebSocketMessage(connectionId: string, message: WebSocketMessage): void

  /**
   * Get all active connections
   */
  getConnections(): StreamConnection[]

  /**
   * Get connections for a specific run
   */
  getConnectionsForRun(runId: string): StreamConnection[]

  /**
   * Get a specific connection by ID
   */
  getConnection(connectionId: string): StreamConnection | undefined

  /**
   * Close a specific connection
   */
  closeConnection(connectionId: string): void

  /**
   * Close all connections for a run
   */
  closeConnectionsForRun(runId: string): void
}

/**
 * Internal connection state with handlers
 */
interface ActiveConnection {
  connection: StreamConnection
  subscription: Subscription
  heartbeatTimer?: ReturnType<typeof setInterval>
  pingTimer?: ReturnType<typeof setInterval>
  sender: SSESender | WebSocketSender
  type: ConnectionType
}

/**
 * In-memory EventStreamService implementation
 */
export class InMemoryEventStreamService implements EventStreamService {
  /** Active connections indexed by connection ID */
  private connections: Map<string, ActiveConnection> = new Map()

  /** Counter for generating connection IDs */
  private connectionCounter = 0

  /** Default heartbeat interval for SSE (30 seconds) */
  private readonly DEFAULT_HEARTBEAT_MS = 30000

  /** Default ping interval for WebSocket (30 seconds) */
  private readonly DEFAULT_PING_MS = 30000

  constructor(private eventEmitter: EventEmitter) {}

  createSSEStream(runId: string, sender: SSESender, options?: StreamOptions): StreamHandle {
    const connectionId = `sse_${++this.connectionCounter}_${Date.now()}`
    const now = new Date().toISOString()

    const connection: StreamConnection = {
      id: connectionId,
      runId,
      type: 'sse',
      state: 'connecting',
      lastSeq: options?.afterSeq ?? -1,
      connectedAt: now,
      lastActivityAt: now,
    }

    // Subscribe to events
    const subscriptionOptions: SubscriptionOptions = {
      types: options?.types,
      afterSeq: options?.afterSeq,
    }

    const subscription = this.eventEmitter.subscribe(
      runId,
      (event) => {
        this.sendSSEEvent(connectionId, event, sender)
      },
      subscriptionOptions,
    )

    // Start heartbeat timer
    const heartbeatMs = options?.heartbeatMs ?? this.DEFAULT_HEARTBEAT_MS
    const heartbeatTimer = setInterval(() => {
      this.sendSSEHeartbeat(connectionId, sender)
    }, heartbeatMs)

    // Store the active connection
    const activeConnection: ActiveConnection = {
      connection,
      subscription,
      heartbeatTimer,
      sender,
      type: 'sse',
    }
    this.connections.set(connectionId, activeConnection)

    // Update state to connected
    connection.state = 'connected'

    // Send initial retry hint (5 seconds)
    sender({ event: 'retry', data: '', retry: 5000 })

    return {
      connection,
      close: () => this.closeConnection(connectionId),
    }
  }

  createWebSocketStream(runId: string, sender: WebSocketSender, options?: StreamOptions): StreamHandle {
    const connectionId = `ws_${++this.connectionCounter}_${Date.now()}`
    const now = new Date().toISOString()

    const connection: StreamConnection = {
      id: connectionId,
      runId,
      type: 'websocket',
      state: 'connecting',
      lastSeq: options?.afterSeq ?? -1,
      connectedAt: now,
      lastActivityAt: now,
    }

    // Subscribe to events
    const subscriptionOptions: SubscriptionOptions = {
      types: options?.types,
      afterSeq: options?.afterSeq,
    }

    const subscription = this.eventEmitter.subscribe(
      runId,
      (event) => {
        this.sendWebSocketEvent(connectionId, event, sender)
      },
      subscriptionOptions,
    )

    // Start ping timer
    const pingMs = options?.pingMs ?? this.DEFAULT_PING_MS
    const pingTimer = setInterval(() => {
      this.sendWebSocketPing(connectionId, sender)
    }, pingMs)

    // Store the active connection
    const activeConnection: ActiveConnection = {
      connection,
      subscription,
      pingTimer,
      sender,
      type: 'websocket',
    }
    this.connections.set(connectionId, activeConnection)

    // Update state to connected
    connection.state = 'connected'

    // Send subscribed confirmation with current seq
    const currentSeq = this.eventEmitter.getSeq(runId)
    sender({
      type: 'subscribed',
      seq: currentSeq,
      ts: now,
    })

    return {
      connection,
      close: () => this.closeConnection(connectionId),
    }
  }

  handleWebSocketMessage(connectionId: string, message: WebSocketMessage): void {
    const activeConnection = this.connections.get(connectionId)
    if (!activeConnection) {
      return
    }

    // Handle ping -> respond with pong
    if (message.type === 'ping') {
      const sender = activeConnection.sender as WebSocketSender
      sender({
        type: 'pong',
        ts: new Date().toISOString(),
      })
      activeConnection.connection.lastActivityAt = new Date().toISOString()
    }

    // Handle pong -> update last activity
    if (message.type === 'pong') {
      activeConnection.connection.lastActivityAt = new Date().toISOString()
    }
  }

  getConnections(): StreamConnection[] {
    return Array.from(this.connections.values()).map((ac) => ac.connection)
  }

  getConnectionsForRun(runId: string): StreamConnection[] {
    return this.getConnections().filter((c) => c.runId === runId)
  }

  getConnection(connectionId: string): StreamConnection | undefined {
    return this.connections.get(connectionId)?.connection
  }

  closeConnection(connectionId: string): void {
    const activeConnection = this.connections.get(connectionId)
    if (!activeConnection) {
      return
    }

    // Clear timers
    if (activeConnection.heartbeatTimer) {
      clearInterval(activeConnection.heartbeatTimer)
    }
    if (activeConnection.pingTimer) {
      clearInterval(activeConnection.pingTimer)
    }

    // Unsubscribe from events
    activeConnection.subscription.unsubscribe()

    // Update state
    activeConnection.connection.state = 'disconnected'

    // Remove from connections
    this.connections.delete(connectionId)
  }

  closeConnectionsForRun(runId: string): void {
    const toClose = this.getConnectionsForRun(runId).map((c) => c.id)
    for (const id of toClose) {
      this.closeConnection(id)
    }
  }

  private sendSSEEvent(connectionId: string, event: Event, sender: SSESender): void {
    const activeConnection = this.connections.get(connectionId)
    if (!activeConnection || activeConnection.connection.state !== 'connected') {
      return
    }

    sender({
      event: 'event',
      data: JSON.stringify(event),
      id: String(event.seq),
    })

    // Update tracking
    activeConnection.connection.lastSeq = event.seq
    activeConnection.connection.lastActivityAt = new Date().toISOString()
  }

  private sendSSEHeartbeat(connectionId: string, sender: SSESender): void {
    const activeConnection = this.connections.get(connectionId)
    if (!activeConnection || activeConnection.connection.state !== 'connected') {
      return
    }

    sender({
      event: 'heartbeat',
      data: JSON.stringify({ ts: new Date().toISOString(), seq: activeConnection.connection.lastSeq }),
    })

    activeConnection.connection.lastActivityAt = new Date().toISOString()
  }

  private sendWebSocketEvent(connectionId: string, event: Event, sender: WebSocketSender): void {
    const activeConnection = this.connections.get(connectionId)
    if (!activeConnection || activeConnection.connection.state !== 'connected') {
      return
    }

    sender({
      type: 'event',
      event,
      ts: new Date().toISOString(),
    })

    // Update tracking
    activeConnection.connection.lastSeq = event.seq
    activeConnection.connection.lastActivityAt = new Date().toISOString()
  }

  private sendWebSocketPing(connectionId: string, sender: WebSocketSender): void {
    const activeConnection = this.connections.get(connectionId)
    if (!activeConnection || activeConnection.connection.state !== 'connected') {
      return
    }

    sender({
      type: 'ping',
      ts: new Date().toISOString(),
    })

    activeConnection.connection.lastActivityAt = new Date().toISOString()
  }
}

/**
 * Factory function for creating EventStreamService instances
 *
 * @param eventEmitter - The EventEmitter to stream events from
 * @returns EventStreamService implementation
 */
export function createEventStreamService(eventEmitter: EventEmitter): EventStreamService {
  return new InMemoryEventStreamService(eventEmitter)
}

/**
 * Format an SSE message for HTTP response
 *
 * SSE format:
 * event: <event type>
 * id: <event id>
 * retry: <retry ms>
 * data: <data>
 *
 * @param message - The SSE message to format
 * @returns Formatted string for HTTP response
 */
export function formatSSEMessage(message: SSEMessage): string {
  const lines: string[] = []

  if (message.event) {
    lines.push(`event: ${message.event}`)
  }
  if (message.id !== undefined) {
    lines.push(`id: ${message.id}`)
  }
  if (message.retry !== undefined) {
    lines.push(`retry: ${message.retry}`)
  }
  lines.push(`data: ${message.data}`)

  // SSE messages end with double newline
  return lines.join('\n') + '\n\n'
}

/**
 * Parse query parameters for stream options
 *
 * Extracts stream options from URL query parameters:
 * - after_seq: number (reconnection cursor)
 * - types: comma-separated EventType values
 *
 * @param params - URL search params or object with query values
 * @returns Parsed StreamOptions
 */
export function parseStreamOptions(
  params: URLSearchParams | Record<string, string | undefined>,
): StreamOptions {
  const options: StreamOptions = {}

  // Get values from either URLSearchParams or plain object
  const afterSeq =
    params instanceof URLSearchParams ? params.get('after_seq') : params['after_seq']
  const types = params instanceof URLSearchParams ? params.get('types') : params['types']

  if (afterSeq) {
    const parsed = parseInt(afterSeq, 10)
    if (!isNaN(parsed) && parsed >= -1) {
      options.afterSeq = parsed
    }
  }

  if (types) {
    options.types = types.split(',').filter(Boolean) as EventType[]
  }

  return options
}
