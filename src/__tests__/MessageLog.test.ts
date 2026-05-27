import { describe, it, expect } from 'vitest';
import { MessageLog } from '../ui/MessageLog';

describe('MessageLog', () => {
  describe('add', () => {
    it('adds short messages as single entry', () => {
      const log = new MessageLog();
      log.add('hello');
      expect(log.messages.length).toBe(1);
      expect(log.messages[0]).toBe('hello');
    });

    it('splits long messages at word boundaries', () => {
      const log = new MessageLog();
      const long = 'a '.repeat(60) + 'b';
      log.add(long);
      expect(log.messages.length).toBeGreaterThan(1);
      for (const line of log.messages) {
        expect(line.length).toBeLessThanOrEqual(55);
      }
    });

    it('does not split messages within 55 chars', () => {
      const log = new MessageLog();
      const msg = 'a'.repeat(55);
      log.add(msg);
      expect(log.messages.length).toBe(1);
      expect(log.messages[0].length).toBe(55);
    });

    it('trims excess messages beyond 100', () => {
      const log = new MessageLog();
      for (let i = 0; i < 150; i++) {
        log.add(`msg${i}`);
      }
      expect(log.messages.length).toBe(100);
      expect(log.messages[0]).toBe('msg50');
    });
  });

  describe('getLast', () => {
    it('returns last n messages', () => {
      const log = new MessageLog();
      log.add('a');
      log.add('b');
      log.add('c');
      const last = log.getLast(2);
      expect(last).toEqual(['b', 'c']);
    });

    it('returns all messages when n exceeds total', () => {
      const log = new MessageLog();
      log.add('a');
      log.add('b');
      const last = log.getLast(10);
      expect(last).toEqual(['a', 'b']);
    });
  });

  describe('clear', () => {
    it('empties the log', () => {
      const log = new MessageLog();
      log.add('hello');
      log.clear();
      expect(log.messages.length).toBe(0);
    });
  });
});
