# Contributing to sub2api-mobile

Thanks for your interest in contributing.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:

   ```bash
   npm ci
   ```

3. Start the app:

   ```bash
   npm run start
   ```

4. For web + admin proxy testing:

   ```bash
   npm run web
   ```

   Enter the real upstream URL and Admin Key in the login screen. The local development proxy starts automatically.

## Branching and Commits

- Create a feature branch from `main`.
- Keep commits focused and atomic.
- Prefer Conventional Commit prefixes when possible (`feat:`, `fix:`, `docs:`, `chore:`).

## Pull Request Guidelines

Before opening a PR:

- Ensure the app builds and starts.
- Confirm no secrets are committed.
- Update documentation when behavior or setup changes.
- Keep screenshots up to date for visible UI changes.

In your PR description, include:

- What changed
- Why it changed
- Any risk/impact notes
- Verification evidence (commands + results)

## Coding Guidelines

- Follow existing project patterns and naming conventions.
- Keep changes minimal and avoid unrelated refactors.
- Prefer clear, maintainable code over clever shortcuts.

## Reporting Issues

- Use GitHub Issues with reproduction steps.
- Include platform details (`ios` / `android` / `web`) and environment info.

## Community

By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).
