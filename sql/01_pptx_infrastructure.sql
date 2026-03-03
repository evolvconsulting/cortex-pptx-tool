-- STEP 1: PPTX Generator Infrastructure (SPCS)
-- Replace placeholders: {{DATABASE}}, {{SCHEMA}}, {{WAREHOUSE}}, {{EAI}}, {{IMAGE_PATH}}

USE DATABASE {{DATABASE}};
USE SCHEMA {{SCHEMA}};
USE WAREHOUSE {{WAREHOUSE}};

CREATE COMPUTE POOL IF NOT EXISTS PPTX_GENERATOR_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS
    AUTO_SUSPEND_SECS = 300
    AUTO_RESUME = TRUE
    COMMENT = 'Compute pool for PPTX Generator Service';

CREATE IMAGE REPOSITORY IF NOT EXISTS {{DATABASE}}.{{SCHEMA}}.PPTX_GENERATOR_REPO
    COMMENT = 'Docker image repository for HTML2PPTX service';

-- Get repository URL: SHOW IMAGE REPOSITORIES LIKE 'PPTX_GENERATOR_REPO';

CREATE STAGE IF NOT EXISTS {{DATABASE}}.{{SCHEMA}}.PPTX_OUTPUT_STAGE
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for generated presentations';

-- Push Docker image first, then update IMAGE_PATH
CREATE SERVICE IF NOT EXISTS {{DATABASE}}.{{SCHEMA}}.PPTX_GENERATOR_SERVICE
    IN COMPUTE POOL {{DATABASE}}.{{SCHEMA}}.PPTX_GENERATOR_POOL
    EXTERNAL_ACCESS_INTEGRATIONS = ({{EAI}})
    MIN_INSTANCES = 1
    MAX_INSTANCES = 1
    AUTO_RESUME = TRUE
    FROM SPECIFICATION $$
spec:
  containers:
  - name: "html2pptx"
    image: "{{IMAGE_PATH}}/html2pptx:1.0.0"
    env:
      NODE_ENV: "production"
      PORT: "8080"
    resources:
      limits:
        memory: "4G"
        cpu: "1"
      requests:
        memory: "2G"
        cpu: "1"
  endpoints:
  - name: "api"
    port: 8080
    public: false
  networkPolicyConfig:
    allowInternetEgress: true
$$;

CREATE OR REPLACE FUNCTION CONVERT_HTML_TO_PPTX(CONFIG VARIANT)
    RETURNS VARIANT
    SERVICE = PPTX_GENERATOR_SERVICE
    SERVICE ENDPOINT = 'api'
    AS '/convert';

SELECT '01_pptx_infrastructure.sql completed' AS status;
