import {
  type Run,
  type RunState,
  type UserAction,
  isValidTransition,
  isValidAction,
  getValidTransitions,
  getValidActions,
  isTerminalState,
} from '../types/run'
import { type Phase } from '../types'
import { type EventEmitter } from './events'

/**
 * State machine error types
 */
export type StateMachineErrorType =
  | 'invalid_transition'
  | 'invalid_action'
  | 'missing_previous_state'
  | 'invalid_resume_state'
  | 'terminal_state'
  | 'drift_detected'

/**
 * Error thrown when state machine validation fails
 */
export class StateMachineError extends Error {
  constructor(
    public readonly errorType: StateMachineErrorType,
    public readonly details: {
      currentState: RunState
      attemptedState?: RunState
      action?: UserAction
      reason: string
    },
  ) {
    super(`${errorType}: ${details.reason}`)
    this.name = 'StateMachineError'
  }
}

/**
 * Result of a state transition
 */
export interface TransitionResult {
  success: boolean
  newState: RunState
  previousState: RunState | null
  reason?: string
}

/**
 * Input for a state transition
 */
export interface TransitionInput {
  /** Target state to transition to */
  targetState: RunState
  /** Reason for the transition (used in phase.changed event) */
  reason?: string
}

/**
 * Input for a user action
 */
export interface ActionInput {
  /** The user action to perform */
  action: UserAction
  /** Additional context for the action */
  context?: {
    /** For reject: the rejection reason */
    rejectReason?: 'user_cancelled' | 'needs_edit' | 'policy_violation'
  }
}

/**
 * Drift detection context
 */
export interface DriftContext {
  /** Tool that caused the drift */
  toolName?: string
  /** File path involved */
  path?: string
  /** Description of the drift */
  details: string
}

/**
 * States that require previous_state to be set
 */
const STATES_REQUIRING_PREVIOUS: RunState[] = ['awaiting_approval', 'paused']

/**
 * States that can be resumed from (when in awaiting_approval or paused)
 */
const RESUMABLE_STATES: RunState[] = ['planning', 'executing', 'verifying']

/**
 * Map user actions to resulting states
 */
function getTargetStateForAction(
  action: UserAction,
  currentState: RunState,
  previousState: RunState | null,
  rejectReason?: 'user_cancelled' | 'needs_edit' | 'policy_violation',
): RunState {
  switch (action) {
    case 'pause':
      return 'paused'
    case 'resume':
      // Resume returns to previous_state
      if (!previousState || !RESUMABLE_STATES.includes(previousState)) {
        throw new StateMachineError('invalid_resume_state', {
          currentState,
          reason: `Cannot resume: previous_state '${previousState}' is not a valid resumable state`,
        })
      }
      return previousState
    case 'cancel':
      return 'cancelled'
    case 'approve':
      // Approve returns to previous_state
      if (!previousState || !RESUMABLE_STATES.includes(previousState)) {
        throw new StateMachineError('invalid_resume_state', {
          currentState,
          reason: `Cannot approve: previous_state '${previousState}' is not a valid resumable state`,
        })
      }
      return previousState
    case 'reject':
      // Reject outcome depends on reason
      switch (rejectReason) {
        case 'user_cancelled':
          return 'cancelled'
        case 'needs_edit':
          return 'paused'
        case 'policy_violation':
          return 'failed'
        default:
          return 'cancelled' // Default to cancelled if no reason
      }
    case 'retry':
      // Retry resets to pending (orchestrator will handle re-initialization)
      return 'pending'
    default:
      throw new StateMachineError('invalid_action', {
        currentState,
        action,
        reason: `Unknown action: ${action}`,
      })
  }
}

/**
 * RunStateMachine - enforces valid state transitions for runs
 *
 * This service is the single source of truth for run state transitions.
 * All state changes MUST go through this service to ensure:
 * - Valid transition paths
 * - Required previous_state tracking
 * - Event emission for phase changes
 * - Drift detection
 */
export class RunStateMachine {
  constructor(private readonly eventEmitter?: EventEmitter) {}

  /**
   * Attempt a direct state transition
   *
   * Use this for orchestrator-driven transitions (e.g., phase completion).
   * For user-initiated actions, use performAction() instead.
   *
   * @throws StateMachineError if transition is invalid
   */
  transition(run: Run, input: TransitionInput): TransitionResult {
    const { targetState, reason } = input
    const currentState = run.state

    // Check if already in terminal state
    if (isTerminalState(currentState)) {
      throw new StateMachineError('terminal_state', {
        currentState,
        attemptedState: targetState,
        reason: `Cannot transition from terminal state '${currentState}'`,
      })
    }

    // Validate the transition
    if (!isValidTransition(currentState, targetState)) {
      throw new StateMachineError('invalid_transition', {
        currentState,
        attemptedState: targetState,
        reason: `Invalid transition from '${currentState}' to '${targetState}'. Valid targets: ${getValidTransitions(currentState).join(', ')}`,
      })
    }

    // Validate previous_state requirements
    this.validatePreviousStateRequirements(run, targetState)

    // Emit phase.changed event
    this.emitPhaseChanged(run.run_id, currentState, targetState, reason)

    // Determine new previous_state
    const newPreviousState = STATES_REQUIRING_PREVIOUS.includes(targetState) ? currentState : null

    return {
      success: true,
      newState: targetState,
      previousState: newPreviousState,
      reason,
    }
  }

