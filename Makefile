# Convenience wrapper: install the tooling and the ETF repos, run the hub locally, update, clean.
# Run `make help`. Variables: REPOS="VanEck,Tema" (spaces and/or commas), PARALLEL=4, DEPTH=1, SSH=1, PORT=1234.

.DEFAULT_GOAL := help
.PHONY: help install update clean start stop ensure-git ensure-bun require-bun

REPOS ?=
PARALLEL ?=
DEPTH ?=
SSH ?=
PORT ?= 1234

# bun installs itself here with the official script; keep it on PATH for every recipe
BUN_BIN := $(HOME)/.bun/bin
export PATH := $(BUN_BIN):$(PATH)
# make execs plain recipe lines without a shell, so resolve bun explicitly (found on PATH, else the official install location)
BUN := $(or $(shell command -v bun 2>/dev/null),$(BUN_BIN)/bun)

help:
	@echo "ETFs hub: install the tooling and the ETF repos, run the hub locally, keep the repos fresh"
	@echo ""
	@echo "Targets"
	@echo "  make install   check git, install bun if it is missing, run bun i -E, clone the ETF repos (all by default)"
	@echo "                 variables: REPOS PARALLEL DEPTH SSH"
	@echo ""
	@echo "  make start     run bunx serve . -p PORT in the background (http://localhost:PORT)"
	@echo "                 variables: PORT"
	@echo ""
	@echo "  make stop      stop the server started by make start"
	@echo ""
	@echo "  make update    fetch and fast-forward main of the cloned repos"
	@echo "                 variables: REPOS PARALLEL"
	@echo ""
	@echo "  make clean     remove the cloned repos (never the ones with unsaved work)"
	@echo "                 variables: REPOS PARALLEL"
	@echo ""
	@echo "Variables"
	@echo "  REPOS=A,B      repos to act on, separated by spaces and/or commas (default: all)"
	@echo "  PARALLEL=N     how many repos are processed at once (default: 1)"
	@echo "  DEPTH=N        shallow clone depth for install (default: full history)"
	@echo "  SSH=1          clone over SSH instead of HTTPS"
	@echo "  PORT=N         port for start (default: 1234)"
	@echo ""
	@echo "Examples"
	@echo "  make install DEPTH=1"
	@echo "  make install REPOS=VanEck,Tema SSH=1"
	@echo "  make start PORT=8080"
	@echo "  make update PARALLEL=4"
	@echo "  make clean REPOS=Tema"

ensure-git:
	@command -v git >/dev/null 2>&1 || { echo "make: git is not installed; install git first (https://git-scm.com/downloads)" >&2; exit 1; }

ensure-bun:
	@if command -v bun >/dev/null 2>&1; then echo "bun $$(bun --version) found"; else \
	  echo "bun not found: installing it with the official script (https://bun.sh/install)"; \
	  command -v curl >/dev/null 2>&1 || { echo "make: curl is required to install bun" >&2; exit 1; }; \
	  curl -fsSL https://bun.sh/install | bash || { echo "make: the bun installation failed" >&2; exit 1; }; \
	  command -v bun >/dev/null 2>&1 || { echo "make: bun was installed into $(BUN_BIN) but is not on PATH" >&2; exit 1; }; \
	  echo "bun $$(bun --version) installed"; fi

require-bun:
	@command -v bun >/dev/null 2>&1 || { echo "make: bun is not installed; run 'make install' first" >&2; exit 1; }

install: ensure-git ensure-bun
	$(BUN) i -E
	./scripts/install.sh $(if $(SSH),--ssh) $(if $(DEPTH),--depth $(DEPTH)) $(if $(PARALLEL),--parallel $(PARALLEL)) $(REPOS)

start: require-bun
	@if [ -f .serve.pid ] && kill -0 "$$(cat .serve.pid)" 2>/dev/null; then \
	  echo "already running (pid $$(cat .serve.pid)): $$(grep -m1 -o 'http://localhost:[0-9]*' .serve.log || echo http://localhost:$(PORT))"; exit 0; fi; \
	nohup bunx serve . -p $(PORT) > .serve.log 2>&1 & echo $$! > .serve.pid; \
	sleep 2; \
	if kill -0 "$$(cat .serve.pid)" 2>/dev/null; then \
	  echo "started (pid $$(cat .serve.pid)): $$(grep -m1 -o 'http://localhost:[0-9]*' .serve.log || echo http://localhost:$(PORT)); log: .serve.log; stop with: make stop"; \
	else echo "make: the server failed to start, see .serve.log" >&2; cat .serve.log >&2; rm -f .serve.pid; exit 1; fi

stop:
	@if [ -f .serve.pid ]; then pid="$$(cat .serve.pid)"; \
	  kill_tree() { for c in $$(pgrep -P "$$1" 2>/dev/null); do kill_tree "$$c"; done; kill "$$1" 2>/dev/null; }; \
	  if kill -0 "$$pid" 2>/dev/null; then kill_tree "$$pid"; echo "stopped (pid $$pid)"; else echo "not running (stale .serve.pid removed)"; fi; \
	  rm -f .serve.pid .serve.log; \
	else echo "not running (no .serve.pid)"; fi

update: ensure-git
	./scripts/update.sh $(if $(PARALLEL),--parallel $(PARALLEL)) $(REPOS)

clean: ensure-git
	./scripts/clean.sh $(if $(PARALLEL),--parallel $(PARALLEL)) $(REPOS)
