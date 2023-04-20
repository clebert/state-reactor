import {ResourceManager} from './resource-manager.js';
import {beforeEach, describe, expect, it} from '@jest/globals';

describe(`ResourceManager`, () => {
  let resourceManager: ResourceManager<string, string>;

  beforeEach(() => {
    resourceManager = new ResourceManager();
  });

  describe(`removeAssociations()`, () => {
    it(`removes associations of a resource and its consumers while disassociating them from other resources`, () => {
      const associateAll = () => {
        resourceManager.associate(`a`, `apple`);
        resourceManager.associate(`p`, `apple`);
        resourceManager.associate(`a`, `mango`);
        resourceManager.associate(`g`, `mango`);
        resourceManager.associate(`k`, `kiwi`);
        resourceManager.associate(`i`, `kiwi`);
      };

      associateAll();

      expect(resourceManager.removeAssociations(`a`)).toEqual(
        new Set([`apple`, `mango`]),
      );

      expect(resourceManager.removeAssociations(`i`)).toEqual(
        new Set([`kiwi`]),
      );

      expect(resourceManager.removeAssociations(`a`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`i`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`p`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`g`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`k`)).toBeUndefined();

      associateAll();

      expect(resourceManager.removeAssociations(`p`)).toEqual(
        new Set([`apple`]),
      );

      expect(resourceManager.removeAssociations(`g`)).toEqual(
        new Set([`mango`]),
      );

      expect(resourceManager.removeAssociations(`k`)).toEqual(
        new Set([`kiwi`]),
      );

      expect(resourceManager.removeAssociations(`a`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`i`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`p`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`g`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`k`)).toBeUndefined();
    });

    it(`removes associations of duplicate resources and consumers`, () => {
      resourceManager.associate(`a`, `apple`);
      resourceManager.associate(`a`, `apple`);

      expect(resourceManager.removeAssociations(`a`)).toEqual(
        new Set([`apple`]),
      );

      expect(resourceManager.removeAssociations(`a`)).toBeUndefined();
    });
  });

  describe(`removeAllAssociations()`, () => {
    it(`removes all associations between resources and consumers`, () => {
      resourceManager.associate(`a`, `apple`);
      resourceManager.associate(`b`, `banana`);
      resourceManager.associate(`c`, `cherry`);

      resourceManager.removeAllAssociations();

      expect(resourceManager.removeAssociations(`a`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`b`)).toBeUndefined();
      expect(resourceManager.removeAssociations(`c`)).toBeUndefined();
    });
  });
});
