MOCHA=node_modules/mocha/bin/mocha

test:
	$(MOCHA) \


test-watch:
	$(MOCHA) \
    --growl \
    --watch \
	--recursive

.PHONY: test test-watch
