use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use chrono::Utc;
use uuid::Uuid;
use tokio::time::sleep;
use crate::features::discovery::models::{ServiceInstance, ServiceStatus, RegisterServiceRequest};

#[derive(Clone)]
pub struct DiscoveryService {
    registry: Arc<RwLock<HashMap<String, ServiceInstance>>>,
}

impl DiscoveryService {
    pub fn new() -> Self {
        let registry: Arc<RwLock<HashMap<String, ServiceInstance>>> = Arc::new(RwLock::new(HashMap::new()));
        let registry_clone = registry.clone();

        // Spawn health-check background task
        tokio::spawn(async move {
            loop {
                // Check for expired heartbeats every 10 seconds
                sleep(Duration::from_secs(10)).await;
                
                let mut registry = match registry_clone.write() {
                    Ok(r) => r,
                    Err(_) => continue,
                };

                let now = Utc::now();
                for instance in registry.values_mut() {
                    let elapsed = now.signed_duration_since(instance.last_heartbeat).num_seconds();
                    
                    if elapsed > 30 {
                        if instance.status != ServiceStatus::DOWN {
                            tracing::warn!("Service {} ({}) missed heartbeat ({}s). Marking as DOWN.", instance.name, instance.id, elapsed);
                            instance.status = ServiceStatus::DOWN;
                        }
                    } else if elapsed > 15 {
                        if instance.status == ServiceStatus::UP {
                            tracing::warn!("Service {} ({}) sluggish heartbeat ({}s). Marking as WARNING.", instance.name, instance.id, elapsed);
                            instance.status = ServiceStatus::WARNING;
                        }
                    }
                }
            }
        });

        Self { registry }
    }

    pub async fn register(&self, req: RegisterServiceRequest) -> String {
        let id = Uuid::new_v4().to_string();
        let instance = ServiceInstance {
            id: id.clone(),
            name: req.name,
            version: req.version,
            endpoint: req.endpoint,
            status: ServiceStatus::UP,
            last_heartbeat: Utc::now(),
            metadata: req.metadata.unwrap_or_default(),
        };

        if let Ok(mut registry) = self.registry.write() {
            registry.insert(id.clone(), instance);
            tracing::info!("Registered new service: {} ({})", id, id);
        }

        id
    }

    pub async fn heartbeat(&self, service_id: &str) -> bool {
        if let Ok(mut registry) = self.registry.write() {
            if let Some(instance) = registry.get_mut(service_id) {
                instance.last_heartbeat = Utc::now();
                if instance.status != ServiceStatus::UP {
                    tracing::info!("Service {} ({}) recovered. Marking as UP.", instance.name, instance.id);
                    instance.status = ServiceStatus::UP;
                }
                return true;
            }
        }
        false
    }

    pub async fn list_services(&self) -> Vec<ServiceInstance> {
        if let Ok(registry) = self.registry.read() {
            registry.values().cloned().collect()
        } else {
            Vec::new()
        }
    }

    pub async fn get_service(&self, id: &str) -> Option<ServiceInstance> {
        if let Ok(registry) = self.registry.read() {
            registry.get(id).cloned()
        } else {
            None
        }
    }
}
