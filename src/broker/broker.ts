import { DurableObject } from 'cloudflare:workers'

interface Job {
	createdAt: number
	id: string
	payload: Record<string, unknown>
	status: 'pending' | 'in-progress' | 'completed' | 'failed'
	type: string
}
export class JobBroker extends DurableObject<Env> {
	private readonly jobs: Job[] = []

	async createJob(
		type: string,
		payload: Record<string, unknown>
	): Promise<Job> {
		const id = crypto.randomUUID()
		const createdAt = Date.now()
		const status = 'pending'

		this.jobs.push({ id, type, payload, createdAt, status })

		return { id, type, payload, createdAt, status }
	}

	async listJobs(): Promise<Job[]> {
		return this.jobs
	}
}
