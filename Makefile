SHELL := /bin/bash
NVM_EXEC := source ~/.nvm/nvm.sh 2>/dev/null || true; nvm use && export PATH="$$NVM_BIN:$$(echo $$PATH | sed 's|/home/delirehberi/.npm-global/bin:||g')"

.PHONY: all install dev test test-watch typecheck build deploy clean

all: install build test typecheck

install:
	@$(NVM_EXEC) && npm install

dev:
	@$(NVM_EXEC) && npm run dev

test:
	@$(NVM_EXEC) && npm run test

test-watch:
	@$(NVM_EXEC) && npm run test:watch

typecheck:
	@$(NVM_EXEC) && npm run typecheck

build:
	@$(NVM_EXEC) && npm run build

deploy:
	@$(NVM_EXEC) && npm run deploy

clean:
	@rm -rf node_modules dist
