SHELL := /bin/sh

PACKAGES := schema core playwright preview remotion timeline compiler testing studio cli
PACK_DIR ?= .artifacts/npm
TAG ?= beta
SELECTED ?=

.PHONY: help check pack publish-dry-run publish release-beta-prepare release-beta-publish require-publish require-selected clean-packs

help:
	@echo "make check             Run lint, typecheck, tests, and build"
	@echo "make pack              Build and pack all public packages"
	@echo "make publish-dry-run   Simulate publishing every public package"
	@echo "make publish CONFIRM=publish TAG=beta"
	@echo "make release-beta-prepare SELECTED=\"studio cli\""
	@echo "make release-beta-publish SELECTED=\"studio cli\" CONFIRM=publish"
	@echo "make clean-packs       Remove local package tarballs"

check:
	pnpm lint
	pnpm typecheck --force
	pnpm exec turbo test --force
	pnpm exec turbo build --force
	git diff --check

pack: clean-packs
	@mkdir -p "$(PACK_DIR)"
	@set -e; for package in $(PACKAGES); do \
		echo "Packing @democraft/$$package"; \
		(cd "packages/$$package" && pnpm pack --pack-destination "$(CURDIR)/$(PACK_DIR)"); \
	done

publish-dry-run: check
	@set -e; for package in $(PACKAGES); do \
		echo "Dry-run @democraft/$$package"; \
		(cd "packages/$$package" && pnpm publish --dry-run --no-git-checks --access public --tag "$(TAG)"); \
	done

require-publish:
	@test "$(CONFIRM)" = "publish" || (echo "Refusing to publish. Re-run with CONFIRM=publish"; exit 1)
	@test -z "$$(git status --porcelain)" || (echo "Refusing to publish with a dirty worktree. Commit the release first."; exit 1)
	@npm whoami >/dev/null

publish: require-publish check
	@set -e; for package in $(PACKAGES); do \
		echo "Publishing @democraft/$$package with tag $(TAG)"; \
		(cd "packages/$$package" && pnpm publish --no-git-checks --access public --tag "$(TAG)"); \
	done

require-selected:
	@test -n "$(SELECTED)" || (echo 'Choose packages in dependency order, for example SELECTED="studio cli"'; exit 1)
	@set -e; for package in $(SELECTED); do \
		test -f "packages/$$package/package.json" || (echo "Unknown package: $$package"; exit 1); \
	done

release-beta-prepare: require-selected
	@test -z "$$(git status --porcelain)" || (echo "Start from a clean worktree."; exit 1)
	@set -e; for package in $(SELECTED); do \
		echo "Bumping @democraft/$$package"; \
		(cd "packages/$$package" && pnpm version prerelease --preid beta --no-git-tag-version); \
	done
	pnpm install
	$(MAKE) publish-dry-run PACKAGES="$(SELECTED)" TAG=beta
	@echo 'Ready to commit: git add packages/*/package.json pnpm-lock.yaml && git commit -m "chore: release packages"'

release-beta-publish: require-selected
	$(MAKE) publish PACKAGES="$(SELECTED)" TAG=beta CONFIRM="$(CONFIRM)"

clean-packs:
	rm -rf "$(PACK_DIR)"
