import { z } from 'zod'
import { type Event, EventSchema, type EventType } from '../types'

/**
 * Result type for event store operations
 */
export type EventStoreResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Pagination cursor for event queries
 */
export interface EventCursor {
  /** Last seq seen - next query starts after this */
  afterSeq: number
  /** Run ID this cursor belongs to */
  runId: string
}

/**
 * Options for querying events
 */
export interface EventQueryOptions {
  /** Return events after this seq (exclusive) */
  afterSeq?: number
  /** Maximum events to return (for pagination) */
  limit?: number
  /** Filter by event types */
  types?: EventType[]
}

/**
 * Paginated result for event queries
 */
export interface EventPage {
  /** Events in this page */
  events: Event[]
  /** Cursor for next page, undefined if no more events */
  nextCursor?: EventCursor
  /** Whether there are more events after this page */
  hasMore: boolean
}

/**
 * Statistics about events for a run
 */
export interface EventStats {
  /** Total number of events */
  totalEvents: number
  /** Highest seq number */
  lastSeq: number
  /** Count of events by type */
  byType: Partial<Record<EventType, number>>
  /** First event timestamp (ISO 8601) */
  firstEventAt?: string
  /** Last event timestamp (ISO 8601) */
  lastEventAt?: string
}

/**
 * EventStore interface - persistent storage for events
 *
 * This is the persistence layer that backs the EventEmitter.
 * It provides:
 * - Append-only event storage (immutable log)
 * - Query by run_id with seq cursor for replay
 * - Pagination for large event streams
 * - Statistics for run summaries
 *
 * Unlike EventEmitter which handles real-time emission and subscriptions,
 * EventStore handles durable storage and retrieval.
 */
export interface EventStore {
  /**
   * Append an event to the store (idempotent on event_id)
   *
   * Events must be appended with correct seq ordering per run_id.
   * Duplicate event_ids are no-ops (idempotent).
   *
   * @param event - The event to store (must be fully formed)
   * @returns Result indicating success or error
   */
  append(event: Event): Promise<EventStoreResult<void>>

  /**
   * Append multiple events atomically
   *
   * All events must belong to the same run_id.
   * Either all events are stored or none (transactional).
   *
   * @param events - Array of events to store
   * @returns Result indicating success or error
   */
  appendBatch(events: Event[]): Promise<EventStoreResult<void>>

  /**
   * Query events for a run with pagination
   *
   * Events are returned in seq order (ascending).
   * Use the cursor from the result to fetch the next page.
   *
   * @param runId - The run to query events for
   * @param options - Query options (afterSeq, limit, types)
   * @returns Paginated result with events and cursor
   */
  query(runId: string, options?: EventQueryOptions): Promise<EventStoreResult<EventPage>>

  /**
   * Get a single event by event_id
   *
   * @param eventId - The event ID to retrieve
   * @returns The event or not found error
   */
  getById(eventId: string): Promise<EventStoreResult<Event>>

  /**
   * Get statistics for a run's events
   *
   * @param runId - The run to get stats for
   * @returns Event statistics
   */
  getStats(runId: string): Promise<EventStoreResult<EventStats>>

  /**
   * Check if a run exists (has any events)
   *
   * @param runId - The run to check
   * @returns Whether the run has events
   */
  runExists(runId: string): Promise<boolean>

  /**
   * Get the latest seq for a run
   *
   * Used by EventEmitter to sync seq after reconnection.
   *
   * @param runId - The run to get seq for
   * @returns Latest seq or -1 if no events
   */
  getLatestSeq(runId: string): Promise<number>

  /**
   * Delete all events for a run (for cleanup/testing)
   *
   * Use with caution - events are meant to be immutable.
   *
   * @param runId - The run to delete events for
   * @returns Result indicating success or error
   */
  deleteRun(runId: string): Promise<EventStoreResult<void>>
}

/**
 * In-memory EventStore implementation
 *
 * Suitable for development and testing.
 * For production, use a persistent implementation backed by
 * a database (SQLite, PostgreSQL) or append-only log.
 */
export class InMemoryEventStore implements EventStore {
  /** Events indexed by run_id */
  private eventsByRun: Map<string, Event[]> = new Map()

  /** Events indexed by event_id for fast lookup */
  private eventsById: Map<string, Event> = new Map()

  /** Default page size for queries */
  private defaultLimit = 100

