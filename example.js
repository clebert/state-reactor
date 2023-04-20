import {StateReactor} from './lib/index.js';

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
