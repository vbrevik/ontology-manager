
export interface ApiKey {
    id: string
    name: string
    prefix: string
    createdAt: string
    lastUsed?: string
    status: 'active' | 'revoked'
    scopes: string[]
}

export interface WebhookEndpoint {
    id: string
    url: string
    events: string[]
    status: 'active' | 'inactive' | 'failing'
    lastDelivery?: string
    failureCount: number
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
    const res = await fetch('/api/api-management/keys');
    if (!res.ok) throw new Error('Failed to fetch API keys');
    const data = await res.json();
    return data.map((k: any) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.created_at,
        lastUsed: k.last_used_at,
        status: k.status,
        scopes: k.scopes
    }));
}

export async function createApiKey(name: string): Promise<ApiKey & { secret: string }> {
    const res = await fetch('/api/api-management/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create API key');
    const data = await res.json();

    // Map response
    return {
        id: data.id,
        name: data.name,
        prefix: data.prefix,
        createdAt: data.created_at,
        lastUsed: undefined,
        status: 'active',
        scopes: data.scopes,
        secret: data.secret
    };
}

export async function revokeApiKey(id: string): Promise<void> {
    const res = await fetch(`/api/api-management/keys/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to revoke API key');
}

export async function fetchWebhooks(): Promise<WebhookEndpoint[]> {
    const res = await fetch('/api/api-management/webhooks');
    if (!res.ok) throw new Error('Failed to fetch webhooks');
    const data = await res.json();
    return data.map((w: any) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        status: w.status,
        lastDelivery: w.last_delivery_at,
        failureCount: w.failure_count
    }));
}
