# RAG Pipeline Testing Guide

## Overview

This guide provides comprehensive testing procedures for the enhanced RAG pipeline with error handling and runtime debugging.

## Prerequisites

### 1. Environment Setup

```bash
cd /Users/erdincka/Applications/lawfirm-co/backend

# Ensure all dependencies are installed
pip install -r requirements.txt
```

### 2. Configuration

Configure embedding API in the admin interface:
- Embedding Endpoint: `https://api.openai.com/v1` or `http://localhost:11434/v1` (Ollama)
- Embedding API Key: Your API key
- Embedding Model: `text-embedding-ada-002` (OpenAI) or `nomic-embed-text` (Ollama)

## Unit Tests

### Test 1: RAGStatus Tracking

```python
import pytest
from app.rag_memory import RAGStatus, RAGPhase

def test_rag_status_success():
    """Test successful phase tracking"""
    status = RAGStatus()
    
    # Start phase
    status.log_phase_start(RAGPhase.CONTENT_PARSING, "Parsing test.pdf")
    assert RAGPhase.CONTENT_PARSING.value in status.phase_status
    assert status.phase_status[RAGPhase.CONTENT_PARSING.value]["status"] == "started"
    
    # Complete phase
    status.log_phase_success(
        RAGPhase.CONTENT_PARSING, 
        "Successfully parsed",
        {"pages": 5}
    )
    assert status.phase_status[RAGPhase.CONTENT_PARSING.value]["status"] == "success"
    assert status.phase_status[RAGPhase.CONTENT_PARSING.value]["metrics"]["pages"] == 5
    
    # Check summary
    summary = status.get_summary()
    assert summary["success"] == True
    assert len(summary["errors"]) == 0

def test_rag_status_error():
    """Test error tracking"""
    status = RAGStatus()
    
    status.log_phase_start(RAGPhase.EMBEDDING_GENERATION, "Generating embeddings")
    error = Exception("API key invalid")
    status.log_phase_error(RAGPhase.EMBEDDING_GENERATION, error, "Authentication failed")
    
    assert len(status.errors) == 1
    assert status.errors[0]["error_type"] == "Exception"
    assert "invalid" in status.errors[0]["error_message"]
    
    summary = status.get_summary()
    assert summary["success"] == False

def test_rag_status_warning():
    """Test warning tracking"""
    status = RAGStatus()
    
    status.log_warning(RAGPhase.CONTENT_PARSING, "Unknown file format")
    
    assert len(status.warnings) == 1
    assert "Unknown" in status.warnings[0]["message"]
    
    # Warnings don't affect success
    summary = status.get_summary()
    assert summary["success"] == True  # No errors
```

### Test 2: Text Extraction

```python
import pytest
from app.rag_memory import extract_text_from_content, RAGStatus

def test_extract_text_from_txt():
    """Test plain text extraction"""
    status = RAGStatus()
    content = b"This is a test document."
    
    text, success = extract_text_from_content(content, "test.txt", status)
    
    assert success == True
    assert text == "This is a test document."
    assert len(status.errors) == 0

def test_extract_text_from_pdf():
    """Test PDF extraction (requires pypdf)"""
    status = RAGStatus()
    
    # Create a simple PDF (you'll need a real PDF file for this)
    with open("test_document.pdf", "rb") as f:
        content = f.read()
    
    text, success = extract_text_from_content(content, "test.pdf", status)
    
    assert success == True
    assert len(text) > 0
    assert len(status.errors) == 0

def test_extract_text_corrupted():
    """Test handling of corrupted files"""
    status = RAGStatus()
    content = b"corrupted data that's not valid"
    
    text, success = extract_text_from_content(content, "test.pdf", status)
    
    # Should fail gracefully
    assert success == False
    assert len(status.errors) > 0

def test_extract_text_empty():
    """Test handling of empty content"""
    status = RAGStatus()
    content = b""
    
    text, success = extract_text_from_content(content, "test.txt", status)
    
    # Empty content should be handled
    assert text == ""
```

### Test 3: Text Chunking

