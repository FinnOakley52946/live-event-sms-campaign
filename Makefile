.PHONY: run
run:
	npm i && npx tsx src/index.ts

.PHONY: check
check:
	@echo "compile-check — see .github/workflows/ci.yml for the full matrix"
