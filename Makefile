# AI Coffee — slide deck tooling
#
# Decks are static HTML files that load assets via relative paths
# (../deck-stage.js and ../../media/...), so they must be served over HTTP
# (opening them as file:// breaks the import) AND rooted at the repo root, so
# ../../media resolves to the shared media/ folder. These targets spin up a
# local server at the repo root and open the chosen deck in the browser.

# Latest episode folder under decks/ (e.g. 02-hermes-ai), used as the default.
DECK ?= $(notdir $(lastword $(sort $(wildcard decks/[0-9]*-*))))
PORT ?= 8000

# "Open a URL in the default browser", working on Linux and WSL alike.
# Under WSL, wslview (from the wslu package) opens the Windows browser;
# xdg-open is the plain-Linux fallback, open is for macOS.
OPEN := $(if $(filter Darwin,$(shell uname)),open,$(if $(shell command -v wslview),wslview,xdg-open))

URL := http://localhost:$(PORT)/decks/$(DECK)/deck.html

.DEFAULT_GOAL := help

.PHONY: help slides list

help: ## Show this help
	@echo "AI Coffee deck targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Variables: DECK=$(DECK) PORT=$(PORT)"
	@echo "Example:   make slides DECK=01-agentic-ai PORT=9000"

list: ## List available decks
	@ls -d decks/[0-9]*-*/ 2>/dev/null | sed 's:decks/::;s:/$$::' | sed 's/^/  /'

slides: ## Serve the repo and open DECK (default: latest) in the browser
	@test -f "decks/$(DECK)/deck.html" \
		|| { echo "No deck at decks/$(DECK)/deck.html — run 'make list'." >&2; exit 1; }
	@echo "Serving repo root on http://localhost:$(PORT) (Ctrl-C to stop)"
	@echo "Opening $(URL)"
	@( sleep 1 && $(OPEN) "$(URL)" >/dev/null 2>&1 & )
	@python3 -m http.server $(PORT)
