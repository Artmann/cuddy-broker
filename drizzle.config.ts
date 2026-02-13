import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/broker/schema.ts',
	out: './drizzle',
})
