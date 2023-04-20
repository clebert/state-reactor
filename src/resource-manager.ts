/**
 * A generic class for tracking relationships between resources and their
 * consumers.
 */
export class ResourceManager<TResource, TConsumer> {
  readonly #consumersByResource = new Map<TResource, Set<TConsumer>>();

  /**
   * Associates a given resource with its consumer, establishing a relationship.
   *
   * @param resource - The resource to be associated.
   * @param consumer - The consumer that depends on the resource.
   */
  associate(resource: TResource, consumer: TConsumer): void {
    const consumers = this.#consumersByResource.get(resource);

    if (consumers) {
      consumers.add(consumer);
    } else {
      this.#consumersByResource.set(resource, new Set([consumer]));
    }
  }

  /**
   * Removes the association between a resource and all of its consumers, and
   * ensures the removed consumers are no longer associated with any other
   * resources. Returns a `Set` of consumers that were removed, or `undefined`
   * if the resource was not being tracked or had no remaining consumers due to
   * previous `removeAssociations` calls for other resources.
   *
   * @param resource - The resource whose associations should be removed.
   * @returns A `Set` of removed consumers or `undefined`.
   */
  removeAssociations(resource: TResource): Set<TConsumer> | undefined {
    const consumers = this.#consumersByResource.get(resource);

    if (consumers) {
      this.#consumersByResource.delete(resource);

      for (const [
        otherResource,
        otherConsumers,
      ] of this.#consumersByResource.entries()) {
        for (const consumer of consumers) {
          otherConsumers.delete(consumer);
        }

        if (otherConsumers.size === 0) {
          this.#consumersByResource.delete(otherResource);
        }
      }
    }

    return consumers;
  }

  /**
   * Removes all associations between resources and consumers.
   */
  removeAllAssociations(): void {
    this.#consumersByResource.clear();
  }
}
