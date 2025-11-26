# RAG Pipeline Implementation

## Overview

This implementation provides a simple, efficient, in-memory RAG (Retrieval-Augmented Generation) pipeline for demo purposes. It allows you to upload documents with chat queries, extract relevant information using semantic search, and provide context-aware responses.

## Architecture

### Components

1. **Document Processing** (`rag_memory.py`)
   - Text extraction from multiple formats
   - Intelligent text chunking with overlap
   - Embedding generation using sentence-transformers
   - Cosine similarity-based retrieval

2. **Chat Integration** (`routers_chat.py`)
   - Accepts documents with chat requests
   - Processes documents through RAG pipeline
   - Augments LLM context with relevant chunks

3. **API Schema** (`schemas_chat.py`)
   - Extended ChatRequest to support document uploads
   - Documents sent as base64-encoded content

## Supported Document Formats

### Text-based (Direct UTF-8 Decoding)
- `.txt` - Plain text files
- `.md` - Markdown files
- `.log` - Log files
- `.csv` - CSV files
- `.json` - JSON files
- `.xml` - XML files
- `.html` - HTML files

### Binary Formats (Library-based Extraction)
- `.pdf` - PDF documents (using `pypdf`)
- `.rtf` - Rich Text Format (using `striprtf`)

## How It Works

### 1. Document Upload
Documents are sent with the chat request as base64-encoded content:

```json
{
  "message": "What are the key terms in the contract?",
  "documents": [
    {
      "filename": "contract.pdf",
      "content": "base64_encoded_content_here"
    }
  ]
}
```

### 2. Text Extraction
Based on file extension, the appropriate extraction method is used:
- Text files: UTF-8 decoding
- PDFs: pypdf library extracts text from all pages
- RTF: striprtf library converts to plain text

### 3. Chunking
Text is split into overlapping chunks:
- **Default chunk size**: 500 characters
- **Overlap**: 50 characters
- **Smart boundaries**: Attempts to break at sentence endings

### 4. Embedding Generation
Uses `all-MiniLM-L6-v2` model from sentence-transformers:
- **Fast**: Optimized for speed
- **Efficient**: Small model size (~80MB)
- **Quality**: Good semantic understanding
- **Dimensions**: 384-dimensional embeddings

### 5. Similarity Search
- Query is embedded using the same model
- Cosine similarity calculated against all chunk embeddings
- Top-k most relevant chunks retrieved (default: 5)

### 6. Context Augmentation
Retrieved chunks are formatted and added to the system prompt:

```
# RELEVANT DOCUMENT EXCERPTS
The following excerpts were retrieved from uploaded documents as most relevant to the query:

--- Document: contract.pdf (Relevance: 0.85) ---
[chunk content]

--- Document: contract.pdf (Relevance: 0.78) ---
[chunk content]
```

## Performance Characteristics

### Memory Usage
- **Embedding Model**: ~80MB (loaded once, shared across requests)
- **Per Document**: ~4 bytes per character + embedding overhead
- **Embeddings**: 384 floats × 4 bytes = 1.5KB per chunk

### Speed
- **Text Extraction**: Near-instant for text formats, <1s for PDFs
- **Chunking**: O(n) where n is document length
- **Embedding**: ~50-100 chunks/second on CPU
- **Retrieval**: O(k×n) where k=top_k, n=total chunks (very fast for <1000 chunks)

### Scalability
This implementation is designed for **demo/prototype use**:
- ✅ Good for: 1-10 documents, <100 pages total
- ⚠️ Acceptable for: 10-50 documents, <500 pages
- ❌ Not suitable for: Production with 100+ documents or real-time requirements

For production, consider:
- Vector databases (Pinecone, Weaviate, Qdrant)
- Persistent storage
- Batch processing
- Caching strategies

## Configuration

### Chunk Size Tuning
Adjust in `rag_memory.py`:

```python
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50):
```

**Guidelines**:
- Smaller chunks (200-300): Better precision, more chunks
- Larger chunks (500-800): Better context, fewer chunks
- Overlap (10-20%): Prevents information loss at boundaries

