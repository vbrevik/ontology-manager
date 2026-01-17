use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestMessage, ChatCompletionRequestUserMessage,
        ChatCompletionRequestUserMessageContent, CreateChatCompletionRequestArgs,
    },
    Client,
};
use serde::{Deserialize, Serialize};

use sqlx::{Pool, Postgres, Row};

#[derive(Clone)]
pub struct AiService {
    pool: Pool<Postgres>,
    fallback_url: String,
    fallback_model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub text: String,
}

impl AiService {
    pub fn new(pool: Pool<Postgres>, fallback_url: String, fallback_model: String) -> Self {
        Self {
            pool,
            fallback_url,
            fallback_model,
        }
    }

    pub fn pool(&self) -> &Pool<Postgres> {
        &self.pool
    }

    fn normalize_api_base(api_base: &str) -> String {
        let base = api_base.trim_end_matches('/');
        if base.ends_with("/v1") {
            base.to_string()
        } else {
            format!("{}/v1", base)
        }
    }

    pub async fn get_config(&self) -> (String, String) {
        // Optional env override for containerized deployments.
        if std::env::var("AI_PREFER_ENV")
            .map(|v| v == "true")
            .unwrap_or(false)
        {
            return (
                Self::normalize_api_base(&self.fallback_url),
                self.fallback_model.clone(),
            );
        }

        // Find active AiProvider entity
        let result = sqlx::query(
            r#"
            SELECT e.attributes 
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'AiProvider' 
              AND (e.attributes->>'is_active')::boolean = true
              AND e.deleted_at IS NULL
            LIMIT 1
            "#,
        )
        .fetch_optional(&self.pool)
        .await;

        match result {
            Ok(Some(row)) => {
                let attrs: serde_json::Value = row.get("attributes");
                let url = attrs
                    .get("api_base")
                    .and_then(|v| v.as_str())
                    .map(Self::normalize_api_base)
                    .unwrap_or_else(|| Self::normalize_api_base(&self.fallback_url));
                let model = attrs
                    .get("model_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&self.fallback_model)
                    .to_string();
                (url, model)
            }
            _ => (
                Self::normalize_api_base(&self.fallback_url),
                self.fallback_model.clone(),
            ),
        }
    }

    fn get_client(&self, api_base: String) -> Client<OpenAIConfig> {
        let config = OpenAIConfig::new()
            .with_api_base(api_base)
            .with_api_key("dummy");

        Client::with_config(config)
    }

    pub async fn check_health(&self) -> Result<serde_json::Value, String> {
        let (api_base, model) = self.get_config().await;
        self.check_provider_health(&api_base, &model).await
    }

    async fn check_provider_health(
        &self,
        api_base: &str,
        model: &str,
    ) -> Result<serde_json::Value, String> {
        // Simple check to see if we can reach the base URL
        let health_url = format!("{}/api/tags", api_base.trim_end_matches("/v1"));
        let res = reqwest::get(&health_url).await;

        match res {
            Ok(resp) if resp.status().is_success() => Ok(serde_json::json!({
                "status": "Healthy",
                "model": model,
                "provider_url": api_base
            })),
            Ok(resp) => Err(format!("AI Provider Degraded: HTTP {}", resp.status())),
            Err(e) => Err(format!("AI Provider Unreachable: {}", e)),
        }
    }

    pub async fn start_background_health_check(self) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                if let Err(e) = self.run_health_checks().await {
                    tracing::error!("Failed to run background AI health checks: {}", e);
                }
            }
        });
    }

    async fn run_health_checks(&self) -> Result<(), String> {
        // Fetch all AiProvider entities
        let providers = sqlx::query(
            r#"
            SELECT e.id, e.attributes 
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'AiProvider' 
              AND e.deleted_at IS NULL
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        for row in providers {
            let id: uuid::Uuid = row.get("id");
            let mut attrs: serde_json::Value = row.get("attributes");

            let api_base = attrs
                .get("api_base")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let model = attrs
                .get("model_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if api_base.is_empty() {
                continue;
            }

            let status = match self.check_provider_health(&api_base, &model).await {
                Ok(_) => "Healthy",
                Err(_) => "Unhealthy",
            };

            // Update status in attributes if it changed
            if attrs.get("status").and_then(|v| v.as_str()) != Some(status) {
                if let Some(obj) = attrs.as_object_mut() {
                    obj.insert(
                        "status".to_string(),
                        serde_json::Value::String(status.to_string()),
                    );

                    sqlx::query(
                        "UPDATE entities SET attributes = $1, updated_at = NOW() WHERE id = $2",
                    )
                    .bind(&attrs)
                    .bind(id)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                }
            }
        }

        Ok(())
    }

    pub async fn list_models(&self) -> Result<Vec<String>, String> {
        let (api_base, _) = self.get_config().await;
        let health_url = format!("{}/api/tags", api_base.trim_end_matches("/v1"));

        let res = reqwest::get(&health_url)
            .await
            .map_err(|e| format!("Failed to fetch models: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Failed to fetch models: HTTP {}", res.status()));
        }

        let body: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse models JSON: {}", e))?;

        let mut models = Vec::new();
        if let Some(models_array) = body.get("models").and_then(|m| m.as_array()) {
            for m in models_array {
                if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                    models.push(name.to_string());
                }
            }
        }

        Ok(models)
    }

    pub async fn generate_text(&self, req: GenerateRequest) -> Result<GenerateResponse, String> {
        let (api_base, model) = self.get_config().await;
        let client = self.get_client(api_base);

        let request = CreateChatCompletionRequestArgs::default()
            .model(&model)
            .messages([ChatCompletionRequestMessage::User(
                ChatCompletionRequestUserMessage {
                    content: ChatCompletionRequestUserMessageContent::Text(req.prompt),
                    name: None,
                },
            )])
            .temperature(req.temperature.unwrap_or(0.7))
            .max_tokens(req.max_tokens.unwrap_or(1024))
            .build()
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let response = client
            .chat()
            .create(request)
            .await
            .map_err(|e| format!("AI Service Error: {}", e))?;

        let text = response
            .choices
            .first()
            .and_then(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(GenerateResponse { text })
    }

    pub async fn generate_class_description(
        &self,
        class_name: &str,
        properties: Option<Vec<String>>,
    ) -> Result<String, String> {
        let properties_text = match properties {
            Some(props) if !props.is_empty() => format!("\nProperties: {}", props.join(", ")),
            _ => String::new(),
        };

        let prompt = format!(
            "Generate a concise, professional description for an ontology class with the following details:\n\
            \n\
            Class Name: {}{}\n\
            \n\
            The description should:\n\
            - Be 1-2 sentences\n\
            - Explain what this class represents\n\
            - Be suitable for technical documentation\n\
            - Use present tense\n\
            \n\
            Respond with only the description, no additional commentary.",
            class_name, properties_text
        );

        let request = GenerateRequest {
            prompt,
            temperature: Some(0.7),
            max_tokens: Some(150),
        };

        let response = self.generate_text(request).await?;
        Ok(response.text.trim().to_string())
    }

    pub async fn generate_role_suggestions(
        &self,
        context: &str,
        permissions: &[String],
        existing_roles: &[String],
    ) -> Result<String, String> {
        let permissions_list = if permissions.is_empty() {
            "None defined yet".to_string()
        } else {
            permissions.join(", ")
        };

        let roles_list = if existing_roles.is_empty() {
            "None defined yet".to_string()
        } else {
            existing_roles.join(", ")
        };

        let prompt = format!(
            "Suggest 3-5 roles for a system with the following context: {}\n\n\
            Current System Permissions: {}\n\
            Current System Roles: {}\n\n\
            For each role, provide:\n\
            1. Role Name\n\
            2. Concise Description\n\
            3. Recommended Permissions (pick from Current System Permissions if applicable, or suggest new ones)\n\n\
            Respond ONLY with a JSON array of objects: [{{ \"name\": \"...\", \"description\": \"...\", \"permissions\": [...] }}]",
            context, permissions_list, roles_list
        );

        let request = GenerateRequest {
            prompt,
            temperature: Some(0.7),
            max_tokens: Some(500),
        };

        let response = self.generate_text(request).await?;
        Ok(response.text.trim().to_string())
    }

    pub async fn generate_ontology_suggestions(&self, domain: &str) -> Result<String, String> {
        let prompt = format!(
            "Suggest a basic ontology structure for the domain: {}\n\n\
            Provide 3-5 core classes. For each class, provide:\n\
            1. Class Name\n\
            2. Description\n\
            3. Key Properties (name and type)\n\n\
            Respond ONLY with a JSON array of objects: [{{ \"name\": \"...\", \"description\": \"...\", \"properties\": [{{ \"name\": \"...\", \"type\": \"...\" }}] }}]",
            domain
        );

        let request = GenerateRequest {
            prompt,
            temperature: Some(0.7),
            max_tokens: Some(800),
        };

        let response = self.generate_text(request).await?;
        Ok(response.text.trim().to_string())
    }

    pub async fn generate_context_suggestions(&self, scenario: &str) -> Result<String, String> {
        let prompt = format!(
            "Based on the following scenario, suggest 3-5 specific 'Context' entities to track.\n\
            Scenario: {}\n\n\
            For each context, provide:\n\
            1. Display Name\n\
            2. Description\n\
            3. Context Type (one of: PoliticalContext, CrisisContext, OperationalContext, EnvironmentalContext)\n\
            4. Estimated Start Time (ISO8601 or 'Now')\n\
            5. Estimated End Time (ISO8601 or 'Ongoing')\n\
            6. Spatial Scope (Country, Region, or GeoJSON coordinates if applicable)\n\
            7. Confidence Level (0.0 to 1.0)\n\n\
            Respond ONLY with a JSON array of objects: [\n\
              {{\n\
                \"display_name\": \"...\",\n\
                \"description\": \"...\",\n\
                \"class_name\": \"...\",\n\
                \"attributes\": {{\n\
                  \"start_time\": \"...\",\n\
                  \"end_time\": \"...\",\n\
                  \"spatial_scope\": \"...\",\n\
                  \"confidence\": 0.8\n\
                }}\n\
              }}\n\
            ]",
            scenario
        );

        let request = GenerateRequest {
            prompt,
            temperature: Some(0.7),
            max_tokens: Some(1000),
        };

        let response = self.generate_text(request).await?;
        Ok(response.text.trim().to_string())
    }
}
