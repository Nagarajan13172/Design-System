import { useEffect, useRef } from 'react'

/**
 * Moves focus when a card replaces the one before it.
 *
 * `autoFocus` is banned (jsx-a11y) because it fires on mount regardless of context.
 * A deliberate, keyed focus move is different: the viewport content has changed, the
 * learner is mid-keyboard-flow, and leaving focus on the body would strand them.
 */
export function useAutoFocus<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => { ref.current?.focus() }, [key])
  return ref
}
