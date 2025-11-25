# RAG Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAG PIPELINE EXECUTION FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DOCUMENT RETRIEVAL                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │   Database   │────────▶│ Case Docs    │────────▶│  Document    │        │
│  │  Documents   │         │  (N items)   │         │    List      │        │
│  └──────────────┘         └──────────────┘         └──────┬───────┘        │
│                                                            │                │
│  ┌──────────────┐         ┌──────────────┐                │                │
│  │   Uploaded   │────────▶│  Additional  │────────────────┘                │
│  │  Documents   │         │  Docs (M)    │                                 │
│  └──────────────┘         └──────────────┘                                 │
│                                                                              │
│  Status Tracking:                                                           │
│  ✓ Number of documents loaded                                               │
│  ✓ Document IDs and titles                                                  │
│  ✗ Database access errors                                                   │
│  ⚠ Empty document list                                                      │
│                                                                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: CONTENT PARSING                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  For Each Document:                                                         │
│                                                                              │
│  ┌──────────────┐                                                           │
│  │  Document    │                                                           │
│  │   (bytes)    │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ├─────▶ .txt, .md, .log ────▶ UTF-8 Decode ────────┐               │
│         │                                                   │               │
│         ├─────▶ .pdf ────▶ pypdf.PdfReader ────────────────┤               │
│         │                  (page by page)                   │               │
│         │                                                   │               │
│         ├─────▶ .rtf ────▶ striprtf.rtf_to_text ───────────┤               │
│         │                  (with fallback)                  │               │
│         │                                                   │               │
│         └─────▶ unknown ──▶ UTF-8 Decode (attempt) ────────┤               │
│                                                             │               │
│                                                             ▼               │
│                                                    ┌─────────────────┐      │
│                                                    │  Extracted Text │      │
│                                                    │   (or error)    │      │
│                                                    └────────┬────────┘      │
│                                                             │               │
│  Status Tracking:                                          │               │
│  ✓ Format detected                                         │               │
│  ✓ Text length extracted                                   │               │
│  ✓ Pages processed (for PDF)                               │               │
│  ✗ Unsupported format                                      │               │
│  ✗ Corrupted file                                          │               │
│  ✗ Encrypted PDF                                           │               │
│  ✗ Missing library (pypdf, striprtf)                       │               │
│  ⚠ Empty content                                           │               │
│  ⚠ Unknown format (attempted decode)                       │               │
│                                                             │               │
└─────────────────────────────────────────────────────────────┼───────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: TEXT CHUNKING                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ Extracted    │                                                           │
│  │    Text      │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────┐                               │
│  │  Clean whitespace (regex)                │                               │
│  └──────────────┬───────────────────────────┘                               │
│                 │                                                            │
│                 ▼                                                            │
│  ┌──────────────────────────────────────────┐                               │
│  │  Split into chunks:                      │                               │
│  │  - Size: 500 chars (configurable)        │                               │
│  │  - Overlap: 50 chars (configurable)      │                               │
│  │  - Break at sentence boundaries          │                               │
│  └──────────────┬───────────────────────────┘                               │
│                 │                                                            │
│                 ▼                                                            │
│  ┌──────────────────────────────────────────┐                               │
│  │  Chunk 1: "Lorem ipsum dolor..."         │                               │
│  │  Chunk 2: "...sit amet consectetur..."   │                               │
│  │  Chunk 3: "...adipiscing elit sed..."    │                               │
│  │  ...                                      │                               │
│  └──────────────┬───────────────────────────┘                               │
│                 │                                                            │
│  Status Tracking:                                                           │
│  ✓ Number of chunks created                                                 │
│  ✓ Average chunk size                                                       │
│  ✓ Total text length                                                        │
│  ✗ Chunking errors                                                          │
│  ⚠ Empty text input                                                         │
│                 │                                                            │
└─────────────────┼────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: EMBEDDING GENERATION                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │  All Chunks  │                                                           │
│  │  (N chunks)  │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────┐                                │
│  │  POST /v1/embeddings                    │                                │
│  │  {                                       │                                │
│  │    "input": [chunk1, chunk2, ...],      │                                │
│  │    "model": "text-embedding-ada-002"    │                                │
│  │  }                                       │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Embedding API Response                 │                                │
│  │  {                                       │                                │
│  │    "data": [                             │                                │
│  │      {"embedding": [0.1, 0.2, ...]},    │                                │
│  │      {"embedding": [0.3, 0.4, ...]},    │                                │
│  │      ...                                 │                                │
│  │    ]                                     │                                │
│  │  }                                       │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Embeddings Matrix (N × D)              │                                │
│  │  where D = embedding dimension          │                                │
│  │  (typically 1536 for ada-002)           │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│  Status Tracking:                                                           │
│  ✓ Number of embeddings generated                                           │
│  ✓ Embedding dimension                                                      │
│  ✓ Model used                                                                │
│  ✗ API not configured                                                       │
│  ✗ Invalid API key (401)                                                    │
│  ✗ Network errors                                                           │
│  ✗ Timeout (60s)                                                            │
│  ✗ Rate limiting (429)                                                      │
│  ✗ Invalid response format                                                  │
│                 │                                                            │
└─────────────────┼────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: SIMILARITY SEARCH                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ User Query   │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────┐                                │
│  │  Generate Query Embedding               │                                │
│  │  (same API call as above)               │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Calculate Cosine Similarity            │                                │
│  │  for each chunk embedding:              │                                │
│  │                                          │                                │
│  │  similarity = dot(query, chunk)         │                                │
│  │             ────────────────────         │                                │
│  │             ||query|| × ||chunk||        │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Sort by similarity (descending)        │                                │
│  │  [                                       │                                │
│  │    (chunk_idx: 42, score: 0.892),       │                                │
│  │    (chunk_idx: 17, score: 0.876),       │                                │
│  │    (chunk_idx: 8,  score: 0.834),       │                                │
│  │    ...                                   │                                │
│  │  ]                                       │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Select Top-K (default: 5)              │                                │
│  │  Most relevant chunks                   │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│  Status Tracking:                                                           │
│  ✓ Number of chunks searched                                                │
│  ✓ Similarity score range (min-max)                                         │
│  ✓ Top score                                                                 │
│  ✓ Average score                                                             │
│  ✗ No indexed documents                                                     │
│  ✗ Query embedding errors                                                   │
│  ⚠ No relevant chunks found                                                 │
│                 │                                                            │
└─────────────────┼────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: CONTEXT BUILDING                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │  Top-K       │                                                           │
│  │  Chunks      │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────┐                                │
│  │  Format each chunk:                     │                                │
│  │                                          │                                │
│  │  --- Document: doc.pdf (Relevance: 0.89) │                                │
│  │  [chunk text here...]                   │                                │
│  │                                          │                                │
│  │  --- Document: doc.pdf (Relevance: 0.87) │                                │
│  │  [chunk text here...]                   │                                │
│  │                                          │                                │
│  │  ...                                     │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  RAG Context String                     │                                │
│  │  (ready for LLM)                        │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│  Status Tracking:                                                           │
│  ✓ Number of chunks in context                                              │
│  ✓ Total characters                                                         │
│  ✓ Average chunk size                                                       │
│  ✗ Context building errors                                                  │
│                 │                                                            │
└─────────────────┼────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FINAL OUTPUT                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Returns: (context_string, num_chunks, status_dict)                         │
│                                                                              │
│  status_dict = {                                                            │
│    "total_elapsed_seconds": 1.86,                                           │
│    "success": true,                                                          │
│    "phases": {                                                               │
│      "document_retrieval": {...},                                           │
│      "content_parsing": {...},                                              │
│      "text_chunking": {...},                                                │
│      "embedding_generation": {...},                                         │
│      "similarity_search": {...},                                            │
│      "context_building": {...}                                              │
│    },                                                                        │
│    "errors": [],                                                             │
│    "warnings": []                                                            │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ERROR HANDLING FLOW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  At Each Phase:                                                             │
│                                                                              │
│  ┌─────────────┐                                                            │
│  │   Execute   │                                                            │
│  │    Phase    │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                    │
│         ├─────▶ Success ────▶ log_phase_success() ────▶ Continue           │
│         │                                                                    │
│         ├─────▶ Warning ────▶ log_warning() ──────────▶ Continue           │
│         │                     (partial failure)                             │
│         │                                                                    │
│         └─────▶ Error ──────▶ log_phase_error() ──────▶ Stop or Continue   │
│                               (depending on severity)                       │
│                                                                              │
│  Graceful Degradation:                                                      │
│  • Document parsing fails → Skip document, continue with others             │
│  • Some chunks fail → Use successful chunks                                 │
│  • Embedding API fails → Return error, no RAG context                       │
│  • No relevant chunks → Return empty context, continue chat                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ INTEGRATION WITH CHAT ENDPOINT                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ Chat Request │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────┐                                │
│  │  Load case documents from DB            │                                │
│  │  + Optional uploaded documents          │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  RAG Pipeline                           │                                │
│  │  (if embedding API configured)          │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ├─────▶ Success ────▶ rag_context + status                  │
│                 │                                                            │
│                 └─────▶ Failure ────▶ empty context + error status          │
│                                                                              │
│  ┌─────────────────────────────────────────┐                                │
│  │  Build LLM Prompt:                      │                                │
│  │  • System message (case info)           │                                │
│  │  • RAG context (if available)           │                                │
│  │  • Conversation history                 │                                │
│  │  • User message                         │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Call LLM API                           │                                │
│  └──────────────┬──────────────────────────┘                                │
│                 │                                                            │
│                 ▼                                                            │
│  ┌─────────────────────────────────────────┐                                │
│  │  Return Response with:                  │                                │
│  │  • LLM response text                    │                                │
│  │  • context_used flag                    │                                │
│  │  • debug_info (includes rag_status)     │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Legend

- `▶` Phase start
- `✓` Success
- `✗` Error
- `⚠` Warning
- `───▶` Data flow
- `┌───┐` Process/Component
- `├───┤` Section divider
