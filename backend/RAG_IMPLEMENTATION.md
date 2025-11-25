# RAG Pipeline Implementation with Comprehensive Error Handling

## Overview

This document describes the enhanced RAG (Retrieval-Augmented Generation) pipeline implementation with comprehensive error handling and runtime debugging capabilities.

## Architecture

The RAG pipeline consists of the following phases:

1. **Document Retrieval** - Loading documents from the database
2. **Content Parsing** - Extracting text from various document formats (TXT, PDF, RTF, etc.)
3. **Text Chunking** - Splitting documents into manageable chunks with overlap
4. **Embedding Generation** - Creating vector embeddings via API
5. **Similarity Search** - Finding most relevant chunks for the query
6. **Context Building** - Assembling the final context for the LLM

## Key Features

### 1. Comprehensive Error Handling

Each phase of the RAG pipeline includes:
- **Try-catch blocks** to handle unexpected errors
- **Specific error types** for different failure scenarios
- **Graceful degradation** - continues processing even if some documents fail
- **Error aggregation** - collects all errors for reporting

### 2. Runtime Debugging

The `RAGStatus` class tracks:
- **Phase execution** - start time, end time, elapsed time
- **Success/failure status** for each phase
- **Detailed metrics** - chunk counts, embedding dimensions, similarity scores
- **Warnings** - non-fatal issues like unsupported formats
- **Comprehensive summary** - overall pipeline health

### 3. User Feedback

Users receive detailed feedback on:
- ✅ **Successful operations** with metrics
- ❌ **Failed operations** with error messages
- ⚠️ **Warnings** for partial failures
- 📊 **Performance metrics** - timing, chunk counts, relevance scores

## Document Format Support

### Supported Formats

| Format | Extension | Library | Error Handling |
|--------|-----------|---------|----------------|
| Plain Text | .txt, .md, .log | Built-in | UTF-8 decode with fallback |
| CSV | .csv | Built-in | UTF-8 decode |
| JSON | .json | Built-in | UTF-8 decode |
| XML/HTML | .xml, .html | Built-in | UTF-8 decode |
| PDF | .pdf | pypdf | Page-by-page extraction with progress |
| RTF | .rtf | striprtf | Fallback to plain text if library missing |

### Error Handling by Format

#### Plain Text Files
```python
try:
    text = content.decode('utf-8', errors='ignore')
    # Success logging
except Exception as e:
    # Error logging with specific format info
    return "", False
```

#### PDF Files
```python
try:
    reader = pypdf.PdfReader(pdf_file)
    # Process each page with progress tracking
    for i, page in enumerate(reader.pages):
        # Log progress every 10 pages
        if (i + 1) % 10 == 0:
            print(f"Processed {i + 1}/{num_pages} pages")
except ImportError:
    # Library not available
except Exception as e:
    # PDF-specific errors (corrupted, encrypted, etc.)
```

#### RTF Files
```python
try:
    from striprtf.striprtf import rtf_to_text
    extracted = rtf_to_text(text)
except ImportError:
    # Fallback to basic decode
    text = content.decode('utf-8', errors='ignore')
except Exception:
    # RTF parsing failed, try fallback
```

## RAG Pipeline Execution Flow

### Phase 1: Document Indexing

```
▶ DOCUMENT_RETRIEVAL: Indexing N document(s)
  [1/N] Processing: document1.pdf
    ▶ CONTENT_PARSING: Parsing 'document1.pdf' (format: pdf, size: 12345 bytes)
      PDF has 5 page(s)
    ✓ CONTENT_PARSING: Successfully extracted PDF (5 pages) (0.45s)
    ▶ TEXT_CHUNKING: Chunking text (5432 chars, chunk_size=500, overlap=50)
    ✓ TEXT_CHUNKING: Created 12 chunks (0.02s)
        Extracted 5432 characters
        Created 12 chunk(s)
✓ DOCUMENT_RETRIEVAL: Extracted 12 chunks from 1/1 documents (0.47s)
```

