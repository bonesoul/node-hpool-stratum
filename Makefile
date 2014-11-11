MOCHA=node_modules/mocha/bin/mocha

test:
	$(MOCHA) \
	--recursive

test-watch:
	$(MOCHA) \
    --growl \
    --watch \
	--recursive

.PHONY: test test-watch
