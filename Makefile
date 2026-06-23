# AI Coffee — slide deck tooling
#
# Decks are static HTML files that load ../deck-stage.js via a relative path,
# so they must be served over HTTP (opening them as file:// breaks the import).
# These targets spin up a local server rooted at decks/ and open the chosen
# deck in the browser.

# Latest episode folder under decks/ (e.g. 02-hermes-ai), used as the default.
DECK ?= $(notdir $(lastword $(sort $(wildcard decks/[0-9]*-*))))
PORT ?= 8000

# Cross-platform "open a URL in the default browser".
OPEN := $(if $(filter Darwin,$(shell uname)),open,xdg-open)

URL := http://localhost:$(PORT)/$(DECK)/deck.html

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

slides: ## Serve decks/ and open DECK (default: latest) in the browser
	@test -f "decks/$(DECK)/deck.html" \
		|| { echo "No deck at decks/$(DECK)/deck.html — run 'make list'." >&2; exit 1; }
	@echo "Serving decks/ on http://localhost:$(PORT) (Ctrl-C to stop)"
	@echo "Opening $(URL)"
	@( sleep 1 && $(OPEN) "$(URL)" >/dev/null 2>&1 & )
	@cd decks && python3 -m http.server $(PORT)
