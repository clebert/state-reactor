# StateReactor

> Efficient state management and reactive programming with an API inspired by
> React Hooks, designed for a variety of applications.

The `StateReactor` class is designed to simplify state management and promote
reactive programming across various types of applications. Featuring an API
inspired by React Hooks, it provides a user-friendly interface that enables
developers to create maintainable and well-structured code. The key features of
the `StateReactor` class are:

- **State Management**: The `useState()` method allows for clearly defining and
  managing the state of a specific part of an application. This enables breaking
  down the state into manageable units, resulting in a clearer structure and
  improved maintainability.
- **Side Effects**: The `useEffect()` method separates side effects caused by
  state changes from the actual state management. This enables defining the
  logic for reacting to state changes separately from state management, making
  the code easier to understand and debug.
- **Automatic Dependency Tracking**: Automatic dependency tracking eliminates
  the need to manually define and update dependencies, reducing the risk of
  errors and making the code more comprehensible.

## Installation

Using npm:

```sh
npm install state-reactor
```

Using Yarn:

```sh
yarn add state-reactor
```

After installing the package, you can import it into your project and start
using the `StateReactor` class as demonstrated in the usage example.

## Usage Example

The following example demonstrates how to use the `StateReactor` class to manage
the state of a simple counter. In this example, we define the state and an
effect to log state changes. We also create actions for incrementing and
decrementing the counter. The reactor's lifecycle is managed by starting and
stopping it. Asynchronous code is used to showcase the asynchronous nature of
effects and to illustrate how multiple state changes are batched together.

```js
import {StateReactor} from 'state-reactor';

// Define an error callback for handling errors that may occur in the user code,
// specifically within the effects or their cleanup functions
const errorCallback = (/** @type {unknown} */ error) => {
  console.error(`An error occurred:`, error);
};

const reactor = new StateReactor(errorCallback);

// Define state
const [getCount, setCount] = reactor.useState(0);

// Define an effect to log state changes
reactor.useEffect(() => {
  console.log(`Count is now: ${getCount()}`);

  return () => {
    console.log(`Cleaning up...`);
  };
});

// Define actions for incrementing and decrementing the counter
const increment = () => setCount(getCount() + 1);
const decrement = () => setCount(getCount() - 1);

await (async () => {
  // Start the reactor
  reactor.start();

  // Perform some actions
  increment();

  await Promise.resolve(); // Wait for the effect to log the new count: "Count is now: 1"

  increment();
  increment();
  decrement();

  await Promise.resolve(); // Logs: "Cleaning up..."; then logs the new count: "Count is now: 2"

  // Stop the reactor and clean up any effects
  reactor.stop(); // Logs: "Cleaning up..."
})();
```