```python
from app.rag_memory import chunk_text, RAGStatus

def test_chunk_text_basic():
    """Test basic text chunking"""
    status = RAGStatus()
    text = "This is a test. " * 100  # Create long text
    
    chunks = chunk_text(text, chunk_size=100, overlap=20, status=status)
    
    assert len(chunks) > 0
    assert all(len(chunk) <= 120 for chunk in chunks)  # Allow for overlap
    assert len(status.errors) == 0

def test_chunk_text_empty():
    """Test chunking empty text"""
    status = RAGStatus()
    
    chunks = chunk_text("", status=status)
    
    assert len(chunks) == 0
    assert len(status.warnings) > 0  # Should warn about empty text

def test_chunk_text_short():
    """Test chunking text shorter than chunk size"""
    status = RAGStatus()
    text = "Short text."
    
    chunks = chunk_text(text, chunk_size=500, status=status)
    
    assert len(chunks) == 1
    assert chunks[0] == "Short text."
```

### Test 4: Embedding Generation (Integration)

```python
import pytest
from app.rag_memory import generate_embeddings, RAGStatus

@pytest.mark.asyncio
async def test_generate_embeddings_success():
    """Test successful embedding generation"""
    status = RAGStatus()
    texts = ["This is a test.", "Another test sentence."]
    
    # Use your actual API credentials
    endpoint = "https://api.openai.com/v1"
    api_key = "your-api-key"
    model = "text-embedding-ada-002"
    
    embeddings = await generate_embeddings(texts, endpoint, api_key, model, status)
    
    assert embeddings.shape[0] == 2  # Two embeddings
    assert embeddings.shape[1] > 0  # Has dimension
    assert len(status.errors) == 0

@pytest.mark.asyncio
async def test_generate_embeddings_invalid_key():
    """Test handling of invalid API key"""
    status = RAGStatus()
    texts = ["Test"]
    
    endpoint = "https://api.openai.com/v1"
    api_key = "invalid-key"
    model = "text-embedding-ada-002"
    
    with pytest.raises(Exception) as exc_info:
        await generate_embeddings(texts, endpoint, api_key, model, status)
    
    assert len(status.errors) > 0
    assert "401" in str(exc_info.value) or "Unauthorized" in str(exc_info.value)
```

## Integration Tests

### Test 5: Complete RAG Pipeline

```python
import pytest
from app.rag_memory import build_rag_context

@pytest.mark.asyncio
async def test_rag_pipeline_success():
    """Test complete RAG pipeline"""
    query = "What is the main topic?"
    
    documents = [
        {
            "title": "test1.txt",
            "content": b"This document discusses artificial intelligence and machine learning.",
            "id": "doc1"
        },
        {
            "title": "test2.txt",
            "content": b"Machine learning is a subset of artificial intelligence.",
            "id": "doc2"
        }
    ]
    
    endpoint = "https://api.openai.com/v1"
    api_key = "your-api-key"
    model = "text-embedding-ada-002"
    
    context, chunks_used, status = await build_rag_context(
        query, documents, endpoint, api_key, model, top_k=3
    )
    
    assert chunks_used > 0
    assert len(context) > 0
    assert status["success"] == True
    assert len(status["errors"]) == 0

@pytest.mark.asyncio
async def test_rag_pipeline_partial_failure():
    """Test RAG pipeline with some failed documents"""
    query = "Test query"
    
    documents = [
        {
            "title": "good.txt",
            "content": b"Valid content here.",
            "id": "doc1"
        },
        {
            "title": "bad.pdf",
            "content": b"corrupted pdf data",
            "id": "doc2"
        }
    ]
    
    endpoint = "https://api.openai.com/v1"
    api_key = "your-api-key"
    model = "text-embedding-ada-002"
    
    context, chunks_used, status = await build_rag_context(
        query, documents, endpoint, api_key, model
    )
    
    # Should succeed with warnings
    assert status["success"] == True
    assert len(status["warnings"]) > 0
    assert chunks_used > 0  # At least one document worked

@pytest.mark.asyncio
async def test_rag_pipeline_no_documents():
    """Test RAG pipeline with no documents"""
    query = "Test query"
    documents = []
    
    endpoint = "https://api.openai.com/v1"
    api_key = "your-api-key"
    model = "text-embedding-ada-002"
    
    context, chunks_used, status = await build_rag_context(
        query, documents, endpoint, api_key, model
    )
    
    assert chunks_used == 0
    assert context == ""
    assert len(status["warnings"]) > 0
```

## Manual Testing

