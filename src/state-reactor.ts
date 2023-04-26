import {ResourceManager} from './resource-manager.js';

/**
 * A callback function that handles errors occurring within effects or their
 * cleanup functions.
 *
 * @param error - An error that occurred within effects or their cleanup
 * functions.
 */
export type ErrorCallback = (error: unknown) => void;

export type Effect = () => void | Cleanup;
export type Cleanup = () => void;
export type Accessors<T> = [Getter<T>, Setter<T>, Observer];
export type Getter<T> = (options?: GetterOptions) => T;

export interface GetterOptions {
  /**
   * If `true`, the getter function will not track state dependencies.
   */
  readonly untracked?: boolean;
}

/**
 * A setter function for updating a piece of state.
 *
 * @param newState - The new state value.
 * @throws If the reactor is currently executing an effect.
 */
export type Setter<T> = (newState: T) => void;

/**
 * An observer function which accepts a listener function as a parameter.
 *
 * @param listener - A listener function to be invoked when state changes.
 */
export type Observer = (listener: Listener) => void;

/**
 * A listener function to be invoked when the state changes.
 */
export type Listener = () => void;

/**
 * A class that simplifies state management and promotes reactive programming by
 * providing an API inspired by React Hooks.
 */
export class StateReactor {
  readonly #errorCallback: ErrorCallback;

  /**
   * @param errorCallback - A callback function that handles errors occurring
   * within effects or their cleanup functions.
   */
  constructor(errorCallback: ErrorCallback) {
    this.#errorCallback = errorCallback;
  }

  #handleError(error: unknown): void {
    try {
      this.#errorCallback(error);
    } catch {}
  }

  #started = false;

  readonly #effects = new Set<Effect>();

  /**
   * Starts the reactor and asynchronously executes all registered effects. This
   * method should be called before performing actions that interact with the
   * reactor's state.
   */
  start(): void {
    if (!this.#started) {
      this.#started = true;

      for (const effect of this.#effects) {
        this.#queueEffect(effect);
      }
    }
  }

  readonly #cleanupByEffect = new Map<Effect, Cleanup>();
  readonly #stateManager = new ResourceManager<Setter<any>, Effect>();

  /**
   * Stops the reactor and cleans up any registered effects. This method should
   * be called when the reactor is no longer needed.
   */
  stop(): void {
    if (this.#started) {
      this.#started = false;

      for (const cleanup of this.#cleanupByEffect.values()) {
        try {
          cleanup();
        } catch (error) {
          this.#handleError(error);
        }
      }

      this.#cleanupByEffect.clear();
      this.#stateManager.removeAllAssociations();
    }
  }

  /**
   * Registers an effect that will be executed asynchronously after state
   * changes, which are implicitly tracked through the use of getter functions
   * within the effect. The effect will not be executed during the execution of
   * another effect or cleanup function, ensuring that effects execute
   * sequentially.
   *
   * If the reactor is started or already started, the registered effect will be
   * executed asynchronously once. If the effect has already been registered,
   * this method has no effect.
   *
   * @param effect - A function that defines the side effect logic. It may
   * return an optional cleanup function.
   */
  useEffect(effect: Effect): void {
    if (!this.#effects.has(effect)) {
      this.#effects.add(effect);
      this.#queueEffect(effect);
    }
  }

  #executingEffect: Effect | undefined;

  /**
   * Defines and manages a piece of state.
   *
   * @param initialState - The initial state value.
   * @returns A tuple containing a getter function that retrieves the current
   * state value, a setter function that updates the state value, and an
   * observer function that registers a listener function for state changes. The
   * setter function should be called asynchronously to ensure it is not
   * executed during the execution of an effect.
   */
  useState<T>(initialState: T): Accessors<T> {
    let state = initialState;

    const listeners = new Set<Listener>();

    const setter: Setter<T> = (newState) => {
      if (this.#executingEffect) {
        throw new Error(
          `Cannot update state while an effect is being executed.`,
        );
      }

      if (state !== newState) {
        state = newState;

        const effects = this.#stateManager.removeAssociations(setter);

        if (effects) {
          for (const effect of effects) {
            this.#queueEffect(effect);
          }
        }

        for (const listener of listeners) {
          try {
            listener();
          } catch (error) {
            this.#handleError(error);
          }
        }
      }
    };

    const getter: Getter<T> = ({untracked} = {}) => {
      if (this.#executingEffect && !untracked) {
        this.#stateManager.associate(setter, this.#executingEffect);
      }

      return state;
    };

    const observer: Observer = (listener) => {
      listeners.add(listener);
    };

    return [getter, setter, observer];
  }

  /**
   * Registers a getter function and an observer function from a compatible
   * external source to be used as part of the current reactor.
   *
   * @param getter - A getter function that retrieves the state value from the
   * external source.
   * @param observer - An observer function that registers a listener for state
   * changes in the external source.
   * @returns A new getter function that retrieves the current state value from
   * the external source.
   */
  useExternalState<T>(getter: () => T, observer: Observer): Getter<T> {
    const [getState, setState] = this.useState(getter());

    observer(() => setState(getter()));

    return getState;
  }

  #queueEffect(effect: Effect): void {
    if (this.#started) {
      queueMicrotask(() => this.#executeEffect(effect));
    }
  }

  #executeEffect(effect: Effect): void {
    if (this.#started) {
      let cleanup: void | Cleanup = this.#cleanupByEffect.get(effect);

      if (cleanup) {
        this.#cleanupByEffect.delete(effect);

        try {
          cleanup();
        } catch (error) {
          this.#handleError(error);
        }
      }

      this.#executingEffect = effect;

      try {
        cleanup = effect();

        if (cleanup) {
          this.#cleanupByEffect.set(effect, cleanup);
        }
      } catch (error) {
        this.#handleError(error);
      }

      this.#executingEffect = undefined;
    }
  }
}
