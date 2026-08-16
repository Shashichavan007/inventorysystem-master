import pytest
import time

def test_rate_limiter_sliding_window_logic():
    # Simple sliding window rate limit counter simulation
    window_sec = 60
    limit = 5
    requests_timestamps = []

    def allow_request(now_ts: float) -> bool:
        nonlocal requests_timestamps
        # Remove old timestamps
        requests_timestamps = [ts for ts in requests_timestamps if now_ts - ts <= window_sec]
        if len(requests_timestamps) < limit:
            requests_timestamps.append(now_ts)
            return True
        return False

    now = time.time()
    for i in range(5):
        assert allow_request(now + i) is True

    # 6th request should be rejected
    assert allow_request(now + 5) is False
