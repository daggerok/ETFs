# Convenience wrapper around scripts/install.sh, scripts/update.sh and scripts/clean.sh.
# Run `make help`. Variables: REPOS="VanEck,Tema" (spaces and/or commas), PARALLEL=4, DEPTH=1, SSH=1.

.DEFAULT_GOAL := help
.PHONY: help install update clean

REPOS ?=
PARALLEL ?=
DEPTH ?=
SSH ?=

help:
	@echo "make install [REPOS=A,B] [PARALLEL=N] [DEPTH=N] [SSH=1]   clone the ETF repos (all by default)"
	@echo "make update  [REPOS=A,B] [PARALLEL=N]                      fetch and fast-forward main of the cloned repos"
	@echo "make clean   [REPOS=A,B] [PARALLEL=N]                      remove the cloned repos (never ones with unsaved work)"
	@echo "Examples: make install DEPTH=1 | make install REPOS=VanEck,Tema SSH=1 | make update PARALLEL=4 | make clean REPOS=Tema"

install:
	./scripts/install.sh $(if $(SSH),--ssh) $(if $(DEPTH),--depth $(DEPTH)) $(if $(PARALLEL),--parallel $(PARALLEL)) $(REPOS)

update:
	./scripts/update.sh $(if $(PARALLEL),--parallel $(PARALLEL)) $(REPOS)

clean:
	./scripts/clean.sh $(if $(PARALLEL),--parallel $(PARALLEL)) $(REPOS)
