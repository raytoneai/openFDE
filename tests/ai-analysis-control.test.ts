import { describe, expect, it } from 'vitest';
import { validateReadiness } from '../services/ai/analysis';
import type { AIService } from '../services/aiService';

function makeFailingService(error: Error): AIService {
  return {
    callForJSON: async () => {
      throw error;
    },
  } as unknown as AIService;
}

describe('AI analysis control errors', () => {
  it('does not swallow cancellation while validating readiness', async () => {
    const error = new DOMException('Cancelled', 'AbortError');

    await expect(validateReadiness(makeFailingService(error), [
      { role: 'user', content: '订单审批系统' },
    ])).rejects.toThrow('Cancelled');
  });

  it('does not turn readiness timeouts into a heuristic success', async () => {
    const error = new Error('AI request timed out after 120 seconds');

    await expect(validateReadiness(makeFailingService(error), [
      { role: 'user', content: '我们有订单、客户、审批、发货，需要建模。'.repeat(20) },
      { role: 'assistant', content: '明白。' },
      { role: 'user', content: '还要付款确认和库存扣减。' },
    ])).rejects.toThrow('timed out');
  });
});
