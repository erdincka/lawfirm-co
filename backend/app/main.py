from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from . import models, schemas, database, seed, routers_admin, routers_settings, routers_chat, routers_ai
from .database import engine

# Create tables first
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Justitia & Associates API")

# -----------------------------------------------------------------
# CORS configuration
# -----------------------------------------------------------------
# In development you can allow everything. In production replace
# ["*"] with the actual origins (e.g. ["https://your‑frontend.com"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # <-- allow any origin (dev)
    allow_credentials=True,
    allow_methods=["*"],          # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],          # any custom headers
)

app.include_router(routers_admin.router)
app.include_router(routers_settings.router)
app.include_router(routers_chat.router)
app.include_router(routers_ai.router)

# Dependency
def get_db():
    # Create a new session for each request (updated for schema migration)
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    db = database.SessionLocal()
    seed.seed_db(db)
    db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to Justitia & Associates API"}

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring and load balancers"""
    return {"status": "healthy", "service": "lawfirm-api"}

@app.post("/cases/{case_id}/documents", response_model=schemas.Document)
async def upload_document(
    case_id: int, 
    file: UploadFile = File(...), 
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    content = await file.read()
    
    # Simple text extraction based on file extension
    text_content = description or ""
    if file.filename.endswith((".txt", ".md", ".log", ".html", ".csv", ".json", ".xml", ".rtf")):
        try:
            text_content = content.decode("utf-8")
        except:
            pass
            
    doc = models.Document(
        title=file.filename,
        content=text_content,
        case_id=case_id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

@app.delete("/cases/{case_id}/documents/{document_id}")
def delete_document(case_id: int, document_id: int, db: Session = Depends(get_db)):
    # Verify case exists
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Find and delete document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.case_id == case_id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully", "document_id": document_id}



@app.post("/cases/{case_id}/evidence")
def create_evidence(case_id: int, evidence: schemas.EvidenceCreate, db: Session = Depends(get_db)):
    # Verify case exists
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    db_evidence = models.Evidence(
        description=evidence.description,
        evidence_type=evidence.evidence_type,
        location_found=evidence.location_found,
        case_id=case_id
    )
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)
    return db_evidence

@app.post("/cases", response_model=schemas.Case)
def create_case(case: schemas.CaseCreate, db: Session = Depends(get_db)):
    # Verify lead attorney exists
    lawyer = db.query(models.Lawyer).filter(models.Lawyer.id == case.lead_attorney_id).first()
    if not lawyer:
        raise HTTPException(status_code=404, detail="Lead attorney not found")
    
    db_case = models.Case(
        title=case.title,
        description=case.description,
        status=case.status,
        case_type=case.case_type,
        defendant_name=case.defendant_name,
        lead_attorney_id=case.lead_attorney_id
    )
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    return db_case

@app.get("/cases", response_model=List[schemas.Case])
def read_cases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cases = db.query(models.Case).offset(skip).limit(limit).all()
    return cases

@app.get("/cases/{case_id}", response_model=schemas.Case)
def read_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@app.get("/lawyers", response_model=List[schemas.Lawyer])
def read_lawyers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    lawyers = db.query(models.Lawyer).offset(skip).limit(limit).all()
    return lawyers
