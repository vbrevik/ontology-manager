use crate::features::discovery::models::{RegisterServiceRequest, ServiceInstance, ServiceStatus};
use chrono::Utc;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::sleep;
use uuid::Uuid;

#[derive(Clone)]
pub struct DiscoveryService {
    registry: Arc<RwLock<std::collections::HashMap<String, ServiceInstance>>>,
    ontology_service: crate::features::ontology::service::OntologyService,
}

impl DiscoveryService {
    pub fn new(ontology_service: crate::features::ontology::service::OntologyService) -> Self {
        let registry: Arc<RwLock<std::collections::HashMap<String, ServiceInstance>>> =
            Arc::new(RwLock::new(std::collections::HashMap::new()));
        let registry_clone = registry.clone();
        let ontology_service_clone = ontology_service.clone();

        // Spawn health-check background task
        tokio::spawn(async move {
            loop {
                // Check for expired heartbeats every 10 seconds
                sleep(Duration::from_secs(10)).await;

                let mut registry = registry_clone.write().await;

                let now = Utc::now();
                for instance in registry.values_mut() {
                    let elapsed = now
                        .signed_duration_since(instance.last_heartbeat)
                        .num_seconds();
                    let old_status = instance.status.clone();

                    if elapsed > 30 {
                        if instance.status != ServiceStatus::DOWN {
                            tracing::warn!(
                                "Service {} ({}) missed heartbeat ({}s). Marking as DOWN.",
                                instance.name,
                                instance.id,
                                elapsed
                            );
                            instance.status = ServiceStatus::DOWN;
                        }
                    } else if elapsed > 15 && instance.status == ServiceStatus::UP {
                        tracing::warn!(
                            "Service {} ({}) sluggish heartbeat ({}s). Marking as WARNING.",
                            instance.name,
                            instance.id,
                            elapsed
                        );
                        instance.status = ServiceStatus::WARNING;
                    }

                    // Sync status to ontology if changed
                    if instance.status != old_status {
                        if let Ok(service_class) =
                            ontology_service_clone.get_system_class("Service").await
                        {
                            // Find entity by service_id
                            let pool = ontology_service_clone.get_pool();
                            let entity_id = sqlx::query_scalar::<_, Uuid>(
                                "SELECT id FROM entities WHERE class_id = $1 AND attributes->>'service_id' = $2"
                            )
                            .bind(service_class.id)
                            .bind(&instance.id)
                            .fetch_optional(pool)
                            .await
                            .ok()
                            .flatten();

                            if let Some(eid) = entity_id {
                                let _ = ontology_service_clone.update_entity(
                                    eid,
                                    crate::features::ontology::models::UpdateEntityInput {
                                        display_name: None,
                                        parent_entity_id: None,
                                        attributes: Some(serde_json::json!({
                                            "service_id": instance.id,
                                            "name": instance.name,
                                            "version": instance.version,
                                            "endpoint": instance.endpoint,
                                            "status": format!("{:?}", instance.status),
                                            "last_heartbeat": instance.last_heartbeat.to_rfc3339(),
                                        })),
                                    },
                                    None,
                                ).await;
                            }
                        }
                    }
                }
            }
        });

        Self {
            registry,
            ontology_service,
        }
    }

    pub async fn register(&self, req: RegisterServiceRequest) -> String {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let instance = ServiceInstance {
            id: id.clone(),
            name: req.name.clone(),
            version: req.version.clone(),
            endpoint: req.endpoint.clone(),
            status: ServiceStatus::UP,
            last_heartbeat: now,
            metadata: req.metadata.unwrap_or_default(),
            entity_id: None,
        };

        let mut final_instance = instance.clone();

        // Create ontology entity for the service
        if let Ok(service_class) = self.ontology_service.get_system_class("Service").await {
            if let Ok(entity) = self
                .ontology_service
                .create_entity(
                    crate::features::ontology::models::CreateEntityInput {
                        class_id: service_class.id,
                        display_name: req.name.clone(),
                        parent_entity_id: None,
                        attributes: Some(serde_json::json!({
                            "service_id": id,
                            "name": req.name,
                            "version": req.version,
                            "endpoint": req.endpoint,
                            "status": "UP",
                            "last_heartbeat": now.to_rfc3339()
                        })),
                    },
                    None,
                    None,
                )
                .await
            {
                final_instance.entity_id = Some(entity.id.to_string());
            }
        }

        {
            let mut registry = self.registry.write().await;
            registry.insert(id.clone(), final_instance);
            tracing::info!("Registered new service: {} ({})", req.name, id);
        }

        id
    }

    pub async fn heartbeat(&self, service_id: &str) -> bool {
        let mut status_changed = false;
        let now = Utc::now();
        let (name, version, endpoint) = {
            let mut registry = self.registry.write().await;
            if let Some(instance) = registry.get_mut(service_id) {
                instance.last_heartbeat = now;
                let n = instance.name.clone();
                let v = instance.version.clone();
                let e = instance.endpoint.clone();
                if instance.status != ServiceStatus::UP {
                    tracing::info!(
                        "Service {} ({}) recovered. Marking as UP.",
                        instance.name,
                        instance.id
                    );
                    instance.status = ServiceStatus::UP;
                    status_changed = true;
                }
                (n, v, e)
            } else {
                return false;
            }
        };

        let _ = status_changed;

        // Sync heartbeat to ontology
        if let Ok(service_class) = self.ontology_service.get_system_class("Service").await {
            let pool = self.ontology_service.get_pool();
            let entity_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM entities WHERE class_id = $1 AND attributes->>'service_id' = $2",
            )
            .bind(service_class.id)
            .bind(service_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            if let Some(eid) = entity_id {
                let _ = self
                    .ontology_service
                    .update_entity(
                        eid,
                        crate::features::ontology::models::UpdateEntityInput {
                            display_name: None,
                            parent_entity_id: None,
                            attributes: Some(serde_json::json!({
                                "service_id": service_id,
                                "name": name,
                                "version": version,
                                "endpoint": endpoint,
                                "status": "UP",
                                "last_heartbeat": now.to_rfc3339()
                            })),
                        },
                        None,
                    )
                    .await;
            }
        }

        true
    }

    pub async fn list_services(&self) -> Vec<ServiceInstance> {
        self.registry.read().await.values().cloned().collect()
    }

    pub async fn get_service(&self, id: &str) -> Option<ServiceInstance> {
        self.registry.read().await.get(id).cloned()
    }
}
