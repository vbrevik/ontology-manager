# Interview: Source Discovery API

## Q1: Unique constraint update
**Q:** Should the unique constraint on `classes` be updated to include `source_id`?
**A:** Yes, add source_id to the constraint `(name, tenant_id, version_id, source_id)`. This allows the same class name from different sources — required for the layering feature where base and extension may define the same class.

## Q2: Authentication
**Q:** Should the source discovery endpoint require auth?
**A:** Yes, require auth. Consistent with all other API endpoints. Only logged-in users see available sources.

## Q3: Versioning strategy
**Q:** Should imported sources create their own ontology version entry?
**A:** Yes, one version per source import. Each import creates a version entry like "mpcg-ontology@2.0.0" for clean tracking of what was imported and when.
