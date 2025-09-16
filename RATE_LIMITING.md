# 🛡️ Gryt Rate Limiting System

Gryt implements a sophisticated score-based rate limiting system that provides intelligent protection against abuse while maintaining a smooth user experience. This system adapts to user behavior and provides clear feedback when limits are reached.

## 🎯 Overview

The rate limiting system uses a **score-based approach** where:
- Each action adds points to a user's score
- Scores automatically decay over time
- When a score exceeds the maximum threshold, rate limiting kicks in
- Users receive clear, actionable feedback about wait times

## 🏗️ Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │    │  Rate Limiter   │    │   Server        │
│                 │    │                 │    │                 │
│ • User Actions  │───►│ • Score Tracking│───►│ • Action        │
│ • Error Display │◄───│ • Decay Logic   │◄───│ • Enforcement   │
│ • Wait Times    │    │ • Thresholds    │    │ • Feedback      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Rate Limiting Flow

1. **Action Request**: User performs an action (chat, reaction, server join)
2. **Score Calculation**: System calculates current score based on recent actions
3. **Threshold Check**: Compare current score against maximum allowed
4. **Decision**: Allow action or apply rate limiting
5. **Feedback**: Send user-friendly message with wait time

## 📊 Score-Based Algorithm

### How Scores Work

```typescript
interface ScoreData {
  score: number;        // Current score (0 to maxScore)
  lastUpdate: number;   // Timestamp of last update
}

// Score calculation with decay
const calculateCurrentScore = (scoreData: ScoreData, rule: RateLimitRule): number => {
  const now = Date.now();
  const timeSinceUpdate = now - scoreData.lastUpdate;
  const decayAmount = Math.floor(timeSinceUpdate / rule.scoreDecayMs);
  
  return Math.max(0, scoreData.score - decayAmount);
};
```

### Score Decay

Scores automatically decrease over time:
- **Decay Rate**: Configurable milliseconds per point
- **Automatic**: Happens on every action check
- **Fair**: Users who wait are rewarded with lower scores

## 🎛️ Rate Limit Rules

### Default Configuration

```typescript
const RATE_LIMITS = {
  CHAT_SEND: { 
    limit: 20,           // Max 20 messages in window
    windowMs: 10_000,    // 10 second window
    banMs: 30_000,       // 30 second ban if exceeded
    scorePerAction: 1,   // +1 point per message
    maxScore: 10,        // Rate limit at 10 points
    scoreDecayMs: 2000   // Lose 1 point every 2 seconds
  },
  
  CHAT_REACT: { 
    limit: 50,           // Max 50 reactions in window
    windowMs: 10_000,    // 10 second window
    banMs: 15_000,       // 15 second ban if exceeded
    scorePerAction: 1,   // +1 point per reaction
    maxScore: 15,        // Rate limit at 15 points
    scoreDecayMs: 1500   // Lose 1 point every 1.5 seconds
  },
  
  SERVER_JOIN: { 
    limit: 5,            // Max 5 joins in window
    windowMs: 60_000,    // 1 minute window
    banMs: 60_000,       // 1 minute ban if exceeded
    scorePerAction: 2,   // +2 points per join
    maxScore: 8,         // Rate limit at 8 points
    scoreDecayMs: 5000   // Lose 1 point every 5 seconds
  }
};
```

### Rule Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `limit` | Maximum events in time window | `20` messages |
| `windowMs` | Time window in milliseconds | `10_000` (10 seconds) |
| `banMs` | Temporary ban duration | `30_000` (30 seconds) |
| `scorePerAction` | Points added per action | `1` point per message |
| `maxScore` | Score threshold for rate limiting | `10` points |
| `scoreDecayMs` | Score decay rate | `2000` (lose 1 point per 2 seconds) |

## 🔧 Configuration

### Environment Variables

Rate limits can be configured via environment variables:

```env
# Format: limit:windowMs:banMs:scorePerAction:maxScore:scoreDecayMs
RATE_LIMIT_CHAT_SEND=20:10000:30000:1:10:2000
RATE_LIMIT_CHAT_REACT=50:10000:15000:1:15:1500
RATE_LIMIT_SERVER_JOIN=5:60000:60000:2:8:5000
```

### Programmatic Configuration

```typescript
// Custom rate limit rule
const customRule: RateLimitRule = {
  limit: 100,
  windowMs: 60_000,
  banMs: 120_000,
  scorePerAction: 1,
  maxScore: 20,
  scoreDecayMs: 3000
};

// Apply to rate limiter
rateLimiter.addRule('CUSTOM_ACTION', customRule);
```

## 📱 Client-Side Integration

### Error Handling

When rate limited, clients receive detailed error information:

```typescript
interface RateLimitError {
  error: 'rate_limited';
  retryAfterMs: number;    // Time until retry allowed
  currentScore: number;    // User's current score
  maxScore: number;        // Maximum allowed score
  message: string;         // User-friendly message
}
```

### Example Client Response

```json
{
  "error": "rate_limited",
  "retryAfterMs": 3000,
  "currentScore": 12,
  "maxScore": 10,
  "message": "You're doing things too quickly. Please wait 3 seconds."
}
```

### Client Implementation

```typescript
// Handle rate limiting errors
socket.on('chat:error', (error: RateLimitError) => {
  if (error.error === 'rate_limited') {
    // Show user-friendly message
    toast.error(error.message);
    
    // Disable input for retry duration
    setInputDisabled(true);
    setTimeout(() => {
      setInputDisabled(false);
    }, error.retryAfterMs);
  }
});
```

## 🎯 Use Cases

### Chat Rate Limiting

