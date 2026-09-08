import { create } from 'zustand'
import { prefs } from '@/data/repo'

/**
 * ADR-2: one store, sliced. Slices call the repository; they never touch `idb`.
 * Durable state lives in IndexedDB — this holds what the UI needs synchronously.
 */
interface AppState {
  theme: 'light' | 'dark' | null
  streak: number
  lastReviewDay: string | null
  hydrated: boolean
  hydrate(): Promise<void>
  setTheme(t: 'light' | 'dark'): Promise<void>
  /** A day is maintained if >= 1 due card was graded, OR nothing was due. */
  touchStreak(day: string): Promise<void>
}

const dayBefore = (d: string) => {
  const t = new Date(d + 'T00:00:00Z').getTime() - 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

export const useApp = create<AppState>((set, get) => ({
  theme: null, streak: 0, lastReviewDay: null, hydrated: false,

  async hydrate() {
    const [theme, streak, lastReviewDay] = await Promise.all([
      prefs.get<'light' | 'dark' | null>('theme', null),
      prefs.get('streak', 0),
      prefs.get<string | null>('lastReviewDay', null),
    ])
    set({ theme, streak, lastReviewDay, hydrated: true })
  },

  async setTheme(t) {
    document.documentElement.dataset.theme = t
    try { localStorage.setItem('fesd:theme', t) } catch { /* private mode */ }
    set({ theme: t })
    await prefs.set('theme', t)
  },

  async touchStreak(day) {
    const { lastReviewDay, streak } = get()
    if (lastReviewDay === day) return
    const next = lastReviewDay === dayBefore(day) ? streak + 1 : 1
    set({ streak: next, lastReviewDay: day })
    await Promise.all([prefs.set('streak', next), prefs.set('lastReviewDay', day)])
  },
}))
