import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with the given seconds', () => {
    const { result } = renderHook(() =>
      useCountdown({ seconds: 10, active: true, onExpire: vi.fn() })
    );
    expect(result.current.secondsLeft).toBe(10);
  });

  it('counts down each second when active', () => {
    const { result } = renderHook(() =>
      useCountdown({ seconds: 5, active: true, onExpire: vi.fn() })
    );

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(4);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(3);
  });

  it('calls onExpire exactly once when reaching 0', () => {
    const onExpire = vi.fn();
    renderHook(() => useCountdown({ seconds: 2, active: true, onExpire }));

    act(() => vi.advanceTimersByTime(3000));

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stops at 0 and does not go negative', () => {
    const { result } = renderHook(() =>
      useCountdown({ seconds: 2, active: true, onExpire: vi.fn() })
    );

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.secondsLeft).toBe(0);
  });

  it('does not count when active is false', () => {
    const { result } = renderHook(() =>
      useCountdown({ seconds: 10, active: false, onExpire: vi.fn() })
    );

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.secondsLeft).toBe(10);
  });

  it('returns null when seconds is null', () => {
    const { result } = renderHook(() =>
      useCountdown({ seconds: null, active: true, onExpire: vi.fn() })
    );
    expect(result.current.secondsLeft).toBeNull();
  });
});
