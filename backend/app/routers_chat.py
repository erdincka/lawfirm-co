from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import httpx
from . import database, models, models_settings, schemas_chat

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_llm_config(db: Session):
    """Retrieve LLM configuration from settings"""
    endpoint = db.query(models_settings.SystemSetting).filter(
        models_settings.SystemSetting.key == "llm_endpoint"
    ).first()
    api_key = db.query(models_settings.SystemSetting).filter(
        models_settings.SystemSetting.key == "llm_api_key"
    ).first()
    
    if not endpoint or not api_key:
        return None, None
    
    return endpoint.value, api_key.value

def is_readable_format(content_type: str) -> bool:
    """Check if content type is readable text format"""
    if not content_type:
        return False
    
    readable_types = [
        'text/plain', 'text/html', 'text/xml', 'text/csv',
        'application/json', 'application/xml', 'application/javascript',
        'application/x-yaml', 'text/markdown', 'text/css'
    ]
    return content_type.lower() in readable_types

def extract_text_content(file_data, content_type: str) -> str:
    """Extract text from file data if it's a readable format"""
    try:
        # Convert memoryview to bytes if needed
        if isinstance(file_data, memoryview):
            file_data = file_data.tobytes()
        
        # Decode to text
        return file_data.decode('utf-8', errors='ignore')
    except Exception as e:
        return f"[Error reading content: {str(e)}]"

def build_case_context(case: models.Case) -> tuple[str, list[str]]:
    """
    Build comprehensive context from case data
    Returns: (context_string, non_readable_documents)
    """
    context = f"""# CASE INFORMATION
Title: {case.title}
Status: {case.status}
Type: {case.case_type}
Defendant: {case.defendant_name}
Date Opened: {case.date_opened}
Description: {case.description}

# LEAD ATTORNEY
Name: {case.lead_attorney.full_name if case.lead_attorney else 'Unassigned'}
Email: {case.lead_attorney.email if case.lead_attorney else 'N/A'}
Specialization: {case.lead_attorney.specialization if case.lead_attorney else 'N/A'}

# EVIDENCE ({len(case.evidence)} items)
"""
    for i, ev in enumerate(case.evidence, 1):
        context += f"\n{i}. [{ev.evidence_type}] {ev.description}"
        context += f"\n   Location: {ev.location_found}"
        context += f"\n   Collected: {ev.collected_date}\n"
    
    # Process documents
    context += f"\n# DOCUMENTS ({len(case.documents)} items)\n"
    non_readable_docs = []
    
    for i, doc in enumerate(case.documents, 1):
        context += f"\n{i}. {doc.title}"
        context += f"\n   Created: {doc.created_date}"
        
        # Check if document has readable content
        if doc.file_data and doc.content_type:
            if is_readable_format(doc.content_type):
                # Include the actual content
                text_content = extract_text_content(doc.file_data, doc.content_type)
                # # Limit content to avoid token overflow (max 2000 chars per doc)
                # if len(text_content) > 2000:
                #     text_content = text_content[:2000] + "\n... [content truncated]"
                context += f"\n   Content Type: {doc.content_type}"
                context += f"\n   Content:\n{text_content}\n"
            else:
                # Track non-readable documents
                non_readable_docs.append(f"{doc.title} ({doc.content_type})")
                context += f"\n   Content Type: {doc.content_type} (binary - not included)\n"
        elif doc.content:
            # Use the content field if available
            content_preview = doc.content[:2000] if len(doc.content) > 2000 else doc.content
            if len(doc.content) > 2000:
                content_preview += "\n... [content truncated]"
            context += f"\n   Content:\n{content_preview}\n"
        else:
            context += "\n   (No content available)\n"
    
    return context, non_readable_docs

async def detect_vlm_capability(llm_endpoint: str, api_key: str, model: str) -> bool:
    """Detect if the model supports vision (VLM)"""
    # Common VLM model patterns
    vlm_patterns = [
        'vision', 'vlm', 'vl-',  # Generic vision patterns
        'gpt-4-turbo', 'gpt-4o', 'gpt-4-vision',  # OpenAI
        'claude-3', 'claude-3-opus', 'claude-3-sonnet',  # Anthropic
        'gemini-pro-vision', 'gemini-1.5',  # Google
        'qwen-vl', 'qwen2-vl', 'qwen2.5-vl',  # Qwen vision models
        'llava', 'bakllava',  # LLaVA models
        'cogvlm', 'internvl', 'minicpm-v'  # Other VLMs
    ]
    model_lower = model.lower()
    return any(pattern in model_lower for pattern in vlm_patterns)

