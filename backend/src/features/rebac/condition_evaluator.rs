use super::policy_models::*;
use serde_json::Value as JsonValue;

/// Evaluate a single condition against the context
pub fn evaluate_condition(condition: &Condition, context: &EvaluationContext) -> bool {
    let actual_value = context.get(&condition.attribute);

    match condition.operator.as_str() {
        "==" | "eq" | "equals" => compare_eq(actual_value, &condition.value),
        "!=" | "neq" | "not_equals" => !compare_eq(actual_value, &condition.value),
        ">" => compare_gt(actual_value, &condition.value),
        ">=" => compare_gte(actual_value, &condition.value),
        "<" => compare_lt(actual_value, &condition.value),
        "<=" => compare_lte(actual_value, &condition.value),
        "in" => check_in(actual_value, &condition.value),
        "not_in" => !check_in(actual_value, &condition.value),
        "contains" => check_contains(actual_value, &condition.value),
        "matches" => check_regex(actual_value, &condition.value),
        "exists" => actual_value.is_some(),
        "not_exists" => actual_value.is_none(),
        _ => false,
    }
}

/// Evaluate a condition group (all AND, any OR)
pub fn evaluate_condition_group(group: &ConditionGroup, context: &EvaluationContext) -> bool {
    // If no conditions, consider it a match
    if group.all.is_empty() && group.any.is_empty() {
        return true;
    }

    // All conditions must pass (AND)
    let all_pass = group.all.is_empty() || group.all.iter().all(|c| evaluate_condition(c, context));

    // Any condition must pass (OR), or empty means pass
    let any_pass = group.any.is_empty() || group.any.iter().any(|c| evaluate_condition(c, context));

    all_pass && any_pass
}

/// Evaluate a policy's conditions from JSON
pub fn evaluate_policy_conditions(conditions: &JsonValue, context: &EvaluationContext) -> bool {
    // Parse the conditions JSON into ConditionGroup
    match serde_json::from_value::<ConditionGroup>(conditions.clone()) {
        Ok(group) => evaluate_condition_group(&group, context),
        Err(_) => {
            // Empty or invalid conditions = always match
            true
        }
    }
}

/// Test a policy's conditions and return detailed results
pub fn test_policy_conditions(
    conditions: &JsonValue,
    context: &EvaluationContext,
) -> Vec<ConditionTestResult> {
    let mut results = Vec::new();

    let group: ConditionGroup = match serde_json::from_value(conditions.clone()) {
        Ok(g) => g,
        Err(_) => return results,
    };

    for condition in group.all.iter().chain(group.any.iter()) {
        let actual = context.get(&condition.attribute).cloned();
        let passed = evaluate_condition(condition, context);

        results.push(ConditionTestResult {
            attribute: condition.attribute.clone(),
            operator: condition.operator.clone(),
            expected_value: condition.value.clone(),
            actual_value: actual,
            passed,
        });
    }

    results
}

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

fn compare_eq(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    actual == Some(expected)
}

fn compare_gt(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    match (actual, expected) {
        (Some(JsonValue::Number(a)), JsonValue::Number(e)) => {
            a.as_f64().unwrap_or(0.0) > e.as_f64().unwrap_or(0.0)
        }
        (Some(JsonValue::String(a)), JsonValue::String(e)) => a > e,
        _ => false,
    }
}

fn compare_gte(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    compare_eq(actual, expected) || compare_gt(actual, expected)
}

fn compare_lt(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    match (actual, expected) {
        (Some(JsonValue::Number(a)), JsonValue::Number(e)) => {
            a.as_f64().unwrap_or(0.0) < e.as_f64().unwrap_or(0.0)
        }
        (Some(JsonValue::String(a)), JsonValue::String(e)) => a < e,
        _ => false,
    }
}

fn compare_lte(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    compare_eq(actual, expected) || compare_lt(actual, expected)
}

fn check_in(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    let arr = match expected {
        JsonValue::Array(arr) => arr,
        _ => return false,
    };

    actual.is_some_and(|a| arr.contains(a))
}

fn check_contains(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    match actual {
        Some(JsonValue::Array(arr)) => arr.contains(expected),
        Some(JsonValue::String(s)) => {
            if let JsonValue::String(needle) = expected {
                s.contains(needle.as_str())
            } else {
                false
            }
        }
        _ => false,
    }
}

fn check_regex(actual: Option<&JsonValue>, expected: &JsonValue) -> bool {
    match (actual, expected) {
        (Some(JsonValue::String(s)), JsonValue::String(pattern)) => regex::Regex::new(pattern)
            .map(|re| re.is_match(s))
            .unwrap_or(false),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_equality() {
        let ctx = EvaluationContext::new().with_entity("status", json!("Active"));

        let cond = Condition {
            attribute: "entity.status".to_string(),
            operator: "==".to_string(),
            value: json!("Active"),
        };

        assert!(evaluate_condition(&cond, &ctx));
    }

    #[test]
    fn test_in_operator() {
        let ctx = EvaluationContext::new().with_entity("PoliticalTension", json!("High"));

        let cond = Condition {
            attribute: "entity.PoliticalTension".to_string(),
            operator: "in".to_string(),
            value: json!(["High", "Critical"]),
        };

        assert!(evaluate_condition(&cond, &ctx));
    }

    #[test]
    fn test_numeric_comparison() {
        let ctx = EvaluationContext::new().with_user("clearance_level", json!(2));

        let cond = Condition {
            attribute: "user.clearance_level".to_string(),
            operator: "<".to_string(),
            value: json!(3),
        };

        assert!(evaluate_condition(&cond, &ctx));
    }
}
