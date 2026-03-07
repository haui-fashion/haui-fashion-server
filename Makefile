.PHONY: i dev up-debug down-local clean

i:
	pnpm install

dev:
	pnpm start:dev

start:
	pnpm start

up-debug:
	chmod +x ./scripts/setting-debug.sh
	chmod +x ./scripts/compose-local.sh
	./scripts/setting-debug.sh
	./scripts/compose-local.sh

down-local:
	docker compose -f docker-compose.local.yml down

clean:
	rm -rf dist node_modules
