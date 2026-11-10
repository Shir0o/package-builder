.PHONY: verify

verify:
	npx tsc --noEmit
	npm test
