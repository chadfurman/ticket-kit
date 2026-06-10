---
id: TD-0006
title: Publish ticket-kit as an installable plugin
status: open
priority: P2
rank: 20
area: infra
pillars: [adoption]
blocked-by: []
created: 2026-06-09
---

# TD-0006 · Publish ticket-kit as an installable plugin

## Why

Cloning files is fine, but installing the AI helpers as a plugin (the way
change-factory does) is one step and works from a private repo.

## What

- A `.claude-plugin/marketplace.json` so the repo is a one-line marketplace.
- README steps for the private-repo install path.

## Acceptance

- [ ] `extraKnownMarketplaces` → enable plugin works from the private repo.
- [ ] The `/tickets` command + agents load after install.
