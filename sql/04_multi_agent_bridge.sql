-- STEP 4: Multi-Agent Bridge (Key-Pair Authentication)
-- Replace placeholders: {{DATABASE}}, {{SCHEMA}}, {{WAREHOUSE}}, {{ROLE}}, {{ACCOUNT}}, {{ACCOUNT_URL}}
--
-- PRE-REQUISITES: Generate RSA Key Pair (run locally)
-- openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
-- openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub

USE DATABASE {{DATABASE}};
USE SCHEMA {{SCHEMA}};
USE WAREHOUSE {{WAREHOUSE}};

-- REQUIRED: Run as ACCOUNTADMIN first
/*
USE ROLE ACCOUNTADMIN;

CREATE USER IF NOT EXISTS PPTX_SERVICE_USER
    TYPE = SERVICE
    COMMENT = 'Service account for PPTX multi-agent bridge';

ALTER USER PPTX_SERVICE_USER SET RSA_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE';
GRANT ROLE {{ROLE}} TO USER PPTX_SERVICE_USER;
ALTER USER PPTX_SERVICE_USER SET DEFAULT_ROLE = '{{ROLE}}';
*/

CREATE OR REPLACE NETWORK RULE PPTX_AGENT_EGRESS_RULE
    MODE = EGRESS
    TYPE = HOST_PORT
    VALUE_LIST = ('{{ACCOUNT_URL}}:443')
    COMMENT = 'Allow egress to Snowflake API';

-- Replace with your actual private key
CREATE OR REPLACE SECRET PPTX_KEYPAIR_SECRET
    TYPE = GENERIC_STRING
    SECRET_STRING = '-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----'
    COMMENT = 'RSA private key for JWT generation';

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION PPTX_AGENT_EXTERNAL_ACCESS
    ALLOWED_NETWORK_RULES = (PPTX_AGENT_EGRESS_RULE)
    ALLOWED_AUTHENTICATION_SECRETS = ALL
    ENABLED = TRUE
    COMMENT = 'External access for PPTX multi-agent bridge';

GRANT READ ON SECRET PPTX_KEYPAIR_SECRET TO ROLE {{ROLE}};
GRANT USAGE ON INTEGRATION PPTX_AGENT_EXTERNAL_ACCESS TO ROLE {{ROLE}};

CREATE OR REPLACE FUNCTION ASK_PPTX_AGENT(USER_QUERY VARCHAR)
    RETURNS VARCHAR
    LANGUAGE PYTHON
    RUNTIME_VERSION = '3.11'
    HANDLER = 'run_agent'
    EXTERNAL_ACCESS_INTEGRATIONS = (PPTX_AGENT_EXTERNAL_ACCESS)
    SECRETS = ('private_key' = PPTX_KEYPAIR_SECRET)
    PACKAGES = ('requests', 'pyjwt', 'cryptography')
AS
$$
import requests
import json
import jwt
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import _snowflake

SNOWFLAKE_ACCOUNT = "{{ACCOUNT}}"
SERVICE_USER = "PPTX_SERVICE_USER"
AGENT_URL = "https://{{ACCOUNT_URL}}/api/v2/databases/{{DATABASE}}/schemas/{{SCHEMA}}/agents/PPTX_GENERATOR_AGENT:run"

def get_public_key_fingerprint(private_key_pem: str) -> str:
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=None,
        backend=default_backend()
    )
    public_key_der = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    sha256_hash = hashlib.sha256(public_key_der).digest()
    fingerprint = base64.b64encode(sha256_hash).decode('utf-8')
    return f"SHA256:{fingerprint}"

def generate_jwt_token(private_key_pem: str, account: str, user: str) -> str:
    account_clean = account.upper()
    if '.' in account_clean and '.global' not in account_clean:
        account_clean = account_clean.split('.')[0]
    
    user_clean = user.upper()
    qualified_username = f"{account_clean}.{user_clean}"
    fingerprint = get_public_key_fingerprint(private_key_pem)
    
    now = datetime.now(timezone.utc)
    payload = {
        "iss": f"{qualified_username}.{fingerprint}",
        "sub": qualified_username,
        "iat": now,
        "exp": now + timedelta(minutes=59)
    }
    
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=None,
        backend=default_backend()
    )
    return jwt.encode(payload, private_key, algorithm="RS256")

def run_agent(user_query: str) -> str:
    try:
        private_key_pem = _snowflake.get_generic_secret_string('private_key')
        jwt_token = generate_jwt_token(private_key_pem, SNOWFLAKE_ACCOUNT, SERVICE_USER)
        
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "X-Snowflake-Authorization-Token-Type": "KEYPAIR_JWT",
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        }
        
        payload = {
            "messages": [{"role": "user", "content": [{"type": "text", "text": user_query}]}]
        }
        
        response = requests.post(AGENT_URL, headers=headers, json=payload, stream=True, timeout=300)
        
        if response.status_code != 200:
            return f"API Error {response.status_code}: {response.text[:500]}"
        
        final_answer = []
        current_event = None
        
        for line in response.iter_lines():
            if not line:
                continue
            decoded_line = line.decode('utf-8')
            
            if decoded_line.startswith('event: '):
                current_event = decoded_line[7:].strip()
            
            if decoded_line.startswith('data: '):
                data_str = decoded_line[6:]
                if data_str == '[DONE]':
                    break
                try:
                    data = json.loads(data_str)
                    if current_event == 'response.text.delta' and 'text' in data:
                        final_answer.append(data['text'])
                except json.JSONDecodeError:
                    continue
        
        return "".join(final_answer) if final_answer else "Agent returned no text content."
        
    except Exception as e:
        return f"Error: {str(e)}"
$$;

CREATE OR REPLACE PROCEDURE CALL_PPTX_AGENT_EXTERNAL(USER_QUERY VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    result STRING;
BEGIN
    SELECT ASK_PPTX_AGENT(:user_query) INTO :result;
    RETURN result;
END;
$$;

SELECT '04_multi_agent_bridge.sql completed' AS status;
