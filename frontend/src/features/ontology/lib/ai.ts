export interface GenerateClassDescriptionRequest {
    name: string;
    properties?: string[];
}

export interface GenerateClassDescriptionResponse {
    description: string;
}

export async function generateClassDescription(
    name: string,
    properties?: string[]
): Promise<string> {
    const res = await fetch('/api/ai/generate-class-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, properties })
    });

    if (!res.ok) throw new Error('Failed to generate class description');

    const data: GenerateClassDescriptionResponse = await res.json();
    return data.description;
}
