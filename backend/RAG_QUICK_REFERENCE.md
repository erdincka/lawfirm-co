# RAG Pipeline Quick Reference Guide

## Setup

### 1. Configure Embedding API (Admin Page)

Navigate to the Admin page and configure:

```
Embedding Endpoint URL: https://api.openai.com/v1
Embedding API Token: sk-your-api-key-here
Embedding Model: text-embedding-ada-002
```

Or use Ollama locally:
```
Embedding Endpoint URL: http://localhost:11434/v1
Embedding API Token: (leave empty or use any value)
Embedding Model: nomic-embed-text
```

### 2. Add Documents to Cases

Documents are automatically processed when:
- Stored in the database (via the `documents` table)
- Uploaded with chat requests (optional)

## Using RAG in Chat

### Automatic Mode (Recommended)

Simply send a chat request - RAG automatically processes all case documents:

```javascript
POST /api/chat/cases/{case_id}
{
    "message": "What evidence supports the fraud claim?",
    "history": [],
    "model": "gpt-4"
}
```

### With Additional Documents

Upload extra documents with your query:

```javascript
POST /api/chat/cases/{case_id}
{
    "message": "Compare this with the witness statement",
    "documents": [
        {
            "filename": "new_evidence.pdf",
            "content": "base64_encoded_content"
        }
    ]
}
```

## Understanding the Response

### Success Response

```json
{
    "response": "Based on the documents...",
    "context_used": true,
    "debug_info": {
        "rag_enabled": true,
        "rag_chunks_used": 5,
        "rag_status": {
            "total_elapsed_seconds": 1.86,
            "success": true,
            "phases": {
                "document_retrieval": { "status": "success", ... },
                "embedding_generation": { "status": "success", ... },
                "similarity_search": { "status": "success", ... },
                "context_building": { "status": "success", ... }
            },
            "errors": [],
            "warnings": []
        }
    }
}
```

### Partial Failure Response

```json
{
    "response": "Based on available documents...",
    "debug_info": {
        "rag_enabled": true,
        "rag_chunks_used": 3,
        "rag_status": {
            "success": true,
            "warnings": [
                {
                    "phase": "document_retrieval",
                    "message": "Failed to extract text from 'corrupted.pdf'"
                }
            ]
        }
    }
}
```

### Complete Failure Response

```json
{
    "response": "...",
    "debug_info": {
        "rag_enabled": false,
        "rag_status": {
            "enabled": false,
            "reason": "Embedding API not configured"
        }
    }
}
```

## Console Output Examples

### Successful Execution

```
============================================================
RAG PIPELINE EXECUTION
============================================================
Query: What evidence supports the fraud claim?
Documents: 3
Embedding Model: text-embedding-ada-002
Top-K: 5
============================================================

PHASE 1: Document Indexing
------------------------------------------------------------
  ▶ DOCUMENT_RETRIEVAL: Indexing 3 document(s)
    [1/3] Processing: financial_records.pdf
      ▶ CONTENT_PARSING: Parsing 'financial_records.pdf' (format: pdf, size: 45678 bytes)
        PDF has 12 page(s)
      ✓ CONTENT_PARSING: Successfully extracted PDF (12 pages) (0.89s)
      ▶ TEXT_CHUNKING: Chunking text (15432 chars, chunk_size=500, overlap=50)
      ✓ TEXT_CHUNKING: Created 32 chunks (0.05s)
        Extracted 15432 characters
        Created 32 chunk(s)
  ✓ DOCUMENT_RETRIEVAL: Extracted 87 chunks from 3/3 documents (2.34s)

    Generating embeddings for 87 chunks...
  ▶ EMBEDDING_GENERATION: Generating embeddings for 87 text(s) using model 'text-embedding-ada-002'
      Endpoint: https://api.openai.com/v1/embeddings
      Model: text-embedding-ada-002
      Texts to embed: 87
  ✓ EMBEDDING_GENERATION: Generated 87 embeddings (3.45s)

PHASE 2: Similarity Search
------------------------------------------------------------
  ▶ SIMILARITY_SEARCH: Searching for top 5 relevant chunks
      Searching across 87 chunks
      Similarity scores range: 0.892 to 0.123
  ✓ SIMILARITY_SEARCH: Retrieved 5 relevant chunks (0.23s)

PHASE 3: Context Building
------------------------------------------------------------
  ▶ CONTEXT_BUILDING: Building context from 5 chunks
  [1] financial_records.pdf: 498 chars (score: 0.892)
  [2] witness_statement.txt: 487 chars (score: 0.876)
  [3] financial_records.pdf: 501 chars (score: 0.834)
  [4] email_thread.txt: 492 chars (score: 0.789)
  [5] financial_records.pdf: 495 chars (score: 0.756)
  ✓ CONTEXT_BUILDING: Built context from 5 chunks (0.02s)

============================================================
RAG PIPELINE SUMMARY
============================================================
Total Time: 6.04s
Success: True
Errors: 0
Warnings: 0
Chunks Retrieved: 5
Context Size: 2473 characters
============================================================
```

### With Warnings

