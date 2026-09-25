/**
 * Tests for the Local Vault Revision — a counter that moves whenever the
 * Local Vault is replaced underneath readers.
 *
 * ADR 0047 and #587 together establish that convergence replaces the Local
 * Vault without passing through page load effects, so pages holding decrypted
 * records see stale copies. The revision tells them to read again.
 */

import { createLocalVaultRevision } from './localVaultRevision';

describe('createLocalVaultRevision', () => {
  describe('current()', () => {
    it('starts at 0', () => {
      const revision = createLocalVaultRevision();
      expect(revision.current()).toBe(0);
    });

    it('increments after bump()', () => {
      const revision = createLocalVaultRevision();
      revision.bump();
      expect(revision.current()).toBe(1);
    });

    it('increments again on subsequent bump()', () => {
      const revision = createLocalVaultRevision();
      revision.bump();
      revision.bump();
      revision.bump();
      expect(revision.current()).toBe(3);
    });
  });

  describe('bump()', () => {
    it('invokes a registered subscriber', () => {
      const revision = createLocalVaultRevision();
      const listener = jest.fn();

      revision.subscribe(listener);
      revision.bump();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('invokes all registered subscribers', () => {
      const revision = createLocalVaultRevision();
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      revision.subscribe(listener1);
      revision.subscribe(listener2);
      revision.subscribe(listener3);
      revision.bump();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('does not invoke unsubscribed listener', () => {
      const revision = createLocalVaultRevision();
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = revision.subscribe(listener1);
      revision.subscribe(listener2);

      unsubscribe1();
      revision.bump();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('swallows listener errors and continues notifying others', () => {
      const revision = createLocalVaultRevision();
      const throwingListener = jest.fn(() => {
        throw new Error('listener failed');
      });
      const normalListener = jest.fn();

      revision.subscribe(throwingListener);
      revision.subscribe(normalListener);

      // Should not throw
      expect(() => revision.bump()).not.toThrow();

      // Both listeners should have been called
      expect(throwingListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);
    });

    it('swallows multiple listener errors', () => {
      const revision = createLocalVaultRevision();
      const listener1 = jest.fn(() => {
        throw new Error('error 1');
      });
      const listener2 = jest.fn(() => {
        throw new Error('error 2');
      });
      const listener3 = jest.fn();

      revision.subscribe(listener1);
      revision.subscribe(listener2);
      revision.subscribe(listener3);

      expect(() => revision.bump()).not.toThrow();
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe()', () => {
    it('returns a function', () => {
      const revision = createLocalVaultRevision();
      const listener = jest.fn();
      const unsubscribe = revision.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('returned unsubscribe function stops listener notifications', () => {
      const revision = createLocalVaultRevision();
      const listener = jest.fn();

      const unsubscribe = revision.subscribe(listener);
      revision.bump();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      revision.bump();

      // Still only called once (second bump did not invoke)
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('multiple calls to subscribe() register independent listeners', () => {
      const revision = createLocalVaultRevision();
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = revision.subscribe(listener1);
      const unsubscribe2 = revision.subscribe(listener2);

      revision.bump();
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      unsubscribe1();
      revision.bump();

      expect(listener1).toHaveBeenCalledTimes(1); // No new call
      expect(listener2).toHaveBeenCalledTimes(2); // Called again
    });

    it('unsubscribe on listener that has not been called leaves others unaffected', () => {
      const revision = createLocalVaultRevision();
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = revision.subscribe(listener1);
      revision.subscribe(listener2);

      unsubscribe1();
      revision.bump();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });
});
