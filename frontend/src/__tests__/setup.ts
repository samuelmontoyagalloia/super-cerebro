import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// ── localStorage ────────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  // Reset location so Google redirect tests don't pollute biometric tests
  window.location.href = ''
  window.location.search = ''
})

// ── window.matchMedia (jsdom doesn't implement it) ───────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,          // default: desktop
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ── window.location (allow href assignment) ──────────────────────────────────
Object.defineProperty(window, 'location', {
  configurable: true,
  writable: true,
  value: { href: '', search: '', assign: vi.fn(), replace: vi.fn() },
})
