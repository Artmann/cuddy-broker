import { DurableObject } from 'cloudflare:workers'

export class JobBroker extends DurableObject<Env> {}
