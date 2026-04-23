# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo React Native mobile app (Local Social)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Mobile App: Local Social (`artifacts/mobile`)

A local social media platform built with Expo Router.

### Screens
- **Onboarding** (`app/(onboarding)/index.tsx`) — Welcome screen with feature highlights and CTA
- **Auth** (`app/(auth)/login.tsx`, `app/(auth)/register.tsx`) — Login and registration modals
- **Home Feed** (`app/(tabs)/index.tsx`) — FlatList of PostCards with pull-to-refresh
- **Explore** (`app/(tabs)/search.tsx`) — Search posts, filter by neighborhood
- **Profile** (`app/(tabs)/profile.tsx`) — Current user's posts and stats
- **Post Detail** (`app/post/[id].tsx`) — Full post with comments thread
- **User Profile** (`app/user/[id].tsx`) — Other user's posts and profile
- **Create Post** (`app/create-post.tsx`) — Compose new post with location

### Navigation
- Bottom tabs: Home, Explore, Profile (NativeTabs with liquid glass on iOS 26+)
- Stack navigation for detail screens
- Modal presentation for auth and create-post flows

### State Management
- `context/AppContext.tsx` — Central state for posts, comments, users, likes
- AsyncStorage for persistence
- Placeholder/seed data pre-loaded

### Data Structure
- **Users**: id, name, username, avatar, bio, location, follower/following/post counts
- **Posts**: id, userId, user, content, imageUrl, location, likes, comments, liked
- **Comments**: id, postId, userId, user, content, createdAt

### Design
- Clean iOS look, white background, black text
- Colors: Deep navy (`#1A1A2E`), coral accent (`#FF6B6B`), teal accent (`#4ECDC4`)
- Font: Inter (400, 500, 600, 700)
- Soft rounded cards, subtle gray separators

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
