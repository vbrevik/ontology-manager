import { useState, useEffect } from 'react';

interface CronPreset {
    name: string;
    cron: string;
    description: string;
}

interface CronValidationResult {
    valid: boolean;
    error?: string;
    next_occurrences: string[];
}

interface ScheduleEditorProps {
    value: string | null;
    onChange: (value: string | null) => void;
    onValidate?: (isValid: boolean) => void;
}

export function ScheduleEditor({ value, onChange, onValidate }: ScheduleEditorProps) {
    const [cronExpression, setCronExpression] = useState(value || '');
    const [presets, setPresets] = useState<CronPreset[]>([]);
    const [validation, setValidation] = useState<CronValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [showCustom, setShowCustom] = useState(!!value && !isPreset(value));

    useEffect(() => {
        fetchPresets();
    }, []);

    useEffect(() => {
        if (cronExpression) {
            const debounce = setTimeout(() => validateCron(cronExpression), 500);
            return () => clearTimeout(debounce);
        } else {
            setValidation(null);
            onValidate?.(true);
        }
    }, [cronExpression]);

    async function fetchPresets() {
        try {
            const res = await fetch('/api/rebac/schedules/presets', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setPresets(data);
            }
        } catch (err) {
            console.error('Failed to fetch presets:', err);
            // Use fallback presets
            setPresets([
                { name: 'Business Hours (Mon-Fri 9am-5pm)', cron: '0 9-17 * * 1-5', description: 'Active during weekday business hours' },
                { name: 'Weekends Only', cron: '0 * * * 0,6', description: 'Active on Saturday and Sunday' },
                { name: 'After Hours (6pm-8am)', cron: '0 18-23,0-8 * * *', description: 'Active outside business hours' },
            ]);
        }
    }

    async function validateCron(expr: string) {
        if (!expr.trim()) {
            setValidation(null);
            onValidate?.(true);
            return;
        }

        setIsValidating(true);
        try {
            const res = await fetch('/api/rebac/schedules/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cron: expr }),
            });
            const data: CronValidationResult = await res.json();
            setValidation(data);
            onValidate?.(data.valid);
            if (data.valid) {
                onChange(expr);
            }
        } catch (err) {
            setValidation({ valid: false, error: 'Failed to validate', next_occurrences: [] });
            onValidate?.(false);
        } finally {
            setIsValidating(false);
        }
    }

    function isPreset(expr: string) {
        return presets.some(p => p.cron === expr);
    }

    function handlePresetSelect(cron: string) {
        setCronExpression(cron);
        onChange(cron);
        setShowCustom(false);
    }

    function handleClear() {
        setCronExpression('');
        onChange(null);
        setValidation(null);
        setShowCustom(false);
    }

    return (
        <div className="schedule-editor">
            <style>{`
                .schedule-editor {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .schedule-editor__label {
                    font-weight: 600;
                    color: #e0e0e0;
                    font-size: 14px;
                }
                .schedule-editor__presets {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 8px;
                }
                .schedule-editor__preset {
                    padding: 12px;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    background: #2a2a2a;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .schedule-editor__preset:hover {
                    border-color: #6366f1;
                    background: #333;
                }
                .schedule-editor__preset--selected {
                    border-color: #6366f1;
                    background: rgba(99, 102, 241, 0.1);
                }
                .schedule-editor__preset-name {
                    font-weight: 500;
                    color: #fff;
                    font-size: 13px;
                }
                .schedule-editor__preset-desc {
                    font-size: 11px;
                    color: #888;
                    margin-top: 4px;
                }
                .schedule-editor__custom-toggle {
                    color: #6366f1;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 13px;
                    padding: 8px 0;
                    text-align: left;
                }
                .schedule-editor__custom-toggle:hover {
                    text-decoration: underline;
                }
                .schedule-editor__input-wrapper {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .schedule-editor__input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid #3a3a3a;
                    border-radius: 6px;
                    background: #1a1a1a;
                    color: #fff;
                    font-family: monospace;
                    font-size: 14px;
                }
                .schedule-editor__input:focus {
                    outline: none;
                    border-color: #6366f1;
                }
                .schedule-editor__input--invalid {
                    border-color: #ef4444;
                }
                .schedule-editor__input--valid {
                    border-color: #22c55e;
                }
                .schedule-editor__clear-btn {
                    padding: 10px 16px;
                    background: #3a3a3a;
                    border: none;
                    border-radius: 6px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                }
                .schedule-editor__clear-btn:hover {
                    background: #444;
                }
                .schedule-editor__validation {
                    padding: 12px;
                    border-radius: 6px;
                    font-size: 13px;
                }
                .schedule-editor__validation--valid {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: #22c55e;
                }
                .schedule-editor__validation--invalid {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                }
                .schedule-editor__occurrences {
                    margin-top: 8px;
                    color: #888;
                    font-size: 12px;
                }
                .schedule-editor__occurrences ul {
                    margin: 4px 0 0 16px;
                    padding: 0;
                    list-style: disc;
                }
                .schedule-editor__occurrences li {
                    margin: 2px 0;
                }
                .schedule-editor__help {
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                }
            `}</style>

            <div className="schedule-editor__label">Access Schedule</div>

            {/* Preset buttons */}
            <div className="schedule-editor__presets">
                {presets.map(preset => (
                    <div
                        key={preset.cron}
                        className={`schedule-editor__preset ${cronExpression === preset.cron ? 'schedule-editor__preset--selected' : ''}`}
                        onClick={() => handlePresetSelect(preset.cron)}
                    >
                        <div className="schedule-editor__preset-name">{preset.name}</div>
                        <div className="schedule-editor__preset-desc">{preset.description}</div>
                    </div>
                ))}
            </div>

            {/* Custom toggle */}
            <button
                type="button"
                className="schedule-editor__custom-toggle"
                onClick={() => setShowCustom(!showCustom)}
            >
                {showCustom ? '← Back to presets' : '+ Custom cron expression'}
            </button>

            {/* Custom input */}
            {showCustom && (
                <>
                    <div className="schedule-editor__input-wrapper">
                        <input
                            type="text"
                            className={`schedule-editor__input ${validation
                                ? validation.valid
                                    ? 'schedule-editor__input--valid'
                                    : 'schedule-editor__input--invalid'
                                : ''
                                }`}
                            placeholder="e.g., 0 9-17 * * 1-5"
                            value={cronExpression}
                            onChange={(e) => setCronExpression(e.target.value)}
                        />
                        <button
                            type="button"
                            className="schedule-editor__clear-btn"
                            onClick={handleClear}
                        >
                            Clear
                        </button>
                    </div>
                    <div className="schedule-editor__help">
                        Format: minute hour day-of-month month day-of-week (e.g., "0 9-17 * * 1-5" for weekday business hours)
                    </div>
                </>
            )}

            {/* Validation result */}
            {validation && !isValidating && (
                <div className={`schedule-editor__validation ${validation.valid ? 'schedule-editor__validation--valid' : 'schedule-editor__validation--invalid'}`}>
                    {validation.valid ? (
                        <>
                            ✓ Valid schedule
                            {validation.next_occurrences.length > 0 && (
                                <div className="schedule-editor__occurrences">
                                    Next occurrences:
                                    <ul>
                                        {validation.next_occurrences.slice(0, 3).map((occ, i) => (
                                            <li key={i}>{occ}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            ✗ {validation.error}
                        </>
                    )}
                </div>
            )}

            {isValidating && (
                <div style={{ color: '#888', fontSize: 13 }}>Validating...</div>
            )}

            {/* Current value display */}
            {cronExpression && !showCustom && (
                <div style={{ fontSize: 12, color: '#666' }}>
                    Current: <code style={{ background: '#2a2a2a', padding: '2px 6px', borderRadius: 4 }}>{cronExpression}</code>
                    <button
                        type="button"
                        onClick={handleClear}
                        style={{ marginLeft: 8, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                    >
                        Remove schedule
                    </button>
                </div>
            )}
        </div>
    );
}

export default ScheduleEditor;
