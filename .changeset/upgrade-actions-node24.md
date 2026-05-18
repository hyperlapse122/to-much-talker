---
'@to-much-talker/server': patch
'@to-much-talker/playground': patch
'@to-much-talker/docs': patch
'@to-much-talker/shared': patch
'@to-much-talker/config': patch
'@to-much-talker/crypto': patch
'@to-much-talker/db': patch
'@to-much-talker/ai': patch
'@to-much-talker/i18n': patch
'@to-much-talker/settings-core': patch
'@to-much-talker/test-utils': patch
---

CI infrastructure: upgrade all GitHub Actions to their latest majors and align every workflow on the Node 24 runtime.

### CI / release pipeline

- `actions/checkout` → `v6`, `actions/setup-node` → `v6`, `actions/cache` → `v5`,
  `actions/upload-artifact` / `actions/download-artifact` → `v6`,
  `actions/configure-pages` → `v6`, `actions/deploy-pages` → `v5`,
  `actions/upload-pages-artifact` → `v4`,
  `docker/setup-buildx-action` → `v4`, `docker/login-action` → `v4`,
  `docker/metadata-action` → `v6`, `docker/build-push-action` → `v7`,
  `microsoft/playwright-github-action` → `v2`.
- All `setup-node` steps pinned to `node-version: '24'` across `ci.yml`,
  `docker.yml`, `docs-pages.yml`, `e2e.yml`, and `release.yml`.

No runtime behavior changes; published artifacts are byte-equivalent.

### Repo policy

- `AGENTS.md` documents that `release.yml` owns versioning, tagging, the GitHub
  Release, and Docker dispatch. Agents add changesets only; they must not run
  `changeset version`/`publish`, create `v*` tags, or hand-edit generated
  `package.json` / `CHANGELOG.md`.
