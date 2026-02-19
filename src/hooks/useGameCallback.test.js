import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameCallback } from './useGameCallback';

const PAYLOAD_KEYS = [
  'memberId', 'gameId', 'score', 'maxScore',
  'completed', 'durationSeconds', 'timestamp',
];

describe('useGameCallback', () => {
  let mockFetch;
  let originalPostMessage;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    originalPostMessage = window.parent.postMessage.bind(window.parent);
    vi.spyOn(window.parent, 'postMessage');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const rawResult = { score: 5, maxScore: 8, completed: true, durationSeconds: 45 };

  it('calls onComplete with a correctly shaped payload', async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useGameCallback({ memberId: 'mem001', gameId: 'memory-match', onComplete })
    );

    await act(async () => {
      await result.current.fireComplete(rawResult);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    PAYLOAD_KEYS.forEach((key) => expect(payload).toHaveProperty(key));
    expect(payload.memberId).toBe('mem001');
    expect(payload.gameId).toBe('memory-match');
    expect(payload.score).toBe(5);
    expect(payload.maxScore).toBe(8);
    expect(payload.completed).toBe(true);
    expect(payload.durationSeconds).toBe(45);
    expect(typeof payload.timestamp).toBe('string');
  });

  it('fires window.parent.postMessage with GAME_COMPLETE type', async () => {
    const { result } = renderHook(() =>
      useGameCallback({ memberId: 'mem001', gameId: 'word-recall', onComplete: vi.fn() })
    );

    await act(async () => {
      await result.current.fireComplete(rawResult);
    });

    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GAME_COMPLETE' }),
      '*'
    );
  });

  it('POSTs to callbackUrl when provided', async () => {
    const { result } = renderHook(() =>
      useGameCallback({
        memberId: 'mem001',
        gameId: 'daily-arithmetic',
        callbackUrl: 'https://api.caritahub.com/results',
        onComplete: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.fireComplete(rawResult);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.caritahub.com/results',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    PAYLOAD_KEYS.forEach((key) => expect(body).toHaveProperty(key));
  });

  it('does NOT call fetch when callbackUrl is not provided', async () => {
    const { result } = renderHook(() =>
      useGameCallback({ memberId: 'mem001', gameId: 'word-search', onComplete: vi.fn() })
    );

    await act(async () => {
      await result.current.fireComplete(rawResult);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when callbackUrl returns a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useGameCallback({
        memberId: 'mem001',
        gameId: 'pattern-sequence',
        callbackUrl: 'https://dead-endpoint.example.com',
        onComplete: vi.fn(),
      })
    );

    await expect(
      act(async () => {
        await result.current.fireComplete(rawResult);
      })
    ).resolves.not.toThrow();
  });

  it('still calls onComplete and postMessage even if fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const onComplete = vi.fn();

    const { result } = renderHook(() =>
      useGameCallback({
        memberId: 'mem001',
        gameId: 'memory-match',
        callbackUrl: 'https://dead-endpoint.example.com',
        onComplete,
      })
    );

    await act(async () => {
      await result.current.fireComplete(rawResult);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(window.parent.postMessage).toHaveBeenCalled();
  });
});
