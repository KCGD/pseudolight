OPT="SIMPLE"
JS_OUT="out.js"
JS_IN="main.js"
BUILD_DIR=$(shell pwd)/Builds

default:
	npx tsc

build:
	make clean || true
	make
	npx pkg package.json
	make clean

purge:
	make clean || true
	rm -rv ~/.config/pseudolight

run:
	make clean || true
	make
	@echo "----------START MAIN----------"
	@node main

rb:
	make build
	@echo "----------START MAIN (Built)----------"
	@./Builds/pseudolight

install:
	cp ./Builds/pseudolight /usr/local/bin -v

uninstall:
	rm /usr/local/bin/pseudolight -v

clean:
	find ./src -name "*.js" -type f
	find ./src -name "*.js" -type f -delete
	rm main.js