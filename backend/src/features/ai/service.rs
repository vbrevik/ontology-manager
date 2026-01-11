use async_openai::{
    types::{CreateChatCompletionRequestArgs, ChatCompletionRequestMessage, ChatCompletionRequestUserMessage, ChatCompletionRequestUserMessageContent},
    Client,
    config::OpenAIConfig,
};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct AiService {
    client: Client<OpenAIConfig>,
    model: String,
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
    pub fn new(api_base: String, model: String) -> Self {
        let config = OpenAIConfig::new()
            .with_api_base(api_base)
            .with_api_key("dummy"); 
        
        let client = Client::with_config(config);
        
        Self {
            client,
            model,
        }
    }

    pub async fn generate_text(&self, req: GenerateRequest) -> Result<GenerateResponse, String> {
        let request = CreateChatCompletionRequestArgs::default()
            .model(&self.model)
            .messages([
                ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
                     content: ChatCompletionRequestUserMessageContent::Text(req.prompt),
                     name: None,
                })
            ])
            .temperature(req.temperature.unwrap_or(0.7))
            .max_tokens(req.max_tokens.unwrap_or(1024))
            .build()
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let response = self.client.chat().create(request).await
            .map_err(|e| format!("AI Service Error: {}", e))?;

        let text = response.choices.first()
            .and_then(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(GenerateResponse { text })
    }

    pub async fn generate_class_description(&self, class_name: &str, properties: Option<Vec<String>>) -> Result<String, String> {
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

    pub async fn generate_role_suggestions(&self, context: &str) -> Result<String, String> {
        let prompt = format!(
            "Suggest 3-5 roles for a system with the following context: {}\n\n\
            For each role, provide:\n\
            1. Role Name\n\
            2. Concise Description\n\
            3. Recommended Permissions (comma separated list)\n\n\
            Respond ONLY with a JSON array of objects: [{{ \"name\": \"...\", \"description\": \"...\", \"permissions\": [...] }}]",
            context
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
}
