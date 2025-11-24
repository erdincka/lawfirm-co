from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from . import database, models_settings, schemas_admin

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=List[schemas_admin.SystemSetting])
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models_settings.SystemSetting).all()
    # Mask secrets
    for s in settings:
        if s.is_secret:
            s.value = "********"
    return settings

@router.post("", response_model=schemas_admin.SystemSetting)
def create_or_update_setting(setting: schemas_admin.SystemSettingCreate, db: Session = Depends(get_db)):
    db_setting = db.query(models_settings.SystemSetting).filter(models_settings.SystemSetting.key == setting.key).first()
    if db_setting:
        db_setting.value = setting.value
        db_setting.is_secret = setting.is_secret
    else:
        db_setting = models_settings.SystemSetting(key=setting.key, value=setting.value, is_secret=setting.is_secret)
        db.add(db_setting)
    
    db.commit()
    db.refresh(db_setting)
    return db_setting
