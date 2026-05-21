# Contributing to Ontology Architect

Thank you for your interest in contributing to Ontology Architect! This guide will help you get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Backend Setup](#backend-setup)
- [Code Quality](#code-quality)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Internationalization (i18n)](#internationalization-i18n)
- [Commit Format](#commit-format)

## Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd openFDE

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at http://localhost:3000.

## Backend Setup

The backend is an independent Node.js application using Fastify, Prisma, and PostgreSQL.

```bash
# From the project root
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations (requires PostgreSQL)
npx prisma migrate dev

# Start the backend dev server
npm run dev
```

## Code Quality

Before submitting any changes, run the full quality gate:

```bash
npm run check
```

This command runs the following checks in sequence:

1. **Cardinality tests** -- unit tests for link normalization
2. **TypeScript compilation** -- `tsc --noEmit` (must be run from the repo root)
3. **Production build** -- `vite build`
4. **i18n completeness check** -- verifies all locale files are in sync

All checks must pass before a pull request can be merged.

## Pull Request Guidelines

1. **Branch from `main`** -- create a feature or fix branch from the latest `main`.
2. **One logical change per commit** -- do not mix unrelated changes in a single commit.
3. **Write descriptive commit messages** -- follow the format specified in [GIT_CONVENTION.md](./GIT_CONVENTION.md).
4. **Run `npm run check`** before pushing -- all tests, type checks, and builds must pass.
5. **Update documentation** -- if your change affects features, architecture, or workflow, update `README.md`, `CLAUDE.md`, and/or `CHANGELOG.md` in the same commit or a follow-up commit before push.
6. **No hardcoded secrets** -- never commit API keys, passwords, or credentials. Verify with `git diff --cached` before committing.

## Internationalization (i18n)

Ontology Architect supports 6 languages: English, Chinese, French, Spanish, Arabic, and Japanese.

All user-facing strings must be added to **all 6 locale files**:

```
locales/
├── en/    # English
├── cn/    # Chinese
├── fr/    # French
├── es/    # Spanish
├── ar/    # Arabic
└── ja/    # Japanese
```

Each locale directory contains 10 namespace JSON files. When adding or modifying UI text:

1. Add the key and English value to the appropriate namespace file in `locales/en/`.
2. Add corresponding translations to all other 5 locale directories.
3. Use the `useAppTranslation(ns)` hook in components, with `t()` for UI text and `lt()` for data-layer objects.
4. Run `npm run check` to verify i18n completeness.

## Commit Format

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) format as specified in [GIT_CONVENTION.md](./GIT_CONVENTION.md):

```
<type>(<scope>): <subject>
```

Examples:

```
feat(actions): add three-layer action validation
fix(i18n): correct missing French translation keys
docs(readme): update project structure tree
refactor(ai): extract shared JSON parsing to jsonUtils
```

See [GIT_CONVENTION.md](./GIT_CONVENTION.md) for the full list of types, scopes, and detailed guidelines.
