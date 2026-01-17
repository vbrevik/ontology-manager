import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchAiStatus } from '@/features/ontology/lib/api';

interface AiStatus {
    status: 'Healthy' | 'Unhealthy' | 'Checking';
    model?: string;
    providerUrl?: string;
    message?: string;
}

interface AiContextType {
    status: AiStatus;
    refreshStatus: () => Promise<void>;
    isAvailable: boolean;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export function AiProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<AiStatus>({ status: 'Checking' });

    const refreshStatus = useCallback(async () => {
        try {
            const data = await fetchAiStatus();
            setStatus({
                status: data.status as any,
                model: data.model,
                providerUrl: data.provider_url,
                message: data.message
            });
        } catch (error) {
            setStatus({ status: 'Unhealthy', message: 'Failed to reach backend API' });
        }
    }, []);

    useEffect(() => {
        refreshStatus();
        // Poll every 30 seconds
        const interval = setInterval(refreshStatus, 30000);
        return () => clearInterval(interval);
    }, [refreshStatus]);

    const value = {
        status,
        refreshStatus,
        isAvailable: status.status === 'Healthy'
    };

    return (
        <AiContext.Provider value={value}>
            {children}
        </AiContext.Provider>
    );
}

export function useAi() {
    const context = useContext(AiContext);
    if (context === undefined) {
        throw new Error('useAi must be used within an AiProvider');
    }
    return context;
}