### Top-K Results
Adjust in `routers_chat.py`:

```python
rag_context, chunks_used = rag_memory.build_rag_context(
    query=chat_request.message,
    documents=rag_documents,
    top_k=5  # Increase for more context
)
```

**Guidelines**:
- top_k=3: Focused, minimal context
- top_k=5: Balanced (recommended)
- top_k=10: Comprehensive, may include less relevant chunks

## Testing

Run the test script to verify functionality:

```bash
cd backend
python test_rag.py
```

Tests include:
- Text extraction from various formats
- Chunking with overlap
- Complete RAG pipeline
- InMemoryRAG class functionality

## API Usage Example

### Using cURL

```bash
# Encode document to base64
CONTENT=$(base64 -i document.pdf)

# Send chat request with document
curl -X POST "http://localhost:8000/chat/cases/1" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize the key points in this document",
    "documents": [
      {
        "filename": "document.pdf",
        "content": "'$CONTENT'"
      }
    ]
  }'
```

### Using Python

```python
import requests
import base64

# Read and encode document
with open('document.pdf', 'rb') as f:
    content = base64.b64encode(f.read()).decode('utf-8')

# Send request
response = requests.post(
    'http://localhost:8000/chat/cases/1',
    json={
        'message': 'What are the main arguments in this document?',
        'documents': [
            {
                'filename': 'document.pdf',
                'content': content
            }
        ]
    }
)

result = response.json()
print(result['response'])
print(f"Used {result['debug_info']['chunks_used']} chunks")
```

## Dependencies

Added to `requirements.txt`:

```
sentence-transformers==2.3.1  # Embedding model
pypdf==4.0.1                  # PDF extraction
striprtf==0.0.26              # RTF extraction
```

Install with:

```bash
pip install -r requirements.txt
```

## Best Practices

### 1. Document Quality
- Use searchable PDFs (not scanned images)
- Clean, well-formatted text works best
- Remove unnecessary headers/footers if possible

### 2. Query Formulation
- Be specific in queries
- Use keywords from the domain
- Ask focused questions rather than broad ones

### 3. Chunk Size Selection
- Legal documents: 500-700 characters (paragraph-level)
- Technical docs: 300-500 characters (section-level)
- Conversational text: 200-400 characters (message-level)

### 4. Error Handling
- The pipeline gracefully handles extraction errors
- Failed documents are skipped, not blocking the request
- Check `debug_info` for processing statistics

## Limitations

1. **No Persistence**: Embeddings are regenerated for each request
2. **No Caching**: Same documents re-processed every time
3. **Memory Bound**: All embeddings stored in RAM
4. **CPU-based**: No GPU acceleration (for simplicity)
5. **Single-threaded**: Sequential processing of documents

## Future Enhancements

For production deployment, consider:

1. **Vector Database Integration**
   - Persistent storage of embeddings
   - Efficient similarity search at scale
   - Support for metadata filtering

2. **Advanced Chunking**
   - Semantic chunking (split by topics)
   - Hierarchical chunking (summaries + details)
   - Document structure awareness

3. **Hybrid Search**
   - Combine semantic and keyword search
   - BM25 + vector similarity
   - Reranking with cross-encoders

4. **Caching**
   - Cache document embeddings by hash
   - Cache query results
   - Incremental updates

5. **Monitoring**
   - Track retrieval quality metrics
   - Log slow queries
   - Monitor embedding model performance

## Troubleshooting

### Issue: "No chunks retrieved"
- Check document format is supported
- Verify base64 encoding is correct
- Ensure document contains extractable text

### Issue: "Irrelevant chunks returned"
- Adjust chunk_size (try smaller chunks)
- Increase top_k to see more options
- Rephrase query to be more specific

### Issue: "Slow performance"
- Reduce number of documents
- Decrease chunk count (larger chunks)
- Consider GPU acceleration for embeddings

### Issue: "Out of memory"
- Process fewer documents per request
- Increase chunk_size to reduce chunk count
- Use streaming for large documents

## License

This implementation is part of the lawfirm-co application.
