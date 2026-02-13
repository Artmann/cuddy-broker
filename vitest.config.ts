import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
	test: {
		onConsoleLog() {
			return false
		},
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				isolatedStorage: true,
				singleWorker: true
			}
		}
	}
})
