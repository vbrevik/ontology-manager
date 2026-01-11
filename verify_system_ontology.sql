-- Verification script for system ontology bootstrap
-- Run this to verify the system ontology was created correctly

SELECT '=== System Ontology Version ===' as section;
SELECT version, description, is_system, is_current, created_at 
FROM ontology_versions 
WHERE is_system = TRUE;

SELECT '=== System Classes ===' as section;
SELECT c.name, c.description, c.is_abstract, p.name as parent_name
FROM classes c
LEFT JOIN classes p ON c.parent_class_id = p.id
WHERE c.version_id = (SELECT id FROM ontology_versions WHERE is_system = TRUE)
ORDER BY 
    CASE 
        WHEN c.name IN ('AccessControl', 'Identity', 'Operations', 'Meta') THEN 0
        ELSE 1
    END,
    c.name;

SELECT '=== System Properties ===' as section;
SELECT c.name as class_name, p.name as property_name, p.data_type, p.is_required, p.is_unique
FROM properties p
JOIN classes c ON p.class_id = c.id
WHERE c.version_id = (SELECT id FROM ontology_versions WHERE is_system = TRUE)
ORDER BY c.name, p.name;

SELECT '=== System Relationship Types ===' as section;
SELECT name, description, grants_permission_inheritance
FROM relationship_types
WHERE name IN ('has_role', 'grants_permission', 'applies_to', 'performed_by', 'affects', 'depends_on')
ORDER BY name;

SELECT '=== Summary ===' as section;
SELECT 
    (SELECT COUNT(*) FROM classes WHERE version_id = (SELECT id FROM ontology_versions WHERE is_system = TRUE)) as total_classes,
    (SELECT COUNT(*) FROM properties WHERE version_id = (SELECT id FROM ontology_versions WHERE is_system = TRUE)) as total_properties,
    (SELECT COUNT(*) FROM relationship_types WHERE name IN ('has_role', 'grants_permission', 'applies_to', 'performed_by', 'affects', 'depends_on')) as system_relationship_types;
