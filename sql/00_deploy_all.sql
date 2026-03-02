-- MASTER DEPLOYMENT SCRIPT
-- Deploys PPTX Generator Agent for Snowflake Cortex
--
-- Replace placeholders: {{DATABASE}}, {{SCHEMA}}, {{WAREHOUSE}}, {{ROLE}}
--
-- Deployment Order:
-- 1. 01_pptx_infrastructure.sql
-- 2. 02_pptx_procedure.sql
-- 3. 03_pptx_generator_agent.sql
-- 4. 04_multi_agent_bridge.sql (update RSA key first!)

USE ROLE {{ROLE}};
USE DATABASE {{DATABASE}};
USE SCHEMA {{SCHEMA}};
USE WAREHOUSE {{WAREHOUSE}};

SELECT CURRENT_ROLE() AS role, 
       CURRENT_DATABASE() AS database,
       CURRENT_SCHEMA() AS schema,
       CURRENT_WAREHOUSE() AS warehouse;

-- POST-DEPLOYMENT VERIFICATION
SHOW AGENTS IN SCHEMA {{SCHEMA}};
SHOW PROCEDURES LIKE '%PPTX%' IN SCHEMA {{SCHEMA}};
SHOW USER FUNCTIONS LIKE '%PPTX%' IN SCHEMA {{SCHEMA}};
SELECT SYSTEM$GET_SERVICE_STATUS('PPTX_GENERATOR_SERVICE') AS service_status;
LIST @PPTX_OUTPUT_STAGE;

SELECT 'Deployment complete!' AS status;
