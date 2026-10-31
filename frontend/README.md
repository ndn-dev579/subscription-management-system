# Subscription Management System - Frontend

Modern React application built with TypeScript, Vite, and Biome.

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite 8
- **Linter & Formatter**: [Biome](https://biomejs.dev)
- **Path Aliasing**: `@/*` mapped to `./src/*`

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` or `.env.local`:

```bash
cp .env.example .env
```

Configured variables:
- `VITE_API_BASE_URL`: Base URL for the Django backend API (defaults to `http://localhost:8000/api/v1`).

### 3. Start Development Server

```bash
npm run dev
```

## 🧹 Coding Standards & Biome

This project uses [Biome](https://biomejs.dev) for code formatting, linting, and import sorting.

### Available Scripts

| Command                | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run check`        | Runs Biome checks across all files (formatting, linting, and import sorting) |
| `npm run check:fix`    | Runs Biome and automatically applies all safe fixes                          |
| `npm run format`       | Formats code with Biome                                                      |
| `npm run format:check` | Verifies code formatting without modifying files                             |
| `npm run lint`         | Runs the Biome linter                                                        |
| `npm run lint:fix`     | Runs the Biome linter and auto-fixes issues                                  |
| `npm run ci`           | Strict CI check for formatting and linting (used in GitHub Actions)          |
| `npm run build`        | Runs TypeScript compilation (`tsc -b`) and Vite production bundle            |

### Coding Standard Rules

- **Indentation**: 2 spaces
- **Quotes**: Single quotes `'` for JavaScript/TypeScript; double quotes `"` for JSX
- **Semicolons**: Always
- **Trailing Commas**: All
- **Line Width**: 100 characters
- **Import Organization**: Automatic sorting on save and check
- **Accessibility (a11y)**: Built-in checks enabled (descriptive anchor text, proper button roles, SVG alternatives)
- **Null Safety**: Avoid non-null assertions (`!`); use explicit runtime guards

### 💻 Editor Integration (VS Code)

Workspace settings are configured in `.vscode/settings.json` and `.vscode/extensions.json`.

1. Install the official **Biome** extension (`biomejs.biome`).
2. Format on save and organize imports on save are enabled automatically for JS/TS/JSX/TSX/JSON/CSS files.
