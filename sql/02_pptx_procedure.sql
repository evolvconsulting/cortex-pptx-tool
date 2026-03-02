-- STEP 2: CREATE_PPTX_FROM_JSON Procedure
-- Replace placeholders: {{DATABASE}}, {{SCHEMA}}, {{WAREHOUSE}}

USE DATABASE {{DATABASE}};
USE SCHEMA {{SCHEMA}};
USE WAREHOUSE {{WAREHOUSE}};

CREATE OR REPLACE PROCEDURE CREATE_PPTX_FROM_JSON(INPUT_JSON VARCHAR)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'create_pptx'
EXECUTE AS OWNER
AS '
import base64
import json
import tempfile
import os
from datetime import datetime
from snowflake.snowpark import Session

def create_pptx(session: Session, input_json: str) -> dict:
    result = {
        "success": False, 
        "pptx_path": None, 
        "slide_count": 0, 
        "qa_passed": False, 
        "warnings": None, 
        "error": None
    }
    
    try:
        params = json.loads(input_json)
        slides = params.get(''slides'', [])
        filename = params.get(''filename'', ''presentation'')
        strict_validation = params.get(''strictValidation'', False)
        
        if not slides:
            result["error"] = "No slides provided"
            return result
        
        if filename.endswith(''.pptx''):
            filename = filename[:-5]
        
        timestamp = datetime.now().strftime(''%Y%m%d_%H%M%S'')
        filename = f''{filename}_{timestamp}.pptx''
        
        config = {
            "slides": slides, 
            "options": {"layout": "LAYOUT_16x9"},
            "strictValidation": strict_validation
        }
        
        convert_result = session.sql(
            "SELECT CONVERT_HTML_TO_PPTX(PARSE_JSON(?)) AS result",
            params=[json.dumps(config)]
        ).collect()[0]["RESULT"]
        
        result_dict = json.loads(convert_result) if isinstance(convert_result, str) else convert_result
        
        if result_dict.get("error"):
            result["error"] = f"Conversion error: {result_dict.get(''error'')}"
            return result
        
        output = result_dict.get("output", {})
        base64_pptx = output.get("base64")
        warnings = output.get("warnings")
        
        if not base64_pptx:
            result["error"] = "No PPTX data returned from service"
            return result
        
        stage = "@{{DATABASE}}.{{SCHEMA}}.PPTX_OUTPUT_STAGE"
        temp_dir = tempfile.mkdtemp()
        path = os.path.join(temp_dir, filename)
        
        with open(path, "wb") as f:
            f.write(base64.b64decode(base64_pptx))
        
        session.file.put(path, stage, auto_compress=False, overwrite=True)
        os.unlink(path)
        
        result["pptx_path"] = f"{stage}/{filename}"
        result["slide_count"] = len(slides)
        result["warnings"] = warnings
        result["qa_passed"] = True
        result["success"] = True
        return result
        
    except Exception as e:
        result["error"] = str(e)
        return result
';

SELECT '02_pptx_procedure.sql completed' AS status;