### Phase 2: Embedding Generation

```
▶ EMBEDDING_GENERATION: Generating embeddings for 12 text(s) using model 'text-embedding-ada-002'
      Endpoint: https://api.openai.com/v1/embeddings
      Model: text-embedding-ada-002
      Texts to embed: 12
✓ EMBEDDING_GENERATION: Generated 12 embeddings (1.23s)
```

### Phase 3: Similarity Search

```
▶ SIMILARITY_SEARCH: Searching for top 5 relevant chunks
      Searching across 12 chunks
      Similarity scores range: 0.876 to 0.234
✓ SIMILARITY_SEARCH: Retrieved 5 relevant chunks (0.15s)
```

### Phase 4: Context Building

```
▶ CONTEXT_BUILDING: Building context from 5 chunks
  [1] document1.pdf: 487 chars (score: 0.876)
  [2] document1.pdf: 492 chars (score: 0.834)
  [3] document1.pdf: 501 chars (score: 0.789)
  [4] document1.pdf: 478 chars (score: 0.756)
  [5] document1.pdf: 495 chars (score: 0.723)
✓ CONTEXT_BUILDING: Built context from 5 chunks (0.01s)
```

### Final Summary

```
============================================================
RAG PIPELINE SUMMARY
============================================================
Total Time: 1.86s
Success: True
Errors: 0
Warnings: 0
Chunks Retrieved: 5
Context Size: 2453 characters
============================================================
```

## Error Scenarios and Handling

### Scenario 1: Embedding API Not Configured

```
⚠ Embedding API not configured - skipping RAG
  Configure embedding_endpoint and embedding_api_key in settings

rag_status: {
    "enabled": false,
    "reason": "Embedding API not configured"
}
```

### Scenario 2: Document Parsing Failure

```
✗ CONTENT_PARSING FAILED: pypdf library not available - cannot process PDF files

rag_status: {
    "phases": {
        "content_parsing": {
            "status": "failed",
            "error": {
                "phase": "content_parsing",
                "error_type": "ImportError",
                "error_message": "No module named 'pypdf'"
            }
        }
    },
    "errors": [...]
}
```

### Scenario 3: Embedding API Error

```
✗ EMBEDDING_GENERATION FAILED: Embedding API error (401): Unauthorized

rag_status: {
    "phases": {
        "embedding_generation": {
            "status": "failed",
            "error": {
                "phase": "embedding_generation",
                "error_type": "Exception",
                "error_message": "Embedding API error (401): Unauthorized"
            }
        }
    }
}
```

### Scenario 4: Partial Document Failure

```
⚠ DOCUMENT_RETRIEVAL: Failed to extract text from 'corrupted.pdf'
✓ DOCUMENT_RETRIEVAL: Extracted 8 chunks from 2/3 documents (0.52s)

rag_status: {
    "warnings": [
        {
            "phase": "document_retrieval",
            "message": "Failed to extract text from 'corrupted.pdf'"
        }
    ],
    "success": true  # Pipeline continues with remaining documents
}
```

## Status Information Structure

The `rag_status` object returned in `debug_info` contains:

```json
{
    "total_elapsed_seconds": 1.86,
    "success": true,
    "phases": {
        "document_retrieval": {
            "status": "success",
            "start_time": "2025-11-25T22:30:00",
            "end_time": "2025-11-25T22:30:00.47",
            "elapsed_seconds": 0.47,
            "details": "Extracted 12 chunks from 1/1 documents",
            "metrics": {
                "total_chunks": 12,
                "successful_documents": 1,
                "failed_documents": 0
            }
        },
        "embedding_generation": {
            "status": "success",
            "elapsed_seconds": 1.23,
            "metrics": {
                "num_embeddings": 12,
                "embedding_dimension": 1536,
                "model": "text-embedding-ada-002"
            }
        },
        "similarity_search": {
            "status": "success",
            "elapsed_seconds": 0.15,
            "metrics": {
                "num_results": 5,
                "top_score": 0.876,
                "avg_score": 0.796
            }
        },
        "context_building": {
            "status": "success",
            "elapsed_seconds": 0.01,
            "metrics": {
                "num_chunks": 5,
                "total_characters": 2453,
                "avg_chunk_size": 490
            }
        }
    },
    "errors": [],
    "warnings": []
}
```