### Test 6: Chat Endpoint with RAG

#### Setup Test Data

```bash
# Create test case with documents
curl -X POST http://localhost:8000/api/admin/seed
```

#### Test 6.1: Basic RAG Query

```bash
curl -X POST http://localhost:8000/api/chat/cases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What evidence do we have?",
    "history": [],
    "model": "gpt-4"
  }'
```

**Expected:**
- Response includes relevant information from case documents
- `debug_info.rag_enabled` is `true`
- `debug_info.rag_chunks_used` > 0
- `debug_info.rag_status.success` is `true`

#### Test 6.2: RAG with Additional Documents

```bash
# First, encode a test file
base64 test_document.txt > encoded.txt

# Then send request
curl -X POST http://localhost:8000/api/chat/cases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analyze this document",
    "documents": [
      {
        "filename": "test_document.txt",
        "content": "'$(cat encoded.txt)'"
      }
    ]
  }'
```

**Expected:**
- Both database documents and uploaded document are processed
- `debug_info.additional_uploaded_documents` is 1
- RAG context includes content from all documents

#### Test 6.3: RAG with No Embedding API

```bash
# First, remove embedding configuration via admin page
# Then try chat

curl -X POST http://localhost:8000/api/chat/cases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test query"
  }'
```

**Expected:**
- Chat still works (fallback to no RAG)
- `debug_info.rag_enabled` is `false`
- `debug_info.rag_status.reason` is "Embedding API not configured"

### Test 7: Error Scenarios

#### Test 7.1: Invalid API Key

1. Configure invalid API key in admin
2. Send chat request
3. Check console output for error

**Expected:**
```
✗ EMBEDDING_GENERATION FAILED: Embedding API error (401): Unauthorized
```

#### Test 7.2: Corrupted PDF

1. Upload a corrupted PDF to a case
2. Send chat request
3. Check console and status

**Expected:**
```
⚠ CONTENT_PARSING: Failed to extract text from 'corrupted.pdf'
```

Status should show warning but pipeline continues.

#### Test 7.3: Network Timeout

1. Configure endpoint to non-existent server
2. Send chat request
3. Wait for timeout

**Expected:**
```
✗ EMBEDDING_GENERATION FAILED: Embedding API request timed out (60s)
```

## Performance Testing

### Test 8: Performance Benchmarks

```python
import time
import pytest
from app.rag_memory import build_rag_context

@pytest.mark.asyncio
async def test_performance_small_documents():
    """Test performance with small documents"""
    query = "Test query"
    
    # 3 small documents
    documents = [
        {"title": f"doc{i}.txt", "content": b"Small content " * 100, "id": f"doc{i}"}
        for i in range(3)
    ]
    
    start = time.time()
    context, chunks, status = await build_rag_context(
        query, documents, endpoint, api_key, model
    )
    elapsed = time.time() - start
    
    print(f"Small documents: {elapsed:.2f}s")
    assert elapsed < 5.0  # Should be fast
    assert status["total_elapsed_seconds"] < 5.0

@pytest.mark.asyncio
async def test_performance_large_documents():
    """Test performance with large documents"""
    query = "Test query"
    
    # 5 large documents
    documents = [
        {"title": f"doc{i}.txt", "content": b"Large content " * 10000, "id": f"doc{i}"}
        for i in range(5)
    ]
    
    start = time.time()
    context, chunks, status = await build_rag_context(
        query, documents, endpoint, api_key, model
    )
    elapsed = time.time() - start
    
    print(f"Large documents: {elapsed:.2f}s")
    print(f"Chunks created: {chunks}")
    
    # Check phase timings
    for phase, info in status["phases"].items():
        print(f"{phase}: {info.get('elapsed_seconds', 0):.2f}s")
```

## Monitoring and Logging

### Test 9: Console Output Validation

Run a chat request and verify console output includes:

