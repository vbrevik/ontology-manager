diff --git a/backend/src/features/import_engine/mod.rs b/backend/src/features/import_engine/mod.rs
index eb84b94..8b85cd1 100644
--- a/backend/src/features/import_engine/mod.rs
+++ b/backend/src/features/import_engine/mod.rs
@@ -1,6 +1,8 @@
 pub mod adapters;
 pub mod models;
+pub mod routes;
 pub mod service;
 
 pub use models::*;
+pub use routes::import_engine_routes;
 pub use service::ImportService;
diff --git a/backend/src/features/import_engine/routes.rs b/backend/src/features/import_engine/routes.rs
new file mode 100644
index 0000000..cfc451a
--- /dev/null
+++ b/backend/src/features/import_engine/routes.rs
@@ -0,0 +1,28 @@
+use super::models::{ImportParams, ImportResult, UnloadResult};
+use super::service::ImportService;
+use crate::features::import_engine::ImportError;
+use axum::{
+    extract::{Path, Query, State},
+    routing::post,
+    Json, Router,
+};
+
+pub fn import_engine_routes() -> Router<ImportService> {
+    Router::new().route("/{id}/import", post(import_source).delete(unload_source))
+}
+
+async fn import_source(
+    State(svc): State<ImportService>,
+    Path(source_id): Path<String>,
+    Query(params): Query<ImportParams>,
+) -> Result<Json<ImportResult>, ImportError> {
+    let role = params.role.as_deref().unwrap_or("base");
+    svc.import_source(&source_id, role).await.map(Json)
+}
+
+async fn unload_source(
+    State(svc): State<ImportService>,
+    Path(source_id): Path<String>,
+) -> Result<Json<UnloadResult>, ImportError> {
+    svc.unload_source(&source_id).await.map(Json)
+}
diff --git a/backend/src/main.rs b/backend/src/main.rs
index db793c6..abfa052 100644
--- a/backend/src/main.rs
+++ b/backend/src/main.rs
@@ -152,6 +152,10 @@ async fn main() {
         pool.clone(),
         std::path::PathBuf::from(&config.ontology_data_dir),
     );
+    let import_service = features::import_engine::ImportService::new(
+        pool.clone(),
+        std::path::PathBuf::from(&config.ontology_data_dir),
+    );
 
     // MFA Service (Moved up)
     // let mfa_service = features::auth::mfa::MfaService::new(pool.clone(), "OntologyManager".to_string());
@@ -306,8 +310,15 @@ async fn main() {
         )
         .nest(
             "/ontology-sources",
-            features::ontology_sources::ontology_sources_routes()
-                .with_state(source_service)
+            Router::new()
+                .merge(
+                    features::ontology_sources::ontology_sources_routes()
+                        .with_state(source_service),
+                )
+                .merge(
+                    features::import_engine::import_engine_routes()
+                        .with_state(import_service),
+                )
                 .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                 .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
         );
diff --git a/backend/tests/common/mod.rs b/backend/tests/common/mod.rs
index 5bd5dc9..6173d53 100644
--- a/backend/tests/common/mod.rs
+++ b/backend/tests/common/mod.rs
@@ -15,6 +15,7 @@ use template_repo_backend::features::{
     rebac::RebacService,
     system::AuditService,
     system::SystemService,
+    import_engine::ImportService,
     ontology_sources::OntologySourceService,
     users::service::UserService,
 };
@@ -35,6 +36,7 @@ pub struct TestServices {
     pub mfa_service: template_repo_backend::features::auth::mfa::MfaService,
     pub project_service: template_repo_backend::features::projects::ProjectService,
     pub source_service: OntologySourceService,
+    pub import_service: ImportService,
 }
 
 pub async fn setup_services(pool: PgPool) -> TestServices {
@@ -118,6 +120,12 @@ pub async fn setup_services(pool: PgPool) -> TestServices {
         std::path::PathBuf::from("./test-data"),
     );
 
+    // Import Service
+    let import_service = ImportService::new(
+        pool.clone(),
+        std::path::PathBuf::from("./test-data"),
+    );
+
     TestServices {
         auth_service,
         user_service,
@@ -133,6 +141,7 @@ pub async fn setup_services(pool: PgPool) -> TestServices {
         mfa_service,
         project_service,
         source_service,
+        import_service,
     }
 }
 
diff --git a/docs/requirements/02-import-engine/implementation/contracts/section-05-contract.md b/docs/requirements/02-import-engine/implementation/contracts/section-05-contract.md
new file mode 100644
index 0000000..c68b65b
--- /dev/null
+++ b/docs/requirements/02-import-engine/implementation/contracts/section-05-contract.md
@@ -0,0 +1,23 @@
+# Section 05 — Routes and Integration Prompt Contract
+
+## GOAL
+Wire import engine into application: route handlers, router factory, main.rs integration, test harness update.
+
+## CONSTRAINTS
+- Follow ontology_sources/routes.rs pattern
+- Merge import routes with source routes under /ontology-sources
+- Must compile and pass existing tests
+
+## FORMAT
+### Files to Create
+- `backend/src/features/import_engine/routes.rs`
+
+### Files to Modify
+- `backend/src/features/import_engine/mod.rs` — add routes module
+- `backend/src/main.rs` — create ImportService, merge routes
+- `backend/tests/common/mod.rs` — add import_service to TestServices
+
+## FAILURE CONDITIONS
+- SHALL NOT break existing tests
+- SHALL compile successfully
+- cargo test must pass
diff --git a/docs/requirements/02-import-engine/implementation/deep_implement_config.json b/docs/requirements/02-import-engine/implementation/deep_implement_config.json
index 5456b25..6d8254f 100644
--- a/docs/requirements/02-import-engine/implementation/deep_implement_config.json
+++ b/docs/requirements/02-import-engine/implementation/deep_implement_config.json
@@ -26,6 +26,10 @@
     "section-03-adapters": {
       "status": "complete",
       "commit_hash": "153f7e6"
+    },
+    "section-04-service": {
+      "status": "complete",
+      "commit_hash": "83f9986"
     }
   },
   "pre_commit": {
