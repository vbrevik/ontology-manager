import { } from 'react'

export interface ToastProps {
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
}

export function useToast() {
    const toast = ({ title, description, variant }: ToastProps) => {
        console.log(`[Toast] ${variant === 'destructive' ? '❌' : '✅'} ${title}: ${description}`)
        // Real implementation would use a toast provider
        if (typeof window !== 'undefined') {
            alert(`${title}\n${description}`)
        }
    }

    return { toast }
}
