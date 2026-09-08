/** Types for the virtual modules emitted by vite/modules-plugin.ts. */
declare module 'virtual:manifest-lite' {
  import type { DomainKey, ContentStatus, Primitive, Level, Tier } from '@content/types'
  export const MODULES: { id: string; domain: DomainKey; title: string; status: ContentStatus; primitive: Primitive; level: Level; tier: Tier }[]
  export const DOMAINS: { key: DomainKey; name: string; tier: Tier }[]
  export const BUILT: number
  export const TOTAL: number
}
declare module 'virtual:manifest-full' {
  import type { CurriculumEntry, DomainMeta } from '@content/types'
  export const FULL: CurriculumEntry[]
  export const DOMAIN_META: DomainMeta[]
}
declare module 'virtual:module-loader' {
  import type { ModuleMeta, Claim, Item, Timeline } from '@content/types'
  import type { ComponentType } from 'react'
  export interface LoadedModule {
    meta: ModuleMeta
    claims: Claim[]
    items: Item[]
    sim: { run: (p?: Record<string, unknown>) => Timeline<unknown>; DEFAULTS: Record<string, unknown> }
    Body: ComponentType
    renderSurface?: (props: Record<string, unknown>) => import('react').ReactNode
  }
  export const BUILT_IDS: string[]
  export function loadModule(id: string): Promise<LoadedModule>
}
declare module 'virtual:search-index' {
  export const DOCS: { i: number; id: string; t: string; d: string; s: string }[]
  export const INDEX: Record<string, number[]>
}
declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const C: ComponentType
  export default C
}
