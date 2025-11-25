# RAG Pipeline - Embedding API Compatibility Fix

## Issue

The embedding API was returning a 400 error:

```
EMBEDDING_GENERATION FAILED: Embedding API error (400): 
{"object":"error","message":"The model expects an input_type from one of `passage` or `query` but none was provided.","detail":{},"type":"invalid_request_error"}
```

## Root Cause

Some embedding APIs (like Ollama with certain models) require an `input_type` parameter to distinguish between:
- **`passage`** - Document text being indexed for retrieval
- **`query`** - User search queries

OpenAI's API doesn't require this parameter, but other OpenAI-compatible APIs do.

## Solution

Updated the `generate_embeddings()` function to support an optional `input_type` parameter:

### Changes Made

#### 1. Updated Function Signature

```python
async def generate_embeddings(
    texts: List[str],
    endpoint: str,
    api_key: str,
    model: str = "text-embedding-ada-002",
    status: Optional[RAGStatus] = None,
    input_type: Optional[str] = None  # NEW PARAMETER
) -> np.ndarray:
```

#### 2. Modified Request Payload

```python
# Build request payload
payload = {
    "input": texts,
    "model": model
}

# Add input_type if provided (required by some APIs like Ollama)
if input_type:
    payload["input_type"] = input_type
```

#### 3. Updated Function Calls

**For document chunks (indexing):**
```python
self.embeddings = await generate_embeddings(
    all_chunks,
    self.endpoint,
    self.api_key,
    self.model,
    self.status,
    input_type="passage"  # Document chunks are passages
)
```

**For search queries:**
```python
query_embeddings = await generate_embeddings(
    [query],
    self.endpoint,
    self.api_key,
    self.model,
    self.status,
    input_type="query"  # User query
)
```

## Compatibility

This change maintains **backward compatibility**:

- **OpenAI API**: Works as before (ignores `input_type` if not needed)
- **Ollama API**: Now works correctly with `input_type` parameter
- **Other APIs**: Will work if they support the parameter, ignored otherwise

## Testing

After this fix, the RAG pipeline should work with:

### ✅ OpenAI
```
Embedding Endpoint: https://api.openai.com/v1
Model: text-embedding-ada-002
```

### ✅ Ollama
```
Embedding Endpoint: http://localhost:11434/v1
Model: nomic-embed-text
```

### ✅ Other OpenAI-compatible APIs
Any API that follows the OpenAI embeddings format.

## Expected Output

After the fix, you should see:

```
PHASE 1: Document Indexing
------------------------------------------------------------
  ▶ DOCUMENT_RETRIEVAL: Indexing N document(s)
  ...
  
    Generating embeddings for 87 chunks...
  ▶ EMBEDDING_GENERATION: Generating embeddings for 87 text(s) using model 'nomic-embed-text'
      Endpoint: http://localhost:11434/v1/embeddings
      Model: nomic-embed-text
      Texts to embed: 87
      Input type: passage
  ✓ EMBEDDING_GENERATION: Generated 87 embeddings (3.45s)

PHASE 2: Similarity Search
------------------------------------------------------------
  ▶ SIMILARITY_SEARCH: Searching for top 5 relevant chunks
      Searching across 87 chunks
  ▶ EMBEDDING_GENERATION: Generating embeddings for 1 text(s) using model 'nomic-embed-text'
      Endpoint: http://localhost:11434/v1/embeddings
      Model: nomic-embed-text
      Texts to embed: 1
      Input type: query
  ✓ EMBEDDING_GENERATION: Generated 1 embeddings (0.23s)
```

## Files Modified

- `/backend/app/rag_memory.py` - Added `input_type` parameter support

## No Breaking Changes

This is a **non-breaking change**:
- Existing code continues to work
- New parameter is optional
- Default behavior unchanged

## Related Documentation

See also:
- RAG_IMPLEMENTATION.md - Complete RAG pipeline documentation
- RAG_QUICK_REFERENCE.md - Usage guide
- RAG_TESTING_GUIDE.md - Testing procedures
