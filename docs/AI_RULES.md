# Wanasatna — AI Development Rules

Permanent rulebook for AI agents working on this project.  
Read this document **before every task**. These rules override stylistic preferences unless the user explicitly overrides them.

---

## Project Philosophy

- Always preserve project quality over speed.
- Never rewrite working systems unless explicitly requested.
- Prefer small, isolated changes.
- Respect the existing architecture.
- Avoid unnecessary complexity.

---

## Task Scope

When given a task:

- Do **only** what was requested.
- Never redesign unrelated UI.
- Never refactor unrelated files.
- Never “improve” code outside the requested scope.
- Never introduce architectural changes unless explicitly requested.

If something should be improved but was **not** requested:

**Do not implement it.**

Instead, mention it at the end under **Potential future improvements**.

---

## Token Efficiency

Always minimize token usage.

**Avoid:**

- Long explanations
- Repeated context
- Repeating previous work
- Regenerating entire files
- Rewriting large components for tiny changes

**Prefer:**

- Minimal edits
- Reuse existing code
- Reuse components
- Reuse hooks
- Reuse utilities

Never duplicate logic.

---

## Component Reuse

Before creating a component, hook, utility, helper, or constant:

1. Search the project first.
2. Reuse existing implementations whenever possible.
3. Never create duplicates.

---

## File Modifications

- Modify the **minimum** number of files.
- Never move files unless requested.
- Never rename files unless requested.
- Never delete files unless requested.

---

## Backend Safety

### Frontend tasks

Never modify unless explicitly requested:

- Prisma
- Socket.IO
- Server
- Database
- API
- Game logic

### Backend tasks

Never modify frontend UI unless requested.

---

## Design Consistency

Follow the existing design system.

- Do not invent new colors.
- Do not invent new spacing.
- Do not invent new typography.

Reuse existing:

- Buttons
- Cards
- Inputs
- Dialogs
- Badges

---

## Responsive Design

Every UI change must work on:

- Desktop
- Tablet
- Mobile

Requirements:

- No horizontal overflow
- Large touch targets

---

## Arabic Support

- Arabic is the primary language.
- Always support RTL.
- Never mix Arabic and English unless required (e.g. technical identifiers, package names).

**Brand name (user-facing Arabic):** always write **`وناستنا`**

Do not change technical identifiers such as `Wanasatna`, `@wanasatna/*`, route paths, or game IDs unless explicitly requested.

---

## Error Handling

- Never expose internal errors to users.
- Always display friendly Arabic messages.
- Reset loading states correctly.
- Never leave infinite loading.

---

## Performance

- Prefer simple solutions.
- Avoid unnecessary rerenders.
- Avoid unnecessary state.
- Avoid unnecessary effects.
- Avoid unnecessary dependencies.

---

## Accessibility

Maintain:

- Keyboard navigation
- Focus states
- Semantic HTML
- ARIA labels where needed

---

## Code Style

- Prefer readable code over clever code.
- Prefer explicit naming.
- Keep functions short.
- Keep components focused.

---

## Game Rule

- Game logic must remain independent.
- **Room Chat** must never become game communication.
- Plugins must remain isolated.
- **Game Shell** must remain generic.

---

## Workflow

Before starting **any** task:

1. Read this document.
2. Read only the files required for the task.
3. Avoid scanning the whole project.
4. Identify the smallest possible implementation.
5. Implement only the requested scope.
6. Verify the result.
7. Stop.

---

## Output Format

At the end of every **implementation** task, respond **only** with:

1. Root cause (if applicable)
2. Files created
3. Files modified
4. Components reused
5. Functional changes
6. Verification performed
7. Potential future improvements

---

## Final Rule

Before every future task:

1. Read this document first.
2. Always follow it.
3. Never ignore these rules.

This document has **higher priority** than stylistic preferences unless the user explicitly overrides it.
