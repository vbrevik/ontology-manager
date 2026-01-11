
import { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Property } from '@/features/ontology/lib/api';

interface EntityPropertyFormProps {
    properties: Property[];
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
    errors?: Record<string, string>;
}

export function EntityPropertyForm({ properties, values, onChange, errors = {} }: EntityPropertyFormProps) {
    const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setLocalErrors(errors);
    }, [errors]);

    const validateField = (prop: Property, value: any) => {
        const rules = prop.validation_rules as any;
        if (!rules) return "";

        if (prop.is_required && (value === undefined || value === null || value === "")) {
            return "This field is required";
        }

        if (value) {
            if (rules.regex && typeof value === 'string') {
                const re = new RegExp(rules.regex);
                if (!re.test(value)) {
                    return `Must match pattern: ${rules.regex}`;
                }
            }

            if (prop.data_type === 'number') {
                const num = parseFloat(value);
                if (rules.min !== undefined && num < rules.min) {
                    return `Value must be at least ${rules.min}`;
                }
                if (rules.max !== undefined && num > rules.max) {
                    return `Value must be at most ${rules.max}`;
                }
            }

            if (rules.options && rules.options.length > 0) {
                if (!rules.options.includes(value)) {
                    return `Must be one of: ${rules.options.join(', ')}`;
                }
            }
        }

        return "";
    };

    const handleFieldChange = (prop: Property, value: any) => {
        const error = validateField(prop, value);
        setLocalErrors(prev => ({ ...prev, [prop.name]: error }));

        onChange({
            ...values,
            [prop.name]: value
        });
    };

    return (
        <div className="space-y-4 py-2">
            {properties.map((prop) => {
                const error = localErrors[prop.name];
                const value = values[prop.name];

                return (
                    <div key={prop.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">
                                {prop.name}
                                {prop.is_required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {prop.description && (
                                <span className="text-[10px] text-muted-foreground">{prop.description}</span>
                            )}
                        </div>

                        {prop.data_type === 'boolean' ? (
                            <div className="flex items-center space-x-2 py-1">
                                <Switch
                                    checked={!!value}
                                    onCheckedChange={(val) => handleFieldChange(prop, val)}
                                />
                                <span className="text-xs text-muted-foreground">{value ? 'True' : 'False'}</span>
                            </div>
                        ) : (prop.validation_rules as any)?.options ? (
                            <Select
                                value={value?.toString() || ""}
                                onValueChange={(val) => handleFieldChange(prop, val)}
                            >
                                <SelectTrigger className={error ? "border-destructive" : ""}>
                                    <SelectValue placeholder={`Select ${prop.name}...`} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(prop.validation_rules as any).options.map((opt: string) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                type={prop.data_type === 'number' ? 'number' : 'text'}
                                value={value ?? ""}
                                onChange={(e) => handleFieldChange(prop, prop.data_type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                placeholder={`Enter ${prop.name}...`}
                                className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                            />
                        )}

                        {error && (
                            <p className="text-[10px] text-destructive font-medium animate-in fade-in slide-in-from-top-1">
                                {error}
                            </p>
                        )}
                    </div>
                );
            })}
            {properties.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                    No attributes defined for this class.
                </p>
            )}
        </div>
    );
}
