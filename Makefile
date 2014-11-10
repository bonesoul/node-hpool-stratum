MOCHA=./node_modules/.bin/mocha

test:
	$(MOCHA)

test-watch:
	$(MOCHA) \
    --growl \
    --watch

.PHONY: test test-watch