## Integration with Chat Endpoint

The chat endpoint (`/chat/cases/{case_id}`) automatically:

1. **Loads case documents** from the database
2. **Accepts additional documents** via the request (optional)
3. **Processes all documents** through the RAG pipeline
4. **Includes RAG context** in the LLM prompt
5. **Returns status information** in `debug_info`

### Example Request

```json
{
    "message": "What evidence do we have?",
    "history": [],
    "model": "gpt-4",
    "documents": [
        {
            "filename": "witness_statement.txt",
            "content": "base64_encoded_content..."
        }
    ]
}
```

### Example Response

```json
{
    "response": "Based on the case documents...",
    "context_used": true,
    "debug_info": {
        "model": "gpt-4",
        "rag_enabled": true,
        "rag_chunks_used": 5,
        "rag_status": {
            "total_elapsed_seconds": 1.86,
            "success": true,
            "phases": { ... },
            "errors": [],
            "warnings": []
        }
    }
}
```

## Monitoring and Debugging

### Console Output

All RAG operations are logged to the console with:
- Clear phase markers (▶, ✓, ✗, ⚠)
- Detailed progress information
- Timing metrics
- Error messages with context

### Debug Info

The `debug_info` field in the response contains:
- Complete RAG pipeline status
- Phase-by-phase execution details
- All errors and warnings
- Performance metrics

### Log Files

Standard Python logging is used:
```python
logger.info(f"[RAG] Phase {phase} started: {details}")
logger.error(f"[RAG] Phase {phase} failed: {error}")
logger.warning(f"[RAG] Warning in {phase}: {message}")
```

## Best Practices

### 1. Error Recovery

- Always check `rag_status.success` before relying on RAG results
- Use `rag_status.errors` to diagnose failures
- Check `rag_status.warnings` for partial failures

### 2. Performance Monitoring

- Monitor `total_elapsed_seconds` for performance issues
- Check individual phase timings in `phases[phase].elapsed_seconds`
- Track `embedding_generation` time as it's usually the slowest

### 3. Configuration Validation

- Ensure embedding API is configured before enabling RAG
- Test with small documents first
- Verify supported document formats

### 4. User Communication

- Display warnings to users for partial failures
- Show clear error messages for complete failures
- Provide fallback behavior when RAG is unavailable

## Troubleshooting

### Issue: "Embedding API not configured"

**Solution:** Configure in Admin settings:
- Set `embedding_endpoint`
- Set `embedding_api_key`
- Set `embedding_model` (optional)

### Issue: "No chunks created from documents"

**Possible causes:**
- Unsupported document format
- Empty documents
- Parsing errors

**Solution:** Check `rag_status.warnings` for specific document failures

### Issue: "Embedding API error (401)"

**Solution:** Verify API key is correct and has proper permissions

### Issue: Slow performance

**Check:**
- Number of documents being processed
- Document sizes
- Embedding API response time
- Network latency

## Future Enhancements

1. **Caching** - Cache embeddings for frequently accessed documents
2. **Batch processing** - Process multiple documents in parallel
3. **Progressive loading** - Stream results as they become available
4. **Format detection** - Auto-detect document format from content
5. **OCR support** - Extract text from images in PDFs
6. **Metadata extraction** - Extract and index document metadata

## Conclusion

This RAG implementation provides:
- ✅ Comprehensive error handling at every phase
- ✅ Detailed runtime debugging information
- ✅ User-friendly feedback on success and failures
- ✅ Support for multiple document formats
- ✅ Graceful degradation on partial failures
- ✅ Complete visibility into pipeline execution

Users can now confidently use the RAG pipeline knowing they'll receive clear feedback on what's happening at each step and detailed error information if anything goes wrong.
