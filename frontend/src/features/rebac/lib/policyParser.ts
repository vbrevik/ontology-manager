import type { Condition, ConditionGroup } from "@/features/ontology/lib/api";

type ParsedPolicy = {
    effect: "ALLOW" | "DENY";
    conditions: ConditionGroup;
};

/**
 * Parses a simple text-based policy DSL into backend-compatible ConditionGroup.
 * 
 * Syntax:
 * allow if attribute operator value [and attribute operator value ...]
 * deny
 * 
 * Example:
 * allow if user.role == "admin"
 * allow if resource.status in ["active", "pending"] and user.score > 5
 */
export function parsePolicy(policyText: string): ParsedPolicy[] {
    const lines = policyText.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    const rules: ParsedPolicy[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === 'deny') {
            // "deny" usually implies a default deny at the end, 
            // but for this parser we might just ignore it if it's a catch-all 
            // or treat it as an explicit rule if needed. 
            // For now, let's treat explicit "deny" lines without conditions as global deny?
            // Actually, usually "deny" is the default fallback. 
            // Let's only parse "allow if" lines for now as positive rules.
            continue;
        }

        if (trimmed.startsWith('allow if ')) {
            const conditionPart = trimmed.substring('allow if '.length);
            const conditions = parseConditions(conditionPart);
            rules.push({
                effect: "ALLOW",
                conditions: {
                    all: conditions,
                    any: []
                }
            });
        }
    }

    return rules;
}

function parseConditions(text: string): Condition[] {
    // Split by ' and ' to get individual conditions
    // Note: This is a simple split, doesn't handle 'and' inside strings.
    const parts = text.split(' and ');
    const conditions: Condition[] = [];

    for (const part of parts) {
        const condition = parseCondition(part.trim());
        if (condition) {
            conditions.push(condition);
        }
    }

    return conditions;
}

function parseCondition(text: string): Condition | null {
    // Regex to match: attribute operator value
    // Supports: ==, !=, >, <, >=, <=, in, not_in
    // Value can be string "...", number, boolean, or array [...]

    // Regex breakdown:
    // ^([\w\.]+)  -> Attribute (start of line, alphanumeric + dots)
    // \s+         -> whitespace
    // (==|!=|>=|<=|>|<|in|not_in) -> Operator
    // \s+         -> whitespace
    // (.+)$       -> Value (rest of line)

    const regex = /^([\w\.]+)\s+(==|!=|>=|<=|>|<|in|not_in)\s+(.+)$/;
    const match = text.match(regex);

    if (!match) return null;

    const [_, attribute, operator, valueStr] = match;
    const value = parseValue(valueStr);

    return {
        attribute,
        operator,
        value
    };
}

function parseValue(valueStr: string): any {
    valueStr = valueStr.trim();

    // String: "value"
    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
        return valueStr.slice(1, -1);
    }

    // Number
    if (!isNaN(Number(valueStr))) {
        return Number(valueStr);
    }

    // Boolean
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;

    // Array: ["a", "b"] or [1, 2]
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
        try {
            // Use JSON.parse for arrays, but we need to ensure keys (if any objects) are quoted?
            // Actually, for simple arrays of primitives, JSON.parse works if format is strict.
            // Let's try to be lenient with quotes if possible, but JSON.parse is safest for now.
            return JSON.parse(valueStr);
        } catch (e) {
            console.warn("Failed to parse array value:", valueStr);
            return []; // Fallback
        }
    }

    return valueStr;
}
