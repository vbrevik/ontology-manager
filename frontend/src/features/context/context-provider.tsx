
import React, { createContext, useContext, useState } from "react";

export interface ContextEntity {
    id: string;
    name: string;
    type: string; // e.g., "Campaign", "Operation"
}

interface ContextState {
    currentContext: ContextEntity | null;
    setContext: (context: ContextEntity | null) => void;
}

const ContextContext = createContext<ContextState | undefined>(undefined);

export function ContextProvider({ children }: { children: React.ReactNode }) {
    const [currentContext, setCurrentContext] = useState<ContextEntity | null>(() => {
        // Hydrate from local storage on boot
        const stored = localStorage.getItem("ontology_context");
        return stored ? JSON.parse(stored) : null;
    });

    const setContext = (context: ContextEntity | null) => {
        setCurrentContext(context);
        if (context) {
            localStorage.setItem("ontology_context", JSON.stringify(context));
        } else {
            localStorage.removeItem("ontology_context");
        }
    };

    return (
        <ContextContext.Provider value={{ currentContext, setContext }}>
            {children}
        </ContextContext.Provider>
    );
}

export function useOntologyContext() {
    const context = useContext(ContextContext);
    if (context === undefined) {
        throw new Error("useOntologyContext must be used within a ContextProvider");
    }
    return context;
}