  /**
   * Perform a user action on a run
   *
   * This method translates user actions (pause, resume, cancel, etc.)
   * into state transitions, validating that the action is permitted
   * in the current state.
   *
   * @throws StateMachineError if action is invalid
   */
  performAction(run: Run, input: ActionInput): TransitionResult {
    const { action, context } = input
    const currentState = run.state

    // Check if action is valid for current state
    if (!isValidAction(currentState, action)) {
      throw new StateMachineError('invalid_action', {
        currentState,
        action,
        reason: `Action '${action}' is not valid in state '${currentState}'. Valid actions: ${getValidActions(currentState).join(', ')}`,
      })
    }

    // Map action to target state
    const targetState = getTargetStateForAction(action, currentState, run.previous_state, context?.rejectReason)

    // Validate the resulting transition
    if (!isValidTransition(currentState, targetState)) {
      throw new StateMachineError('invalid_transition', {
        currentState,
        attemptedState: targetState,
        action,
        reason: `Action '${action}' would result in invalid transition from '${currentState}' to '${targetState}'`,
      })
    }

    // Emit phase.changed event
    const reason = `User action: ${action}${context?.rejectReason ? ` (${context.rejectReason})` : ''}`
    this.emitPhaseChanged(run.run_id, currentState, targetState, reason)

    // Determine new previous_state
    const newPreviousState = STATES_REQUIRING_PREVIOUS.includes(targetState) ? currentState : null

    return {
      success: true,
      newState: targetState,
      previousState: newPreviousState,
      reason,
    }
  }

  /**
   * Detect drift when agent actions don't match expected phase
   *
   * Drift occurs when:
   * - Agent uses tools not allowed in current phase
   * - Agent accesses paths outside contract scope
   * - Agent enters a loop pattern
   * - Contract constraints are violated
   *
   * @returns true if drift was detected and handled
   */
  detectDrift(run: Run, driftContext: DriftContext): boolean {
    const { toolName, path, details } = driftContext

    // Determine drift type
    let driftType: 'unauthorized_tool' | 'path_violation' | 'loop_detected' | 'constraint_breach' = 'constraint_breach'

    if (toolName) {
      driftType = 'unauthorized_tool'
    } else if (path) {
      driftType = 'path_violation'
    } else if (details.toLowerCase().includes('loop')) {
      driftType = 'loop_detected'
    }

    // Emit drift.detected event
    if (this.eventEmitter) {
      this.eventEmitter.emit(
        run.run_id,
        'drift.detected',
        {
          drift_type: driftType,
          details,
          tool_name: toolName,
          path,
        },
        run.state as Phase,
        'warning',
      )
    }

    return true
  }

  /**
   * Check if a transition would be valid without performing it
   */
  canTransition(run: Run, targetState: RunState): boolean {
    if (isTerminalState(run.state)) {
      return false
    }

    if (!isValidTransition(run.state, targetState)) {
      return false
    }

    // Check previous_state requirements for states that need it
    if (STATES_REQUIRING_PREVIOUS.includes(targetState)) {
      // Only allow if current state can be resumed from
      if (!RESUMABLE_STATES.includes(run.state)) {
        return false
      }
    }

    // For resume-type transitions, check previous_state is set
    if (targetState === run.previous_state) {
      if (!run.previous_state || !RESUMABLE_STATES.includes(run.previous_state)) {
        return false
      }
    }

    return true
  }

  /**
   * Check if an action would be valid without performing it
   */
  canPerformAction(run: Run, action: UserAction): boolean {
    return isValidAction(run.state, action)
  }

  /**
   * Get valid next states from current state
   */
  getValidNextStates(run: Run): RunState[] {
    if (isTerminalState(run.state)) {
      return []
    }
    return getValidTransitions(run.state)
  }

  /**
   * Get valid actions for current state
   */
  getValidActionsForState(run: Run): UserAction[] {
    return getValidActions(run.state)
  }

  /**
   * Validate previous_state requirements for a transition
   */
  private validatePreviousStateRequirements(run: Run, targetState: RunState): void {
    // If transitioning TO a state that requires previous_state,
    // the current state must be a resumable state
    if (STATES_REQUIRING_PREVIOUS.includes(targetState)) {
      if (!RESUMABLE_STATES.includes(run.state)) {
        throw new StateMachineError('missing_previous_state', {
          currentState: run.state,
          attemptedState: targetState,
          reason: `State '${targetState}' requires previous_state, but current state '${run.state}' is not a resumable state. Resumable states: ${RESUMABLE_STATES.join(', ')}`,
        })
      }
    }

    // If transitioning FROM awaiting_approval or paused back to a work state,
    // previous_state must be set and match the target
    if (STATES_REQUIRING_PREVIOUS.includes(run.state)) {
      if (RESUMABLE_STATES.includes(targetState)) {
        if (run.previous_state !== targetState) {
          throw new StateMachineError('invalid_resume_state', {
            currentState: run.state,
            attemptedState: targetState,
            reason: `Cannot resume to '${targetState}' - must resume to previous_state '${run.previous_state}'`,
          })
        }
      }
    }
  }

  /**
   * Emit a phase.changed event
   */
  private emitPhaseChanged(runId: string, fromState: RunState, toState: RunState, reason?: string): void {
    if (!this.eventEmitter) return

    this.eventEmitter.emit(
      runId,
      'phase.changed',
      {
        from_phase: fromState as Phase,
        to_phase: toState as Phase,
        reason,
      },
      toState as Phase,
      'info',
    )
  }
}

/**
 * Factory function for creating RunStateMachine instances
 *
 * @param eventEmitter - Optional event emitter for phase.changed events
 */
export function createRunStateMachine(eventEmitter?: EventEmitter): RunStateMachine {
  return new RunStateMachine(eventEmitter)
}
