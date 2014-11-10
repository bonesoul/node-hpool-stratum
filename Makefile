MOCHA=node_modules/mocha/bin/mocha

test:
	$(MOCHA)

test-watch:
	$(MOCHA) \
    --growl \
    --watch

.PHONY: test test-watch
