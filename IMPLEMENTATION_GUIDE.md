# Implementation Guide for Production Deployment

This guide provides step-by-step instructions for implementing the cleanup recommendations and preparing the application for production deployment.

## 📋 Prerequisites

- Review `CLEANUP_REPORT.md` for detailed analysis
- Backup your current codebase
- Ensure you have a test environment

## 🚀 Quick Start

### Option 1: Automated Cleanup (Recommended)

```bash
# Run the automated cleanup script
./cleanup.sh

# Review the changes
git status

# Test the application
tilt up

# If everything works, commit the changes
git add .
git commit -m "chore: automated cleanup for production deployment"
```

### Option 2: Manual Implementation

Follow the steps below for manual implementation with full control.

---

## Step 1: File Cleanup (5 minutes)

### 1.1 Remove Redundant Documentation

```bash
# Backup first
mkdir -p backups/rag_docs
cp backend/RAG_*.md backups/rag_docs/

# Remove redundant files
rm backend/RAG_EMBEDDING_FIX.md
rm backend/RAG_ENHANCEMENT_SUMMARY.md
rm backend/RAG_FLOW_DIAGRAM.md
rm backend/RAG_IMPLEMENTATION.md
rm backend/RAG_QUICK_REFERENCE.md
rm backend/RAG_TESTING_GUIDE.md

# Keep RAG_README.md but move to docs
mkdir -p docs
mv backend/RAG_README.md docs/
```

### 1.2 Organize Test Files

```bash
# Create tests directory
mkdir -p backend/tests

# Move test file
mv backend/test_rag.py backend/tests/

# Create __init__.py
touch backend/tests/__init__.py
```

---

## Step 2: Update Configuration (15 minutes)

### 2.1 Update Environment Variables

**File:** `backend/.env.example`

Add these new variables:

```env
# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60

# RAG Configuration
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
RAG_TOP_K=5

# API Timeouts
LLM_TIMEOUT=60
EMBEDDING_TIMEOUT=60
```

### 2.2 Update Main Application

**File:** `backend/app/main.py`

Replace the CORS configuration:

```python
# OLD (INSECURE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ Don't use in production
    ...
)

# NEW (SECURE)
from .core import get_settings, get_cors_config

settings = get_settings()
cors_config = get_cors_config(settings)
app.add_middleware(CORSMiddleware, **cors_config)
```

See `backend/app/main_production_example.py` for complete implementation.

---

## Step 3: Implement Logging (20 minutes)

### 3.1 Setup Logging in Main

**File:** `backend/app/main.py`

Add at the top:

```python
from .core import setup_logging, get_logger

# Initialize settings and logging
settings = get_settings()
setup_logging(
    level=settings.LOG_LEVEL,
    json_format=(settings.LOG_FORMAT == "json"),
    log_file=settings.LOG_FILE if settings.LOG_FILE else None
)

logger = get_logger(__name__)
```

### 3.2 Replace Print Statements

**Files to update:**
- `backend/app/routers_chat.py`
- `backend/app/routers_ai.py`
- `backend/app/rag_memory.py`

**Example replacements:**

```python
# OLD
print(f"Processing {len(documents)} documents")
print(f"Error: {e}")

# NEW
from .core import get_logger
logger = get_logger(__name__)

logger.info(f"Processing {len(documents)} documents")
logger.error(f"Error: {e}", exc_info=True)
```

**Search and replace guide:**

```bash
# Find all print statements
grep -r "print(" backend/app/*.py

# Replace manually or use sed (be careful!)
# Example for routers_chat.py:
sed -i.bak 's/print(/logger.info(/g' backend/app/routers_chat.py
```

---

## Step 4: Remove Unused Dependencies (5 minutes)

### 4.1 Check if pandas is used

```bash
grep -r "import pandas" backend/app/
grep -r "from pandas" backend/app/
```

If no results, remove from `requirements.txt`:

```bash
# Edit backend/requirements.txt
# Remove line: pandas==2.2.0
```

### 4.2 Update requirements.txt

The file should look like:

```txt
fastapi==0.109.0
numpy==1.26.3
pydantic==2.6.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
python-multipart
faker==22.5.1
httpx==0.26.0
uvicorn==0.27.0

# RAG dependencies
pypdf==4.0.1
striprtf==0.0.26
reportlab==4.0.9
```

---

## Step 5: Add Security Features (15 minutes)

### 5.1 Add Security Headers

Already implemented in `backend/app/core/config.py`.

Update `main.py` to use them:

```python
from .core import SECURITY_HEADERS

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response
```

### 5.2 Add Rate Limiting (Optional but Recommended)

Install slowapi:

```bash
cd backend
pip install slowapi
echo "slowapi==0.1.9" >> requirements.txt
```

Update `main.py`:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints
@app.post("/chat/cases/{case_id}")
@limiter.limit("10/minute")
async def chat_with_case(...):
    ...
```

---

## Step 6: Testing (30 minutes)

### 6.1 Test Locally

```bash
# Start the application
tilt up

# Check logs for errors
tilt logs backend

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/cases/
```

### 6.2 Test Frontend

```bash
# Open browser
open http://localhost:3000

# Test:
# - Case list loads
# - Case details page works
# - Chat functionality works
# - Document upload works
# - Admin panel accessible
```

### 6.3 Test Configuration

```bash
# Test with different log levels
export LOG_LEVEL=DEBUG
tilt up

# Test CORS
export ALLOWED_ORIGINS="http://localhost:3000,https://yourdomain.com"
tilt up

# Check logs are in JSON format
export LOG_FORMAT=json
tilt up
```

---

## Step 7: Update Documentation (10 minutes)

### 7.1 Update README.md

Add section about new environment variables:

```markdown
## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

