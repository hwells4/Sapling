---
name: react-best-practices
description: Vercel Engineering's React and Next.js performance optimization guide with 40+ rules across 8 categories. Use when writing React components, implementing data fetching, reviewing frontend code, optimizing bundle size, or refactoring Next.js applications.
---

# React Best Practices

Comprehensive performance optimization guide for React and Next.js applications from Vercel Engineering. Contains 40+ rules across 8 categories, prioritized by impact.

<auto_trigger>
Human phrases that should activate this skill:
- "build a component", "create a component", "new component"
- "add a page", "create a page", "new page"
- "build the UI", "create the UI", "implement the frontend"
- "why is it slow", "it's loading slow", "page is slow"
- "make it faster", "speed this up", "optimize this"
- "fetch the data", "load the data", "get the data"
- "add a form", "create a form", "build a form"
- "add a button", "handle the click"
- "review this code" (when .tsx/.jsx files involved)

File path triggers:
- src/components/, app/, pages/
- .tsx, .jsx, .ts files in frontend directories

Keep for explicit mentions:
- "react", "nextjs", "next.js", "react best practices"
</auto_trigger>

## Quick Reference

| Priority | Category | Key Rules |
|----------|----------|-----------|
| CRITICAL | Waterfalls | `Promise.all()`, defer await, Suspense boundaries |
| CRITICAL | Bundle Size | Direct imports, dynamic imports, defer third-party |
| HIGH | Server-Side | Auth in Server Actions, `React.cache()`, parallel RSC |
| MEDIUM-HIGH | Client Data | SWR deduplication, passive event listeners |
| MEDIUM | Re-renders | Functional setState, lazy init, transitions |
| MEDIUM | Rendering | `content-visibility`, hydration fixes |
| LOW-MEDIUM | JavaScript | Index maps, cache storage, `toSorted()` |
| LOW | Advanced | `useEffectEvent`, `useLatest` |

## CRITICAL: Eliminating Waterfalls

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### Use Promise.all() for Independent Operations

```typescript
// BAD: Sequential execution, 3 round trips
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// GOOD: Parallel execution, 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### Defer Await Until Needed

Move `await` into branches where actually used:

```typescript
// BAD: Blocks both branches
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  if (skipProcessing) return { skipped: true }
  return processUserData(userData)
}

// GOOD: Only blocks when needed
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) return { skipped: true }
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### Strategic Suspense Boundaries

Show layout immediately while data streams in:

```tsx
// BAD: Entire page blocked by data fetch
async function Page() {
  const data = await fetchData()
  return (
    <div>
      <Header />
      <DataDisplay data={data} />
      <Footer />
    </div>
  )
}

// GOOD: Layout renders immediately, data streams in
function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
      <Footer />
    </div>
  )
}

async function DataDisplay() {
  const data = await fetchData()
  return <div>{data.content}</div>
}
```

## CRITICAL: Bundle Size Optimization

### Avoid Barrel File Imports

Barrel files can add 200-800ms to import time and 40% slower cold starts.

```typescript
// BAD: Loads 1,583 modules
import { Check, X, Menu } from 'lucide-react'

// GOOD: Loads only 3 modules
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'

// ALTERNATIVE: Use Next.js optimization
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@mui/material']
  }
}
```

Affected libraries: `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@radix-ui/react-*`, `lodash`, `date-fns`.

### Dynamic Imports for Heavy Components

```tsx
// BAD: Monaco bundles with main chunk (~300KB)
import { MonacoEditor } from './monaco-editor'

// GOOD: Monaco loads on demand
import dynamic from 'next/dynamic'
const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false }
)
```

### Preload on User Intent

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('./monaco-editor')
    }
  }

  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  )
}
```

## HIGH: Server-Side Performance

### Authenticate Server Actions Like API Routes

Server Actions are exposed as public POST endpoints.

```typescript
// BAD: No auth check
'use server'
export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } })
}

// GOOD: Auth inside the action
'use server'
import { verifySession } from '@/lib/auth'

export async function deleteUser(userId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Unauthorized')
  if (session.user.role !== 'admin' && session.user.id !== userId) {
    throw new Error('Forbidden')
  }
  await db.user.delete({ where: { id: userId } })
}
```

### Per-Request Deduplication with React.cache()

```typescript
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  return await db.user.findUnique({
    where: { id: session.user.id }
  })
})
```

**Note:** Avoid inline objects as arguments - `React.cache()` uses shallow equality.

### Minimize Serialization at RSC Boundaries

```tsx
// BAD: Serializes all 50 fields
async function Page() {
  const user = await fetchUser()
  return <Profile user={user} />
}

// GOOD: Serializes only 1 field
async function Page() {
  const user = await fetchUser()
  return <Profile name={user.name} />
}
```

### Use after() for Non-Blocking Operations

```tsx
import { after } from 'next/server'

export async function POST(request: Request) {
  await updateDatabase(request)

  // Log after response is sent
  after(async () => {
    logUserAction({ userAgent: request.headers.get('user-agent') })
  })

  return Response.json({ status: 'success' })
}
```

## MEDIUM: Re-render Optimization

### Use Functional setState Updates

Prevents stale closures and creates stable callback references:

```tsx
// BAD: Requires state as dependency, risk of stale closure
const addItems = useCallback((newItems: Item[]) => {
  setItems([...items, ...newItems])
}, [items])

// GOOD: Stable callback, no stale closures
const addItems = useCallback((newItems: Item[]) => {
  setItems(curr => [...curr, ...newItems])
}, [])
```

### Use Lazy State Initialization

```tsx
// BAD: Runs on every render
const [settings, setSettings] = useState(
  JSON.parse(localStorage.getItem('settings') || '{}')
)

// GOOD: Runs only on initial render
const [settings, setSettings] = useState(() => {
  const stored = localStorage.getItem('settings')
  return stored ? JSON.parse(stored) : {}
})
```

### Use Transitions for Non-Urgent Updates

```tsx
import { startTransition } from 'react'

useEffect(() => {
  const handler = () => {
    startTransition(() => setScrollY(window.scrollY))
  }
  window.addEventListener('scroll', handler, { passive: true })
  return () => window.removeEventListener('scroll', handler)
}, [])
```

## MEDIUM: Rendering Performance

### Prevent Hydration Mismatch Without Flickering

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme-wrapper">{children}</div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'light';
                document.getElementById('theme-wrapper').className = theme;
              } catch (e) {}
            })();
          `,
        }}
      />
    </>
  )
}
```

### CSS content-visibility for Long Lists

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

For 1000 items, browser skips layout/paint for ~990 off-screen items.

### Use toSorted() for Immutability

```typescript
// BAD: Mutates original array (breaks React state)
const sorted = users.sort((a, b) => a.name.localeCompare(b.name))

// GOOD: Creates new array
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name))
```

## Success Criteria

When reviewing React/Next.js code, verify:

- [ ] No sequential awaits that could be parallelized
- [ ] No barrel imports from large packages (or using optimizePackageImports)
- [ ] Server Actions have explicit auth checks inside the function
- [ ] Dynamic content wrapped in Suspense for streaming
- [ ] Heavy components use dynamic imports
- [ ] State updates use functional form when depending on current state
- [ ] No hydration mismatches causing visual flicker

## Detailed Rules Reference

For complete rules with all code examples, see [AGENTS.md](./AGENTS.md).

## References

- [Vercel React Best Practices (GitHub)](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)
- [Next.js Performance Docs](https://nextjs.org/docs/app/building-your-application/optimizing)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [How Vercel made the dashboard twice as fast](https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast)
- [How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
