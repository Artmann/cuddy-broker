import { Context } from 'hono'
import z from 'zod'

const CreateJobSchema = z.object({
	payload: z.record(z.string(), z.unknown()).optional().default({}),
	queue: z.string().optional().default('default'),
	type: z.string().min(1).max(255)
})

type CreateJobPayload = z.infer<typeof CreateJobSchema>

export async function createJobRoute(c: Context<{ Bindings: Env }>) {
	return c.json({ foo: 'bar' })
}
