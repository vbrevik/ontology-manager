use std::collections::HashSet;
use uuid::Uuid;

use super::models::{default_navigation, evaluate_navigation, NavSectionVisibility};
use crate::features::abac::AbacService;

#[derive(Clone)]
pub struct NavigationService {
    abac_service: AbacService,
}

#[derive(Debug)]
pub enum NavigationError {
    InvalidUserId(String),
    PermissionCheck(String),
}

impl NavigationService {
    pub fn new(abac_service: AbacService) -> Self {
        Self { abac_service }
    }

    pub fn evaluate_with_permissions(&self, permissions: &[String]) -> Vec<NavSectionVisibility> {
        let permissions = normalize_permissions(permissions);
        let definitions = default_navigation();
        evaluate_navigation(&definitions, &permissions)
    }

    pub async fn evaluate_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<NavSectionVisibility>, NavigationError> {
        let user_uuid =
            Uuid::parse_str(user_id).map_err(|e| NavigationError::InvalidUserId(e.to_string()))?;

        let definitions = default_navigation();
        let mut permission_set: HashSet<String> = HashSet::new();

        for section in &definitions {
            for item in &section.items {
                for permission in &item.required_permissions {
                    if permission_set.contains(permission) {
                        continue;
                    }
                    let allowed = self
                        .abac_service
                        .check_permission(user_uuid, permission, None, None, None)
                        .await
                        .map_err(|e| NavigationError::PermissionCheck(e.to_string()))?;
                    if allowed {
                        permission_set.insert(permission.clone());
                    }
                }
            }
        }

        Ok(evaluate_navigation(&definitions, &permission_set))
    }
}

fn normalize_permissions(permissions: &[String]) -> HashSet<String> {
    permissions.iter().cloned().collect()
}