```
============================================================
RAG PIPELINE EXECUTION
============================================================
Query: ...
Documents: N
Embedding Model: ...
Top-K: 5
============================================================

PHASE 1: Document Indexing
------------------------------------------------------------
  ▶ DOCUMENT_RETRIEVAL: Indexing N document(s)
  ...
  ✓ DOCUMENT_RETRIEVAL: Extracted X chunks from N/N documents (Xs)

PHASE 2: Similarity Search
------------------------------------------------------------
  ▶ SIMILARITY_SEARCH: Searching for top 5 relevant chunks
  ...
  ✓ SIMILARITY_SEARCH: Retrieved 5 relevant chunks (Xs)

PHASE 3: Context Building
------------------------------------------------------------
  ▶ CONTEXT_BUILDING: Building context from 5 chunks
  ...
  ✓ CONTEXT_BUILDING: Built context from 5 chunks (Xs)

============================================================
RAG PIPELINE SUMMARY
============================================================
Total Time: Xs
Success: True
Errors: 0
Warnings: 0
Chunks Retrieved: 5
Context Size: XXXX characters
============================================================
```

### Test 10: Status Information Validation

Verify `debug_info.rag_status` structure:

```python
def validate_rag_status(rag_status):
    """Validate RAG status structure"""
    assert "total_elapsed_seconds" in rag_status
    assert "success" in rag_status
    assert "phases" in rag_status
    assert "errors" in rag_status
    assert "warnings" in rag_status
    
    # Check each phase
    for phase_name, phase_info in rag_status["phases"].items():
        assert "status" in phase_info
        assert phase_info["status"] in ["started", "success", "failed"]
        
        if phase_info["status"] == "success":
            assert "elapsed_seconds" in phase_info
            assert "metrics" in phase_info
```

## Regression Testing

### Test 11: Backward Compatibility

Ensure existing functionality still works:

```bash
# Test chat without documents
curl -X POST http://localhost:8000/api/chat/cases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this case about?"
  }'

# Should work even without RAG
```

## Load Testing

### Test 12: Concurrent Requests

```python
import asyncio
import aiohttp

async def send_chat_request(session, case_id, message):
    async with session.post(
        f"http://localhost:8000/api/chat/cases/{case_id}",
        json={"message": message}
    ) as response:
        return await response.json()

async def test_concurrent_requests():
    """Test multiple concurrent RAG requests"""
    async with aiohttp.ClientSession() as session:
        tasks = [
            send_chat_request(session, 1, f"Query {i}")
            for i in range(10)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # All should succeed
        for result in results:
            assert "response" in result
            assert result.get("debug_info", {}).get("rag_enabled") is not None

# Run test
asyncio.run(test_concurrent_requests())
```

## Test Checklist

- [ ] Unit tests pass for all components
- [ ] Integration tests pass for complete pipeline
- [ ] Manual testing covers all scenarios
- [ ] Error handling works for all failure modes
- [ ] Performance is acceptable (< 10s for typical case)
- [ ] Console output is clear and helpful
- [ ] Status information is complete and accurate
- [ ] Documentation is up to date
- [ ] Backward compatibility maintained
- [ ] Load testing shows acceptable performance

## Running All Tests

```bash
# Install pytest if not already installed
pip install pytest pytest-asyncio aiohttp

# Run all tests
pytest tests/test_rag_pipeline.py -v

# Run with coverage
pytest tests/test_rag_pipeline.py --cov=app.rag_memory --cov-report=html

# Run specific test
pytest tests/test_rag_pipeline.py::test_rag_status_success -v
```

## Troubleshooting Tests

### Issue: Tests fail with "No module named 'pypdf'"

**Solution:**
```bash
pip install pypdf
```

### Issue: Tests fail with API errors

**Solution:**
- Check API key is valid
- Verify network connectivity
- Check API rate limits

### Issue: Tests are slow

**Solution:**
- Use smaller test documents
- Reduce number of test cases
- Mock API calls for unit tests

## Continuous Integration

### GitHub Actions Example

```yaml
name: RAG Pipeline Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.10'
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-asyncio
    
    - name: Run tests
      env:
        EMBEDDING_API_KEY: ${{ secrets.EMBEDDING_API_KEY }}
      run: |
        pytest tests/test_rag_pipeline.py -v
```

## Conclusion

This testing guide provides comprehensive coverage of the RAG pipeline functionality, including:
- ✅ Unit tests for individual components
- ✅ Integration tests for complete pipeline
- ✅ Manual testing procedures
- ✅ Error scenario testing
- ✅ Performance testing
- ✅ Load testing
- ✅ Monitoring validation

Follow this guide to ensure the RAG pipeline works correctly and handles all error scenarios gracefully.