async def get_available_models(llm_endpoint: str, api_key: str):
    """Query LLM endpoint for available models"""
    try:
        if llm_endpoint.endswith("/"):
            llm_endpoint = llm_endpoint[:-1]
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{llm_endpoint}/v1/models",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                # Extract model IDs from response
                if "data" in result:
                    return [model["id"] for model in result["data"]]
                return []
            return []
    except Exception as e:
        print(f"Error fetching models: {e}")
        return []

@router.get("/models")
async def list_available_models(db: Session = Depends(get_db)):
    """Get list of available LLM models"""
    llm_endpoint, api_key = get_llm_config(db)
    if not llm_endpoint or not api_key:
        raise HTTPException(
            status_code=503, 
            detail="LLM endpoint not configured. Please configure in Admin."
        )
    
    models = await get_available_models(llm_endpoint, api_key)
    
    if not models:
        # Fallback to common models if endpoint doesn't support /v1/models
        models = ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"]
    
    return {
        "models": models,
        "default": models[0] if models else None
    }

@router.post("/cases/{case_id}")
async def chat_with_case(
    case_id: int,
    chat_request: schemas_chat.ChatRequest,
    db: Session = Depends(get_db)
):
    """Chat endpoint with case context"""
    # Get case data
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get LLM configuration
    llm_endpoint, api_key = get_llm_config(db)
    if not llm_endpoint or not api_key:
        raise HTTPException(
            status_code=503, 
            detail="LLM endpoint not configured. Please configure in Admin."
        )
    
    # Get available models and select one
    model_to_use = chat_request.model
    if not model_to_use:
        available_models = await get_available_models(llm_endpoint, api_key)
        if available_models:
            model_to_use = available_models[0]
        else:
            model_to_use = "gpt-4"
    
    # Detect if model supports vision
    is_vlm = await detect_vlm_capability(llm_endpoint, api_key, model_to_use)
    
    # Build case context
    case_context, non_readable_docs = build_case_context(case)
    
    # Prepare system message
    system_content = f"""You are a legal assistant helping prosecutors analyze case details.

{case_context}

Provide accurate, professional responses based on this case data. If asked about information not in the case files, clearly state that."""
    
    # Add notification about non-readable documents if any
    notification = ""
    if non_readable_docs:
        notification = "\n\n**Note:** The following documents contain binary/non-text content and were not included in the context:\n"
        for doc_name in non_readable_docs:
            notification += f"- {doc_name}\n"
    
    # Prepare messages for LLM
    # Only use special Qwen format if it's actually a VLM model AND we have visual content
    # For text-only queries, use standard format even for Qwen models
    use_qwen_format = 'qwen' in model_to_use.lower() and is_vlm
    
    if use_qwen_format:
        # Qwen VLM format: no system role, context in user message
        messages = []
        
        # Add conversation history
        for msg in chat_request.history:
            messages.append({"role": msg.role, "content": msg.content})
        
        # Combine system context with user message for Qwen
        combined_message = f"{system_content}\n\n---\n\nUser Question: {chat_request.message}"
        messages.append({"role": "user", "content": combined_message})
    else:
        # Standard format with system role (works for most models including Qwen for text-only)
        messages = [{"role": "system", "content": system_content}]
        
        # Add conversation history
        for msg in chat_request.history:
            messages.append({"role": msg.role, "content": msg.content})
        
        # Add current user message
        messages.append({"role": "user", "content": chat_request.message})
    
    # Call LLM API
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{llm_endpoint}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_to_use,
                    "messages": messages,
                    "temperature": 0.0,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                print(f"LLM API Error: {error_detail}")
                raise HTTPException(
                    status_code=502,
                    detail=f"LLM API error ({response.status_code}): {error_detail}"
                )
            
            result = response.json()
            
            # Check if response has choices
            if not result.get("choices") or len(result["choices"]) == 0:
                raise HTTPException(
                    status_code=502,
                    detail=f"LLM returned empty response: {result}"
                )
            
            assistant_message = result["choices"][0]["message"]["content"]
            
            if not assistant_message:
                raise HTTPException(
                    status_code=502,
                    detail="LLM returned empty message content"
                )
            
            # Append notification about non-readable documents
            if notification:
                assistant_message += notification
            
            # Build debug information
            debug_info = {
                "model": model_to_use,
                "is_vlm": is_vlm,
                "system_message": system_content,
                "evidence_count": len(case.evidence),
                "total_documents": len(case.documents),
                "non_readable_documents": non_readable_docs,
                "message_count": len(messages),
                "total_tokens_estimate": len(str(messages)) // 4
            }
            
            return {
                "response": assistant_message,
                "case_id": case_id,
                "model_used": model_to_use,
                "debug_info": debug_info
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with LLM: {str(e)}")
