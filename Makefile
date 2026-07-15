SHELL := /bin/sh

PACKAGES := schema core playwright preview remotion timeline compiler testing cli
PACK_DIR ?= .artifacts/npm
TAG ?= beta

.PHONY: help check pack publish-dry-run publish clean-packs

help:
	@echo "make check             Run lint, typecheck, tests, and build"
	@echo "make pack              Build and pack all public packages"
	@echo "make publish-dry-run   Simulate publishing every public package"
	@echo "make publish CONFIRM=publish TAG=beta"
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

publish: check
	@test "$(CONFIRM)" = "publish" || (echo "Refusing to publish. Re-run with CONFIRM=publish"; exit 1)
	@set -e; for package in $(PACKAGES); do \
		echo "Publishing @democraft/$$package with tag $(TAG)"; \
		(cd "packages/$$package" && pnpm publish --access public --tag "$(TAG)"); \
	done

clean-packs:
	rm -rf "$(PACK_DIR)"
