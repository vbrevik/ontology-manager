# Import Engine Interview Transcript

## Q1: is_system field handling
**Q:** The classes table has no `is_system` column, but system-ontology classes.json includes `is_system: true/false`. How should we handle it?
**A:** Add `is_system` column — create a new migration adding `is_system BOOLEAN` to the classes table.

## Q2: MPCG taxonomy import scope
**Q:** When importing the MPCG taxonomy (90+ node types, 25+ edge types), should ALL types be imported or only the "active" ones from schema.json's enum?
**A:** Import all taxonomy types. Mark non-enum types as `is_abstract=true`.

## Q3: Conflict detection timing
**Q:** Should conflict detection run automatically on extension import, or be a separate step?
**A:** Automatic on extension import — always detect conflicts when importing with `role=extension`.

## Q4: MPCG property_descriptions
**Q:** MPCG taxonomy has `property_descriptions` on some node types. Import as DB properties or metadata?
**A:** Import as DB properties — create property rows with descriptions and any enum constraints.

## Q5: Seed data handling
**Q:** Should the import engine handle seed_data.json (default entities, permissions, rate limit rules)?
**A:** Out of scope. Import engine only handles classes, properties, and relationship_types.

## Q6: Unload behavior (DELETE endpoint)
**Q:** Should DELETE /api/ontology-sources/{id}/import also clear is_base/is_extension flags?
**A:** Remove data + clear flags — full cleanup: delete imported rows AND reset flags to false.

## Q7: Entity references during clean swap
**Q:** When re-importing, what happens to existing entities that reference imported classes?
**A:** Not applicable yet — entities aren't tied to imported classes in the current schema. Handle later.

## Q8: Synchronous vs async import
**Q:** Should import run synchronously or as a background job?
**A:** Synchronous — block the HTTP request until import completes. Fine for hundreds of classes.
