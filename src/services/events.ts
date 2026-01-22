import { z } from 'zod'
import {
  type Event,
  type EventType,
  type EventPayloadMap,
  type TypedEvent,
  type Phase,
  type Severity,
  EventPayloadSchemas,
  createEvent,
} from '../types'

/**
 * Event subscription callback - receives typed events
 */
export type EventSubscriber = (event: Event) => void

/**
 * Subscription options for filtering events
 */
export interface SubscriptionOptions {
  /** Filter by event types (empty = all types) */
  types?: EventType[]
  /** Filter by phases (empty = all phases) */
  phases?: Phase[]
  /** Only receive events after this seq (for reconnection) */
  afterSeq?: number
}

/**
 * Subscription handle returned when subscribing
 */
export interface Subscription {
  /** Unique subscription ID */
  id: string
  /** Unsubscribe from the event stream */
  unsubscribe: () => void
}

/**
 * Result of emitting an event
 */
export interface EmitResult {
  success: boolean
  event?: Event
  error?: string
}

/**
 * EventEmitter interface - the contract for event emission
 *
 * Implementations must guarantee:
 * - seq is monotonic per run_id
 * - Events are validated against their type's payload schema
 * - Subscribers receive events in order
 */
export interface EventEmitter {
  /**
   * Emit a type-safe event
   *
   * @param runId - The run this event belongs to
   * @param type - The event type (discriminator)
   * @param payload - Payload matching the event type
   * @param phase - Current run phase
   * @param severity - Event severity level
   * @returns EmitResult with the created event or error
   */
  emit<T extends EventType>(
    runId: string,
    type: T,
    payload: EventPayloadMap[T],
    phase: Phase,
    severity: Severity,
  ): EmitResult

  /**
   * Subscribe to events for a run
   *
   * @param runId - The run to subscribe to
   * @param callback - Called for each matching event
   * @param options - Optional filtering options
   * @returns Subscription handle for unsubscribing
   */
  subscribe(
    runId: string,
    callback: EventSubscriber,
    options?: SubscriptionOptions,
  ): Subscription

  /**
   * Get the current seq for a run (for reconnection)
   */
  getSeq(runId: string): number

  /**
   * Get all events for a run (optionally after a seq)
   */
  getEvents(runId: string, afterSeq?: number): Event[]

  /**
   * Clear all events for a run (for testing/cleanup)
   */
  clearRun(runId: string): void
}

/**
 * In-memory EventEmitter implementation
 *
 * Suitable for development and single-instance deployments.
 * For production, use a persistent implementation backed by
 * the event persistence layer.
 */
export class InMemoryEventEmitter implements EventEmitter {
  /** Events per run, keyed by run_id */
  private events: Map<string, Event[]> = new Map()

  /** Current seq per run, keyed by run_id */
  private seqs: Map<string, number> = new Map()

  /** Active subscriptions per run */
  private subscriptions: Map<string, Map<string, { callback: EventSubscriber; options?: SubscriptionOptions }>> =
    new Map()

  /** Counter for generating subscription IDs */
  private subscriptionCounter = 0

  emit<T extends EventType>(
    runId: string,
    type: T,
    payload: EventPayloadMap[T],
    phase: Phase,
    severity: Severity,
  ): EmitResult {
    // Validate payload against the event type's schema
    const schema = EventPayloadSchemas[type]
    const parseResult = schema.safeParse(payload)

    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid payload for event type '${type}': ${parseResult.error.message}`,
      }
    }

    // Get and increment seq for this run (monotonic)
    const currentSeq = this.seqs.get(runId) ?? -1
    const nextSeq = currentSeq + 1
    this.seqs.set(runId, nextSeq)

    // Create the event with validated payload
    const event = createEvent({
      run_id: runId,
      seq: nextSeq,
      type,
      phase,
      severity,
      payload: parseResult.data as EventPayloadMap[T],
    })

    // Store the event
    if (!this.events.has(runId)) {
      this.events.set(runId, [])
    }
    this.events.get(runId)!.push(event as Event)

    // Notify subscribers
    this.notifySubscribers(runId, event as Event)

    return { success: true, event: event as Event }
  }

  subscribe(
    runId: string,
    callback: EventSubscriber,
    options?: SubscriptionOptions,
  ): Subscription {
    const subscriptionId = `sub_${++this.subscriptionCounter}`

    if (!this.subscriptions.has(runId)) {
      this.subscriptions.set(runId, new Map())
    }

    this.subscriptions.get(runId)!.set(subscriptionId, { callback, options })

    // If afterSeq is specified, replay events after that seq
    if (options?.afterSeq !== undefined) {
      const events = this.getEvents(runId, options.afterSeq)
      for (const event of events) {
        if (this.matchesFilter(event, options)) {
          callback(event)
        }
      }
    }

    return {
      id: subscriptionId,
      unsubscribe: () => {
        this.subscriptions.get(runId)?.delete(subscriptionId)
      },
    }
  }

  getSeq(runId: string): number {
    return this.seqs.get(runId) ?? -1
  }

  getEvents(runId: string, afterSeq?: number): Event[] {
    const events = this.events.get(runId) ?? []
    if (afterSeq === undefined) {
      return [...events]
    }
    return events.filter((e) => e.seq > afterSeq)
  }

  clearRun(runId: string): void {
    this.events.delete(runId)
    this.seqs.delete(runId)
    this.subscriptions.delete(runId)
  }

  private notifySubscribers(runId: string, event: Event): void {
    const subs = this.subscriptions.get(runId)
    if (!subs) return

    for (const [, { callback, options }] of subs) {
      if (this.matchesFilter(event, options)) {
        try {
          callback(event)
        } catch {
          // Subscriber errors should not affect other subscribers or the emitter
        }
      }
    }
  }

  private matchesFilter(event: Event, options?: SubscriptionOptions): boolean {
    if (!options) return true

    // Filter by event types
    if (options.types && options.types.length > 0) {
      if (!options.types.includes(event.type)) {
        return false
      }
    }

    // Filter by phases
    if (options.phases && options.phases.length > 0) {
      if (!options.phases.includes(event.phase)) {
        return false
      }
    }

    // afterSeq is handled separately in subscribe() for replay
    return true
  }
}

/**
 * Factory function for creating EventEmitter instances
 *
 * @param env - Environment ('development' | 'production' | 'test')
 * @returns EventEmitter implementation appropriate for the environment
 */
export function createEventEmitter(env?: string): EventEmitter {
  // For now, always return in-memory implementation
  // In production, this would return a persistent implementation
  return new InMemoryEventEmitter()
}