  async append(event: Event): Promise<EventStoreResult<void>> {
    // Validate the event structure
    const parseResult = EventSchema.safeParse(event)
    if (!parseResult.success) {
      return { success: false, error: `Invalid event: ${parseResult.error.message}` }
    }

    // Idempotent: skip if event_id already exists
    if (this.eventsById.has(event.event_id)) {
      return { success: true, data: undefined }
    }

    // Validate seq ordering
    const runEvents = this.eventsByRun.get(event.run_id) ?? []
    const lastSeq = runEvents.length > 0 ? runEvents[runEvents.length - 1].seq : -1

    if (event.seq !== lastSeq + 1) {
      return {
        success: false,
        error: `Invalid seq: expected ${lastSeq + 1}, got ${event.seq}`,
      }
    }

    // Store event
    if (!this.eventsByRun.has(event.run_id)) {
      this.eventsByRun.set(event.run_id, [])
    }
    this.eventsByRun.get(event.run_id)!.push(event)
    this.eventsById.set(event.event_id, event)

    return { success: true, data: undefined }
  }

  async appendBatch(events: Event[]): Promise<EventStoreResult<void>> {
    if (events.length === 0) {
      return { success: true, data: undefined }
    }

    // Validate all events belong to the same run
    const runId = events[0].run_id
    if (!events.every((e) => e.run_id === runId)) {
      return { success: false, error: 'All events in a batch must belong to the same run' }
    }

    // Validate events are in correct seq order
    for (let i = 1; i < events.length; i++) {
      if (events[i].seq !== events[i - 1].seq + 1) {
        return {
          success: false,
          error: `Invalid seq order in batch at index ${i}: expected ${events[i - 1].seq + 1}, got ${events[i].seq}`,
        }
      }
    }

    // Append each event (leverages single append validation)
    for (const event of events) {
      const result = await this.append(event)
      if (!result.success) {
        return result
      }
    }

    return { success: true, data: undefined }
  }

  async query(runId: string, options?: EventQueryOptions): Promise<EventStoreResult<EventPage>> {
    const runEvents = this.eventsByRun.get(runId) ?? []
    const afterSeq = options?.afterSeq ?? -1
    const limit = options?.limit ?? this.defaultLimit
    const types = options?.types

    // Filter events by seq and optionally by type
    let filtered = runEvents.filter((e) => e.seq > afterSeq)
    if (types && types.length > 0) {
      filtered = filtered.filter((e) => types.includes(e.type))
    }

    // Apply pagination
    const pageEvents = filtered.slice(0, limit)
    const hasMore = filtered.length > limit

    // Build cursor for next page
    const nextCursor: EventCursor | undefined =
      hasMore && pageEvents.length > 0
        ? {
            afterSeq: pageEvents[pageEvents.length - 1].seq,
            runId,
          }
        : undefined

    return {
      success: true,
      data: {
        events: pageEvents,
        nextCursor,
        hasMore,
      },
    }
  }

  async getById(eventId: string): Promise<EventStoreResult<Event>> {
    const event = this.eventsById.get(eventId)
    if (!event) {
      return { success: false, error: `Event not found: ${eventId}` }
    }
    return { success: true, data: event }
  }

  async getStats(runId: string): Promise<EventStoreResult<EventStats>> {
    const runEvents = this.eventsByRun.get(runId) ?? []

    if (runEvents.length === 0) {
      return {
        success: true,
        data: {
          totalEvents: 0,
          lastSeq: -1,
          byType: {},
        },
      }
    }

    // Count events by type
    const byType: Partial<Record<EventType, number>> = {}
    for (const event of runEvents) {
      byType[event.type] = (byType[event.type] ?? 0) + 1
    }

    return {
      success: true,
      data: {
        totalEvents: runEvents.length,
        lastSeq: runEvents[runEvents.length - 1].seq,
        byType,
        firstEventAt: runEvents[0].ts,
        lastEventAt: runEvents[runEvents.length - 1].ts,
      },
    }
  }

  async runExists(runId: string): Promise<boolean> {
    return this.eventsByRun.has(runId) && this.eventsByRun.get(runId)!.length > 0
  }

  async getLatestSeq(runId: string): Promise<number> {
    const runEvents = this.eventsByRun.get(runId) ?? []
    if (runEvents.length === 0) {
      return -1
    }
    return runEvents[runEvents.length - 1].seq
  }

  async deleteRun(runId: string): Promise<EventStoreResult<void>> {
    const runEvents = this.eventsByRun.get(runId) ?? []

    // Remove from event_id index
    for (const event of runEvents) {
      this.eventsById.delete(event.event_id)
    }

    // Remove from run index
    this.eventsByRun.delete(runId)

    return { success: true, data: undefined }
  }
}

/**
 * Factory function for creating EventStore instances
 *
 * @param env - Environment ('development' | 'production' | 'test')
 * @returns EventStore implementation appropriate for the environment
 */
export function createEventStore(env?: string): EventStore {
  // For now, always return in-memory implementation
  // In production, this would return a SQLite or PostgreSQL-backed implementation
  return new InMemoryEventStore()
}
