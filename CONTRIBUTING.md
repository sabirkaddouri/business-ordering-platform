# Contributing Guidelines

To keep the project history clean and professional, we use the Conventional Commits format.

## Commit Message Format

When making a commit, start your message with one of the following prefixes:

- **feat:** add new feature (example: `feat: add promo code system`)
- **fix:** fix a bug (example: `fix: city dropdown not rendering on checkout`)
- **style:** visual or CSS changes only (example: `style: update product card hover effect`)
- **refactor:** code improvement with no behavior change (example: `refactor: extract settings fetch into reusable hook`)
- **chore:** maintenance tasks (example: `chore: update dependencies`)
- **docs:** documentation changes (example: `docs: update README with screenshots`)

## Branching Strategy

- **`main` branch:** Always contains the stable working version. Never commit broken code here.
- **`feature/[name]` branches:** Create a new branch for every new feature (e.g., `feature/postgresql-migration` or `feature/whatsapp-automation`).
- **`fix/[name]` branches:** Create a new branch for every bug fix (e.g., `fix/settings-not-saving`).

Merge into `main` only when the feature or fix is confirmed working.
