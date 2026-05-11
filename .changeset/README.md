# Changesets

This directory holds changeset files used by [Changesets](https://github.com/changesets/changesets)
to manage versioning and changelogs across the monorepo.

## Creating a changeset

```bash
yarn changeset
```

This launches an interactive prompt asking which packages changed and the bump type
(`major` / `minor` / `patch`).

## Releasing

```bash
yarn changeset version    # consumes all *.md files in this dir, bumps versions, writes CHANGELOGs
yarn changeset publish    # publishes to npm and tags the release
```

The Release Please / publish flow is automated via GitHub Actions on the `main` branch.
