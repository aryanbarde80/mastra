import { describe, expect, it, vi } from 'vitest';
import { resolveInstructions } from './utils';

describe('workspace/utils', () => {
  describe('resolveInstructions', () => {
    const defaultInstructions = 'default instructions';
    const getDefault = () => defaultInstructions;

    it('should return default instructions when override is undefined', () => {
      const result = resolveInstructions(undefined, getDefault);
      expect(result).toBe(defaultInstructions);
    });

    it('should return override string when override is a string', () => {
      const override = 'override instructions';
      const result = resolveInstructions(override, getDefault);
      expect(result).toBe(override);
    });

    it('should call function with default instructions and context when override is a function', () => {
      const requestContext = { some: 'context' } as any;
      const override = vi.fn(({ defaultInstructions }) => `modified ${defaultInstructions}`);

      const result = resolveInstructions(override, getDefault, requestContext);

      expect(result).toBe('modified default instructions');
      expect(override).toHaveBeenCalledWith({
        defaultInstructions,
        requestContext,
      });
    });

    it('should handle function override returning empty string', () => {
      const override = () => '';
      const result = resolveInstructions(override, getDefault);
      expect(result).toBe('');
    });
  });
});