**Scenario**: User sends messages too quickly
- **Trigger**: 10+ messages in 10 seconds
- **Response**: "You're doing things too quickly. Please wait 3 seconds."
- **Recovery**: Score decays by 1 point every 2 seconds

### Reaction Spam Prevention

**Scenario**: User reacts to messages excessively
- **Trigger**: 15+ reactions in 10 seconds
- **Response**: "You're reacting too quickly. Please wait 2 seconds."
- **Recovery**: Score decays by 1 point every 1.5 seconds

### Server Join Protection

**Scenario**: User joins/leaves servers rapidly
- **Trigger**: 8+ points (4 joins) in 1 minute
- **Response**: "You're joining servers too quickly. Please wait 5 seconds."
- **Recovery**: Score decays by 1 point every 5 seconds

## 🔍 Monitoring & Analytics

### Metrics Collection

```typescript
// Rate limiting metrics
interface RateLimitMetrics {
  totalRequests: number;
  rateLimitedRequests: number;
  averageScore: number;
  peakScore: number;
  banCount: number;
  recoveryTime: number;
}
```

### Debug Information

```bash
# View current rate limit status
curl http://localhost:5000/debug/rate-limits

# Check specific user's score
curl http://localhost:5000/debug/rate-limits/user123
```

## 🚀 Performance Considerations

### Memory Usage

- **Score Storage**: Minimal memory footprint per user
- **Cleanup**: Automatic cleanup of inactive users
- **Scaling**: O(1) lookup time for score checks

### CPU Impact

- **Score Calculation**: Lightweight arithmetic operations
- **Decay Processing**: Only on active requests
- **Threshold Checks**: Simple comparison operations

## 🛠️ Implementation Details

### Server-Side (Node.js)

```typescript
// Rate limiter implementation
class SlidingWindowLimiter {
  private scores: Map<string, ScoreData> = new Map();
  
  check(parts: RateLimitKeyParts, rule: RateLimitRule): RateLimitResult {
    const key = this.generateKey(parts);
    const scoreData = this.scores.get(key) || { score: 0, lastUpdate: Date.now() };
    
    // Calculate current score with decay
    const currentScore = this.calculateCurrentScore(scoreData, rule);
    
    // Check if rate limited
    if (currentScore >= rule.maxScore) {
      return {
        allowed: false,
        retryAfterMs: rule.scoreDecayMs,
        currentScore,
        maxScore: rule.maxScore,
        message: `You're doing things too quickly. Please wait ${Math.ceil(rule.scoreDecayMs / 1000)} seconds.`
      };
    }
    
    // Update score
    const newScore = currentScore + (rule.scorePerAction || 1);
    this.scores.set(key, { score: newScore, lastUpdate: Date.now() });
    
    return { allowed: true };
  }
}
```

### Client-Side (React)

```typescript
// Rate limiting hook
const useRateLimit = () => {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  
  const handleRateLimitError = useCallback((error: RateLimitError) => {
    setIsRateLimited(true);
    setRetryAfter(error.retryAfterMs);
    
    // Show toast notification
    toast.error(error.message);
    
    // Auto-recover after retry time
    setTimeout(() => {
      setIsRateLimited(false);
      setRetryAfter(0);
    }, error.retryAfterMs);
  }, []);
  
  return { isRateLimited, retryAfter, handleRateLimitError };
};
```

## 🔮 Future Enhancements

### Planned Features

1. **Adaptive Rate Limiting**: Adjust limits based on server load
2. **User Reputation**: Different limits for trusted users
3. **Geographic Rate Limiting**: Different limits by region
4. **Action-Specific Decay**: Different decay rates for different actions
5. **Rate Limit Analytics**: Detailed reporting and insights

### Advanced Configuration

```typescript
// Future: Advanced rate limiting rules
interface AdvancedRateLimitRule extends RateLimitRule {
  adaptiveScaling?: boolean;     // Scale with server load
  userReputation?: boolean;      // Consider user reputation
  geographicLimits?: boolean;    // Different limits by region
  timeBasedLimits?: boolean;     // Different limits by time of day
}
```

## 📚 Best Practices

### For Developers

1. **Clear Error Messages**: Always provide actionable feedback
2. **Reasonable Limits**: Set limits that don't interfere with normal usage
3. **Fast Recovery**: Allow users to recover quickly from rate limits
4. **Monitoring**: Track rate limiting metrics and adjust as needed

### For Users

1. **Read Error Messages**: Pay attention to rate limit notifications
2. **Wait Patiently**: Allow the system time to reset your score
3. **Report Issues**: If rate limits seem too strict, report the issue
4. **Understand Limits**: Learn the system's behavior to avoid rate limits

## 🐛 Troubleshooting

### Common Issues

**Rate limits too strict?**
- Check rule configuration
- Monitor user behavior patterns
- Adjust `maxScore` or `scoreDecayMs`

**Rate limits too lenient?**
- Increase `scorePerAction` values
- Decrease `maxScore` thresholds
- Add temporary bans with `banMs`

**Performance issues?**
- Monitor memory usage
- Check score cleanup logic
- Optimize key generation

### Debug Commands

```bash
# Check rate limit status
curl http://localhost:5000/debug/rate-limits

# Reset user's score (development only)
curl -X POST http://localhost:5000/debug/rate-limits/reset/user123

# View rate limit configuration
curl http://localhost:5000/debug/rate-limits/config
```

---

**The Gryt Rate Limiting System provides intelligent protection while maintaining an excellent user experience. By using score-based limiting with automatic decay, users can recover quickly from rate limits while the system remains protected against abuse.**