```
PHASE 1: Document Indexing
------------------------------------------------------------
  ▶ DOCUMENT_RETRIEVAL: Indexing 3 document(s)
    [1/3] Processing: document1.pdf
      ✓ Successfully processed
    [2/3] Processing: corrupted.pdf
      ✗ CONTENT_PARSING FAILED: PDF extraction failed: File is encrypted
    [3/3] Processing: document3.txt
      ✓ Successfully processed
  ⚠ DOCUMENT_RETRIEVAL: Failed to extract text from 'corrupted.pdf'
  ✓ DOCUMENT_RETRIEVAL: Extracted 45 chunks from 2/3 documents (1.23s)

============================================================
RAG PIPELINE SUMMARY
============================================================
Total Time: 3.45s
Success: True
Errors: 0
Warnings: 1
Chunks Retrieved: 5
Context Size: 2156 characters
Failed Documents: corrupted.pdf
============================================================
```

### Complete Failure

```
⚠ Embedding API not configured - skipping RAG
  Configure embedding_endpoint and embedding_api_key in settings
```

## Debugging Tips

### Check RAG Status

Always inspect `debug_info.rag_status` to understand what happened:

```javascript
const response = await fetch('/api/chat/cases/1', { ... });
const data = await response.json();

console.log('RAG Enabled:', data.debug_info.rag_enabled);
console.log('Chunks Used:', data.debug_info.rag_chunks_used);
console.log('RAG Status:', data.debug_info.rag_status);

if (!data.debug_info.rag_status.success) {
    console.error('RAG Errors:', data.debug_info.rag_status.errors);
}

if (data.debug_info.rag_status.warnings?.length > 0) {
    console.warn('RAG Warnings:', data.debug_info.rag_status.warnings);
}
```

### Monitor Performance

```javascript
const ragStatus = data.debug_info.rag_status;

console.log('Total Time:', ragStatus.total_elapsed_seconds, 's');

// Check individual phase timings
Object.entries(ragStatus.phases).forEach(([phase, info]) => {
    console.log(`${phase}:`, info.elapsed_seconds, 's');
});
```

### Identify Failed Documents

```javascript
const warnings = data.debug_info.rag_status.warnings || [];
const failedDocs = warnings
    .filter(w => w.message.includes('Failed to extract'))
    .map(w => w.message);

console.log('Failed Documents:', failedDocs);
```

## Common Issues

### Issue: RAG Not Working

**Check:**
1. Is embedding API configured? (Admin page)
2. Are there documents in the case?
3. Check console output for errors

**Solution:**
```javascript
if (!data.debug_info.rag_enabled) {
    const reason = data.debug_info.rag_status.reason;
    console.log('RAG disabled:', reason);
    // Show user-friendly message
}
```

### Issue: Slow Performance

**Check:**
- `rag_status.total_elapsed_seconds`
- `phases.embedding_generation.elapsed_seconds` (usually slowest)
- Number of chunks being processed

**Optimize:**
- Reduce `top_k` value (default: 5)
- Process fewer documents
- Use faster embedding model

### Issue: Poor Relevance

**Check:**
- `similarity_search.metrics.top_score` (should be > 0.7)
- `similarity_search.metrics.avg_score`

**Improve:**
- Rephrase query to be more specific
- Add more relevant documents
- Try different embedding model

## Performance Benchmarks

Typical timings (will vary based on API and network):

| Phase | Time | Notes |
|-------|------|-------|
| Document Parsing (PDF) | 0.5-2s | Per document, depends on pages |
| Text Chunking | 0.01-0.1s | Very fast |
| Embedding Generation | 1-5s | Depends on API and chunk count |
| Similarity Search | 0.1-0.5s | Depends on total chunks |
| Context Building | 0.01s | Very fast |

**Total:** 2-8 seconds for typical case with 3-5 documents

## Best Practices

### 1. Document Management

- Keep documents under 50 pages for faster processing
- Use text formats when possible (faster than PDF)
- Remove duplicate documents

### 2. Query Optimization

- Be specific in queries
- Use keywords from documents
- Ask focused questions

### 3. Error Handling

```javascript
try {
    const response = await chatWithCase(caseId, message);
    
    if (!response.debug_info.rag_enabled) {
        showWarning('Document search unavailable');
    }
    
    if (response.debug_info.rag_status.warnings?.length > 0) {
        showWarning('Some documents could not be processed');
    }
    
    return response.response;
} catch (error) {
    showError('Chat failed:', error);
}
```

### 4. User Communication

Show users:
- ✅ When RAG is active: "Searching 5 documents..."
- ⚠️ When partially working: "2 of 5 documents processed"
- ❌ When disabled: "Document search unavailable"

## Advanced Usage

### Custom Top-K

Modify in `routers_chat.py`:

```python
rag_context, chunks_used, rag_status = await rag_memory.build_rag_context(
    query=chat_request.message,
    documents=rag_documents,
    endpoint=emb_endpoint,
    api_key=emb_api_key,
    model=emb_model,
    top_k=10  # Retrieve more chunks
)
```

### Custom Chunk Size

Modify in `rag_memory.py`:

```python
chunks = chunk_text(
    text, 
    chunk_size=1000,  # Larger chunks
    overlap=100,      # More overlap
    status=self.status
)
```

## Support

For issues or questions:
1. Check console output for detailed error messages
2. Review `rag_status` in debug_info
3. Consult RAG_IMPLEMENTATION.md for detailed documentation
4. Check backend logs for Python exceptions
