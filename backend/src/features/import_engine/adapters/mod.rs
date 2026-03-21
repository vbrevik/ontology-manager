pub mod json_adapter;
pub mod schema_adapter;

use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;

use crate::features::import_engine::models::{ImportError, ParsedClass, ParsedOntology};
use crate::features::ontology_sources::models::SourceManifest;

/// Reads ontology data files from a source directory and returns a ParsedOntology.
/// Dispatches to the appropriate adapter based on the source format string.
pub async fn parse_source(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<ParsedOntology, ImportError> {
    match manifest.format.as_str() {
        "json" => json_adapter::parse(source_dir, manifest).await,
        "json-schema" => schema_adapter::parse(source_dir, manifest).await,
        other => Err(ImportError::InvalidInput(format!(
            "Unsupported source format: {}",
            other
        ))),
    }
}

/// Validates a ParsedOntology for internal consistency and returns it with
/// classes sorted in topological (parent-before-child) order.
pub fn validate_and_sort(ontology: ParsedOntology) -> Result<ParsedOntology, ImportError> {
    let mut errors = Vec::new();

    // Check duplicate class names
    let mut seen = HashSet::new();
    for class in &ontology.classes {
        if !seen.insert(class.name.as_str()) {
            errors.push(format!("Duplicate class name: {}", class.name));
        }
    }

    let name_set: HashSet<&str> = seen;

    // Check orphan parent class references
    for class in &ontology.classes {
        if let Some(ref parent) = class.parent_name {
            if !name_set.contains(parent.as_str()) {
                errors.push(format!(
                    "Class '{}' references unknown parent class '{}'",
                    class.name, parent
                ));
            }
        }
    }

    // Check orphan property references
    for prop in &ontology.properties {
        if !name_set.contains(prop.class_name.as_str()) {
            errors.push(format!(
                "Property '{}' references unknown class '{}'",
                prop.name, prop.class_name
            ));
        }
    }

    // Check orphan relationship type references
    for rt in &ontology.relationship_types {
        if let Some(ref src) = rt.source_class_name {
            if !name_set.contains(src.as_str()) {
                errors.push(format!(
                    "Relationship type '{}' references unknown source class '{}'",
                    rt.name, src
                ));
            }
        }
        if let Some(ref tgt) = rt.target_class_name {
            if !name_set.contains(tgt.as_str()) {
                errors.push(format!(
                    "Relationship type '{}' references unknown target class '{}'",
                    rt.name, tgt
                ));
            }
        }
    }

    if !errors.is_empty() {
        return Err(ImportError::ParseError(errors.join("; ")));
    }

    // Topological sort (also detects cycles)
    let sorted_classes = topological_sort(&ontology.classes)?;

    Ok(ParsedOntology {
        classes: sorted_classes,
        properties: ontology.properties,
        relationship_types: ontology.relationship_types,
    })
}

/// Sorts classes in parent-before-child order using Kahn's algorithm.
/// Returns Err(ImportError::ParseError) if a cycle is detected.
pub fn topological_sort(classes: &[ParsedClass]) -> Result<Vec<ParsedClass>, ImportError> {
    let name_to_idx: HashMap<&str, usize> = classes
        .iter()
        .enumerate()
        .map(|(i, c)| (c.name.as_str(), i))
        .collect();

    let n = classes.len();
    let mut in_degree = vec![0usize; n];
    let mut children: Vec<Vec<usize>> = vec![vec![]; n];

    for (i, class) in classes.iter().enumerate() {
        if let Some(ref parent) = class.parent_name {
            if let Some(&parent_idx) = name_to_idx.get(parent.as_str()) {
                children[parent_idx].push(i);
                in_degree[i] += 1;
            }
            // If parent not in the set, it's an external reference — treat as root
        }
    }

    let mut queue: VecDeque<usize> = VecDeque::new();
    for i in 0..n {
        if in_degree[i] == 0 {
            queue.push_back(i);
        }
    }

    let mut sorted = Vec::with_capacity(n);
    while let Some(idx) = queue.pop_front() {
        sorted.push(classes[idx].clone());
        for &child_idx in &children[idx] {
            in_degree[child_idx] -= 1;
            if in_degree[child_idx] == 0 {
                queue.push_back(child_idx);
            }
        }
    }

    if sorted.len() < n {
        let remaining: Vec<&str> = classes
            .iter()
            .enumerate()
            .filter(|(i, _)| in_degree[*i] > 0)
            .map(|(_, c)| c.name.as_str())
            .collect();
        return Err(ImportError::ParseError(format!(
            "Cycle detected among classes: {}",
            remaining.join(", ")
        )));
    }

    Ok(sorted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::import_engine::models::{
        ParsedClass, ParsedOntology, ParsedProperty, ParsedRelationshipType,
    };

    fn make_class(name: &str, parent: Option<&str>) -> ParsedClass {
        ParsedClass {
            name: name.to_string(),
            parent_name: parent.map(|s| s.to_string()),
            description: None,
            is_abstract: false,
            is_system: false,
        }
    }

    #[test]
    fn test_topological_sort_basic() {
        let classes = vec![
            make_class("A", None),
            make_class("B", Some("A")),
            make_class("C", Some("B")),
        ];
        let sorted = topological_sort(&classes).unwrap();
        assert_eq!(sorted.len(), 3);
        assert_eq!(sorted[0].name, "A");
        assert_eq!(sorted[1].name, "B");
        assert_eq!(sorted[2].name, "C");
    }

    #[test]
    fn test_topological_sort_cycle_detection() {
        let classes = vec![
            make_class("A", Some("C")),
            make_class("B", Some("A")),
            make_class("C", Some("B")),
        ];
        let result = topological_sort(&classes);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Cycle detected"));
    }

    #[test]
    fn test_validate_orphan_property() {
        let ontology = ParsedOntology {
            classes: vec![make_class("Real", None)],
            properties: vec![ParsedProperty {
                name: "orphan_prop".to_string(),
                class_name: "Missing".to_string(),
                data_type: "string".to_string(),
                is_required: false,
                is_unique: false,
                is_sensitive: false,
                description: None,
                validation_rules: None,
            }],
            relationship_types: vec![],
        };
        let result = validate_and_sort(ontology);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Missing"));
    }

    #[test]
    fn test_validate_orphan_relationship_type() {
        let ontology = ParsedOntology {
            classes: vec![make_class("Real", None)],
            properties: vec![],
            relationship_types: vec![ParsedRelationshipType {
                name: "orphan_rel".to_string(),
                description: None,
                source_class_name: Some("Missing".to_string()),
                target_class_name: None,
                source_cardinality: "many".to_string(),
                target_cardinality: "many".to_string(),
                grants_permission_inheritance: false,
            }],
        };
        let result = validate_and_sort(ontology);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Missing"));
    }

    #[test]
    fn test_validate_duplicate_class_names() {
        let ontology = ParsedOntology {
            classes: vec![make_class("Duplicate", None), make_class("Duplicate", None)],
            properties: vec![],
            relationship_types: vec![],
        };
        let result = validate_and_sort(ontology);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Duplicate"));
    }
}