### Optional
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARNING, ERROR)
- `LOG_FORMAT` - Log format (json or text)
- `RATE_LIMIT_ENABLED` - Enable rate limiting (true/false)
- `RAG_CHUNK_SIZE` - Size of text chunks for RAG (default: 500)

See `.env.example` for complete list.
```

### 7.2 Update DEPLOYMENT.md

Add section about logging:

```markdown
## Logging

The application uses structured logging in production.

### Configuration
- Set `LOG_LEVEL=INFO` for production
- Set `LOG_FORMAT=json` for structured logging
- Logs are written to stdout by default

### Log Aggregation
Logs can be collected using:
- Kubernetes: FluentD/Fluentbit
- Docker: Logging drivers
- Cloud: CloudWatch, Stackdriver, etc.
```

---

## Step 8: Production Deployment (varies)

### 8.1 Update Kubernetes Manifests

**File:** `kubernetes/backend.yaml`

Add environment variables:

```yaml
env:
  - name: LOG_LEVEL
    value: "INFO"
  - name: LOG_FORMAT
    value: "json"
  - name: ALLOWED_ORIGINS
    value: "https://yourdomain.com"
  - name: RATE_LIMIT_ENABLED
    value: "true"
```

### 8.2 Build Production Images

```bash
# Backend
cd backend
docker build -f Dockerfile.prod -t erdincka/lawfirm-backend:latest .

# Frontend
cd ../frontend
docker build -f Dockerfile.prod -t erdincka/lawfirm-frontend:latest .
```

### 8.3 Push to Registry

```bash
docker push erdincka/lawfirm-backend:latest
docker push erdincka/lawfirm-frontend:latest
```

### 8.4 Deploy to Kubernetes

```bash
kubectl apply -f kubernetes/
kubectl rollout status deployment/backend
kubectl rollout status deployment/frontend
```

---

## 🔍 Verification Checklist

After implementation, verify:

### Code Quality
- [ ] No print() statements in production code
- [ ] All imports are used
- [ ] No commented-out code blocks
- [ ] Consistent code style

### Security
- [ ] CORS configured with specific origins
- [ ] No hardcoded secrets
- [ ] Security headers added
- [ ] Rate limiting enabled
- [ ] HTTPS configured (if applicable)

### Configuration
- [ ] All environment variables documented
- [ ] .env.example updated
- [ ] Settings validated on startup
- [ ] Production mode detected correctly

### Logging
- [ ] Structured logging implemented
- [ ] Log levels appropriate
- [ ] No sensitive data in logs
- [ ] Request/response logging working

### Testing
- [ ] Application starts without errors
- [ ] All endpoints respond correctly
- [ ] Frontend loads and functions
- [ ] Database connections work
- [ ] Health checks pass

### Documentation
- [ ] README.md updated
- [ ] DEPLOYMENT.md updated
- [ ] API documentation current
- [ ] Environment variables documented

---

## 🐛 Troubleshooting

### Issue: Application won't start

**Check:**
```bash
# View logs
tilt logs backend

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Import errors
```

### Issue: CORS errors in browser

**Fix:**
```bash
# Check ALLOWED_ORIGINS
echo $ALLOWED_ORIGINS

# Should include your frontend URL
export ALLOWED_ORIGINS="http://localhost:3000"
```

### Issue: Logging not working

**Check:**
```python
# Verify logging is initialized
from app.core import get_logger
logger = get_logger(__name__)
logger.info("Test message")
```

### Issue: Import errors after restructuring

**Fix:**
```bash
# Ensure __init__.py files exist
touch backend/app/core/__init__.py
touch backend/tests/__init__.py

# Restart application
tilt down
tilt up
```

---

## 📊 Performance Testing

### Load Testing

```bash
# Install hey
brew install hey

# Test health endpoint
hey -n 1000 -c 10 http://localhost:8000/health

# Test cases endpoint
hey -n 1000 -c 10 http://localhost:8000/cases/
```

### Monitor Resource Usage

```bash
# Docker stats
docker stats

# Kubernetes metrics
kubectl top pods
```

---

## 🔄 Rollback Plan

If issues occur after deployment:

### 1. Immediate Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/backend
kubectl rollout undo deployment/frontend

# Docker Compose
docker-compose down
git checkout main
docker-compose up -d
```

### 2. Restore from Backup

```bash
# Restore files
cp -r backups/cleanup_YYYYMMDD_HHMMSS/* .

# Restore database (if needed)
pg_restore -d lawfirm backup.dump
```

---

## 📈 Next Steps

After successful deployment:

1. **Week 1:**
   - Monitor logs for errors
   - Track performance metrics
   - Collect user feedback

2. **Week 2:**
   - Add unit tests
   - Set up CI/CD pipeline
   - Configure monitoring alerts

3. **Month 1:**
   - Implement authentication
   - Add caching layer
   - Performance optimization

---

## 📞 Support

If you encounter issues:

1. Check `CLEANUP_REPORT.md` for detailed analysis
2. Review logs: `tilt logs backend`
3. Check configuration: `env | grep -E "(LOG_|ALLOWED_|DATABASE_)"`
4. Verify health: `curl http://localhost:8000/health`

---

## 📝 Change Log

Track your implementation progress:

- [ ] Step 1: File Cleanup
- [ ] Step 2: Update Configuration
- [ ] Step 3: Implement Logging
- [ ] Step 4: Remove Unused Dependencies
- [ ] Step 5: Add Security Features
- [ ] Step 6: Testing
- [ ] Step 7: Update Documentation
- [ ] Step 8: Production Deployment

---

**Last Updated:** 2025-11-26  
**Version:** 1.0  
**Status:** Ready for Implementation
