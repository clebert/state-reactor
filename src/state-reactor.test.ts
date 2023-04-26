import type {Cleanup, Effect, ErrorCallback} from './state-reactor.js';

import {StateReactor} from './state-reactor.js';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const macrotask = async () => new Promise(setImmediate);

describe(`StateReactor`, () => {
  let errorCallback: jest.Mock<ErrorCallback>;
  let reactor: StateReactor;

  beforeEach(() => {
    errorCallback = jest.fn();
    reactor = new StateReactor(errorCallback);
  });

  describe(`start()`, () => {
    it(`executes all registered effects`, async () => {
      const effect1 = jest.fn<Effect>();
      const effect2 = jest.fn<Effect>();

      reactor.useEffect(effect1);
      reactor.useEffect(effect2);

      await macrotask();

      reactor.start();

      expect(effect1).toHaveBeenCalledTimes(0);
      expect(effect2).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect1).toHaveBeenCalledTimes(1);
      expect(effect2).toHaveBeenCalledTimes(1);
    });

    it(`does not execute effects if the reactor is already started`, async () => {
      const effect = jest.fn<Effect>();

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(1);

      reactor.start();

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(1);
    });

    it(`does not execute effects for previously tracked states after stopping and restarting the reactor`, async () => {
      const [getState, setState] = reactor.useState(0);

      const effect = jest.fn<Effect>(() => {
        if (effect.mock.calls.length === 1) {
          getState();
        }
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      reactor.stop();
      reactor.start();

      await macrotask();

      expect(effect).toBeCalledTimes(2);

      setState(1);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
    });
  });

  describe(`stop()`, () => {
    it(`executes all cleanup functions`, async () => {
      const cleanup1 = jest.fn<Cleanup>();
      const cleanup2 = jest.fn<Cleanup>();

      reactor.useEffect(() => cleanup1);
      reactor.useEffect(() => cleanup2);
      reactor.start();

      await macrotask();

      expect(cleanup1).toHaveBeenCalledTimes(0);
      expect(cleanup2).toHaveBeenCalledTimes(0);

      reactor.stop();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);

      await macrotask();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it(`does not execute cleanup functions if the reactor is already stopped`, async () => {
      const cleanup = jest.fn<Cleanup>();

      reactor.useEffect(() => cleanup);
      reactor.start();

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(0);

      reactor.stop();

      expect(cleanup).toHaveBeenCalledTimes(1);

      await macrotask();

      reactor.stop();

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it(`does not re-execute cleanup functions`, async () => {
      const cleanup = jest.fn<Cleanup>();

      reactor.useEffect(() => cleanup);
      reactor.start();

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(0);

      reactor.stop();

      expect(cleanup).toHaveBeenCalledTimes(1);

      await macrotask();

      reactor.start();
      reactor.stop();

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it(`executes the cleanup function only once when it stops the reactor itself during the reactor's stop`, async () => {
      const cleanup = jest.fn<Cleanup>(() => {
        reactor.stop();
      });

      reactor.useEffect(() => cleanup);
      reactor.start();

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(0);

      reactor.stop();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it(`executes the cleanup function only once when a state change triggers the associated effect and the cleanup function stops the reactor`, async () => {
      const [getState, setState] = reactor.useState(0);

      const cleanup = jest.fn<Cleanup>(() => {
        reactor.stop();
      });

      reactor.useEffect(() => {
        getState();

        return cleanup;
      });

      reactor.start();

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(0);

      setState(1);

      await macrotask();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe(`useEffect()`, () => {
    it(`executes the effect when the reactor is started`, async () => {
      const effect = jest.fn<Effect>();

      reactor.start();
      reactor.useEffect(effect);

      expect(effect).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(1);
    });

    it(`does not execute the effect when the reactor is stopped`, async () => {
      const effect = jest.fn<Effect>();

      reactor.useEffect(effect);

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(0);
    });

    it(`does not execute the effect if the reactor is stopped immediately after registration`, async () => {
      const effect = jest.fn<Effect>();

      reactor.useEffect(effect);
      reactor.start();
      reactor.stop();

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(0);
    });

    it(`does not execute the effect if it has already been registered`, async () => {
      const effect = jest.fn<Effect>();

      reactor.start();
      reactor.useEffect(effect);
      reactor.useEffect(effect);

      expect(effect).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(1);

      reactor.useEffect(effect);

      await macrotask();

      expect(effect).toHaveBeenCalledTimes(1);
    });

    it(`ensures sequential execution of effects`, async () => {
      reactor.start();

      const sequence: number[] = [];

      reactor.useEffect(() => {
        sequence.push(1);
      });

      reactor.useEffect(() => {
        sequence.push(2);
      });

      await macrotask();

      expect(sequence).toEqual([1, 2]);
    });
  });

  describe(`useState()`, () => {
    it(`returns accessor functions for managing the given initial state`, () => {
      const [getState1, setState1] = reactor.useState(0);
      const [getState2, setState2] = reactor.useState(`a`);

      expect(getState1()).toBe(0);
      expect(getState2()).toBe(`a`);

      setState1(1);

      expect(getState1()).toBe(1);
      expect(getState2()).toBe(`a`);

      setState2(`b`);
      setState2(`c`);

      expect(getState1()).toBe(1);
      expect(getState2()).toBe(`c`);
    });
  });

  describe(`Getter`, () => {
    it(`disables state tracking within effects when called with the untracked option set to true`, async () => {
      const [getState, setState] = reactor.useState(0);

      const effect = jest.fn<Effect>(() => {
        getState({untracked: true});
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState(1);

      await macrotask();

      expect(effect).toBeCalledTimes(1);
    });

    it(`ensures that state accessed within the cleanup function is not tracked for the associated effect`, async () => {
      const [getState1, setState1] = reactor.useState(0);
      const [getState2, setState2] = reactor.useState(`a`);

      const cleanup = jest.fn<Cleanup>(() => {
        getState2();
      });

      const effect = jest.fn<Effect>(() => {
        getState1();

        return cleanup;
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);
      expect(cleanup).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);
      expect(cleanup).toBeCalledTimes(0);

      setState1(1);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);

      setState2(`b`);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);
    });
  });

  describe(`Setter`, () => {
    it(`triggers dependent effects when the new state differs from the current state`, async () => {
      const [getState, setState] = reactor.useState(0);

      const effect1 = jest.fn<Effect>(() => {
        getState();
      });

      const effect2 = jest.fn<Effect>(() => {
        getState();
      });

      reactor.useEffect(effect1);
      reactor.useEffect(effect2);
      reactor.start();

      expect(effect1).toBeCalledTimes(0);
      expect(effect2).toBeCalledTimes(0);

      await macrotask();

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);

      setState(1);

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);

      await macrotask();

      expect(effect1).toBeCalledTimes(2);
      expect(effect2).toBeCalledTimes(2);
    });

    it(`triggers effects only once when multiple tracked states change simultaneously`, async () => {
      expect.assertions(8);

      const [getState1, setState1] = reactor.useState(0);
      const [getState2, setState2] = reactor.useState(`a`);

      const effect = jest.fn<Effect>(() => {
        if (effect.mock.calls.length === 1) {
          expect(getState1()).toBe(0);
          expect(getState2()).toBe(`a`);
        } else {
          expect(getState1()).toBe(3);
          expect(getState2()).toBe(`c`);
        }

        getState1();
        getState2();
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState1(1);
      setState1(2);
      setState1(3);
      setState2(`b`);
      setState2(`c`);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
      expect(errorCallback).toHaveBeenCalledTimes(0);
    });

    it(`ensures effect execution stays within the originally scheduled microtask even when multiple tracked states change simultaneously`, async () => {
      const [getState1, setState1] = reactor.useState(0);
      const [getState2, setState2] = reactor.useState(`a`);

      const effect = jest.fn<Effect>(() => {
        getState1();
        getState2();
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState1(1);

      const microtask = Promise.resolve();

      setState1(2);
      setState1(3);
      setState2(`b`);
      setState2(`c`);

      await microtask;

      expect(effect).toBeCalledTimes(2);
    });

    it(`does not trigger effects if the new state is identical to the current state`, async () => {
      const [getState, setState] = reactor.useState(0);

      const effect = jest.fn<Effect>(() => {
        getState();
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);
    });

    it(`does not trigger effects that no longer depend on a specific state`, async () => {
      const [getState, setState] = reactor.useState(0);

      const effect = jest.fn<Effect>(() => {
        if (effect.mock.calls.length === 1) {
          getState();
        }
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState(1);

      await macrotask();

      expect(effect).toBeCalledTimes(2);

      setState(2);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
    });

    it(`does not trigger effects if an unrelated state changes without being tracked`, async () => {
      const [getState1] = reactor.useState(0);
      const [, setState2] = reactor.useState(`a`);

      const effect = jest.fn<Effect>(() => {
        getState1();
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState2(`b`);

      await macrotask();

      expect(effect).toBeCalledTimes(1);
    });

    it(`executes cleanup functions before executing corresponding effects`, async () => {
      expect.assertions(8);

      const [getState, setState] = reactor.useState(0);

      const cleanup = jest.fn<Cleanup>();

      const effect = jest.fn<Effect>(() => {
        getState();

        if (effect.mock.calls.length === 2) {
          expect(cleanup).toBeCalledTimes(1);
        }

        return cleanup;
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState(1);

      expect(effect).toBeCalledTimes(1);
      expect(cleanup).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledTimes(0);
    });

    it(`does not execute an old cleanup function for an effect if the effect was re-executed without returning a new cleanup function`, async () => {
      const [getState, setState] = reactor.useState(0);

      const cleanup = jest.fn<Cleanup>();

      const effect: jest.Mock<Effect> = jest.fn<Effect>(() => {
        getState();

        return effect.mock.calls.length === 1 ? cleanup : undefined;
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);

      setState(1);

      expect(effect).toBeCalledTimes(1);
      expect(cleanup).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);

      setState(2);

      await macrotask();

      expect(effect).toBeCalledTimes(3);
      expect(cleanup).toBeCalledTimes(1);
    });

    it(`throws an error if called during the execution of effects`, async () => {
      expect.assertions(2);

      const [, setState] = reactor.useState(0);

      reactor.useEffect(() => {
        expect(() => setState(1)).toThrow(
          `Cannot update state while an effect is being executed.`,
        );
      });

      reactor.start();

      await macrotask();

      expect(errorCallback).toHaveBeenCalledTimes(0);
    });

    it(`allows setState within the cleanup function without triggering the associated effect again`, async () => {
      const [getState, setState] = reactor.useState(0);

      const cleanup = jest.fn<Cleanup>(() => {
        setState(getState() + 1);
      });

      const effect = jest.fn<Effect>(() => {
        getState();

        return cleanup;
      });

      reactor.useEffect(effect);
      reactor.start();

      expect(effect).toBeCalledTimes(0);
      expect(cleanup).toBeCalledTimes(0);

      await macrotask();

      expect(effect).toBeCalledTimes(1);
      expect(cleanup).toBeCalledTimes(0);

      setState(1);

      await macrotask();

      expect(effect).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);
    });
  });

  describe(`error handling`, () => {
    it(`invokes errorCallback with error details when an error occurs in effects or cleanup functions`, async () => {
      const [getState, setState] = reactor.useState(0);
      const cleanupError = new Error(`cleanup`);

      const cleanup = jest.fn<Cleanup>(() => {
        throw cleanupError;
      });

      const effect1 = jest.fn<Effect>(() => {
        getState();

        return cleanup;
      });

      const effectError = new Error(`effect`);

      const effect2 = jest.fn<Effect>(() => {
        getState();

        throw effectError;
      });

      reactor.useEffect(effect1);
      reactor.useEffect(effect2);
      reactor.start();

      expect(effect1).toBeCalledTimes(0);
      expect(effect2).toBeCalledTimes(0);
      expect(errorCallback).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledTimes(1);

      setState(1);

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);
      expect(cleanup).toBeCalledTimes(0);
      expect(errorCallback).toHaveBeenCalledTimes(1);

      await macrotask();

      expect(effect1).toBeCalledTimes(2);
      expect(effect2).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledTimes(3);
      expect(errorCallback).toHaveBeenNthCalledWith(1, effectError);
      expect(errorCallback).toHaveBeenNthCalledWith(2, cleanupError);
      expect(errorCallback).toHaveBeenNthCalledWith(3, effectError);
    });

    it(`continues executing remaining effects and cleanup functions despite encountering errors`, async () => {
      const cleanup1 = jest.fn<Cleanup>(() => {
        throw new Error();
      });

      const effect1 = jest.fn<Effect>(() => {
        return cleanup1;
      });

      const effect2 = jest.fn<Effect>(() => {
        throw new Error();
      });

      const cleanup2 = jest.fn<Cleanup>();

      const effect3 = jest.fn<Effect>(() => {
        return cleanup2;
      });

      reactor.useEffect(effect1);
      reactor.useEffect(effect2);
      reactor.useEffect(effect3);
      reactor.start();

      expect(effect1).toBeCalledTimes(0);
      expect(effect2).toBeCalledTimes(0);
      expect(effect3).toBeCalledTimes(0);
      expect(errorCallback).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);
      expect(effect3).toBeCalledTimes(1);
      expect(cleanup1).toBeCalledTimes(0);
      expect(cleanup2).toBeCalledTimes(0);
      expect(errorCallback).toHaveBeenCalledTimes(1);

      reactor.stop();

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);
      expect(effect3).toBeCalledTimes(1);
      expect(cleanup1).toBeCalledTimes(1);
      expect(cleanup2).toBeCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledTimes(2);
    });

    it(`ignores errors within errorCallback`, async () => {
      errorCallback = jest.fn(() => {
        throw new Error();
      });

      reactor = new StateReactor(errorCallback);

      const effect1 = jest.fn<Effect>(() => {
        throw new Error();
      });

      const effect2 = jest.fn<Effect>(() => {
        throw new Error();
      });

      reactor.useEffect(effect1);
      reactor.useEffect(effect2);
      reactor.start();

      expect(effect1).toBeCalledTimes(0);
      expect(effect2).toBeCalledTimes(0);
      expect(errorCallback).toHaveBeenCalledTimes(0);

      await macrotask();

      expect(effect1).toBeCalledTimes(1);
      expect(effect2).toBeCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledTimes(2);
    });
  });
});
