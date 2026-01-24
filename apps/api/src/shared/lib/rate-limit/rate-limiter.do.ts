/**
 * Rate Limiter Durable Object
 *
 * Token Bucket アルゴリズムによる分散レート制限
 * Alarms API でトークン補充を効率化
 */
import { DurableObject } from "cloudflare:workers"

export type RateLimiterEnv = {
  RATE_LIMITER: DurableObjectNamespace<RateLimiterDO>
}

type CheckRequest = {
  action: "check" | "get"
  limit: number
  windowMs: number
}

type CheckResponse = {
  allowed: boolean
  remaining: number
  resetInSeconds: number
  limit: number
}

type StoredState = {
  tokens: number
  lastRefillAt: number
  limit: number
  windowMs: number
}

export class RateLimiterDO extends DurableObject {
  private state: StoredState | null = null

  constructor(ctx: DurableObjectState, env: RateLimiterEnv) {
    super(ctx, env)
  }

  private async loadState(): Promise<StoredState | null> {
    if (this.state) return this.state
    this.state = await this.ctx.storage.get<StoredState>("state") ?? null
    return this.state
  }

  private async saveState(state: StoredState): Promise<void> {
    this.state = state
    await this.ctx.storage.put("state", state)
  }

  private calculateTokens(
    state: StoredState | null,
    limit: number,
    windowMs: number,
    now: number
  ): { tokens: number; lastRefillAt: number } {
    if (!state) {
      return { tokens: limit, lastRefillAt: now }
    }

    // 設定が変更された場合はリセット
    if (state.limit !== limit || state.windowMs !== windowMs) {
      return { tokens: limit, lastRefillAt: now }
    }

    const elapsed = now - state.lastRefillAt
    const tokensPerMs = limit / windowMs
    const tokensToAdd = elapsed * tokensPerMs

    const newTokens = Math.min(limit, state.tokens + tokensToAdd)
    const newLastRefillAt = tokensToAdd > 0 ? now : state.lastRefillAt

    return { tokens: newTokens, lastRefillAt: newLastRefillAt }
  }

  private async scheduleAlarm(windowMs: number): Promise<void> {
    const currentAlarm = await this.ctx.storage.getAlarm()
    if (currentAlarm === null) {
      // 次のウィンドウでアラームを設定（トークン補充用）
      await this.ctx.storage.setAlarm(Date.now() + windowMs)
    }
  }

  async alarm(): Promise<void> {
    // アラーム時点でstateをクリア（次回アクセス時に再計算される）
    // これによりメモリ効率を向上
    const state = await this.loadState()
    if (state) {
      const now = Date.now()
      const { tokens, lastRefillAt } = this.calculateTokens(
        state,
        state.limit,
        state.windowMs,
        now
      )

      // トークンが満タンでなければ次のアラームをスケジュール
      if (tokens < state.limit) {
        await this.saveState({
          ...state,
          tokens,
          lastRefillAt,
        })
        await this.scheduleAlarm(state.windowMs)
      } else {
        // 満タンなら状態を保存してアラームは設定しない
        await this.saveState({
          ...state,
          tokens: state.limit,
          lastRefillAt: now,
        })
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const body: CheckRequest = await request.json()
      const { action, limit, windowMs } = body

      const now = Date.now()
      const state = await this.loadState()
      const { tokens, lastRefillAt } = this.calculateTokens(state, limit, windowMs, now)

      if (action === "get") {
        // 読み取りのみ（トークン消費なし）
        const response: CheckResponse = {
          allowed: tokens >= 1,
          remaining: Math.max(0, Math.floor(tokens)),
          resetInSeconds: Math.ceil(windowMs / 1000),
          limit,
        }
        return Response.json(response)
      }

      // action === "check": トークン消費
      if (tokens < 1) {
        const tokensPerMs = limit / windowMs
        const resetInMs = Math.ceil((1 - tokens) / tokensPerMs)
        const response: CheckResponse = {
          allowed: false,
          remaining: 0,
          resetInSeconds: Math.ceil(resetInMs / 1000),
          limit,
        }
        return Response.json(response)
      }

      // トークン消費して保存
      await this.saveState({
        tokens: tokens - 1,
        lastRefillAt,
        limit,
        windowMs,
      })

      // アラームをスケジュール
      await this.scheduleAlarm(windowMs)

      const response: CheckResponse = {
        allowed: true,
        remaining: Math.floor(tokens - 1),
        resetInSeconds: Math.ceil(windowMs / 1000),
        limit,
      }
      return Response.json(response)
    } catch (error) {
      console.error("RateLimiterDO error:", error)
      // エラー時は許可（フェイルオープン）
      return Response.json({
        allowed: true,
        remaining: 0,
        resetInSeconds: 60,
        limit: 0,
      } satisfies CheckResponse)
    }
  }
}
