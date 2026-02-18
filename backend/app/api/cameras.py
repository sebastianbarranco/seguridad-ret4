"""Camera CRUD endpoints."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import CurrentUser, audit
from app.models.user import UserRole
from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraUpdate, CameraOut

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("", response_model=list[CameraOut])
def list_cameras(user: CurrentUser, db: Session = Depends(get_db)):
    return db.query(Camera).all()


@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def create_camera(
    body: CameraCreate,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    if user.role != UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=403, detail="SuperAdmin required")
    cam = Camera(**body.model_dump())
    db.add(cam)
    db.commit()
    db.refresh(cam)
    audit(db, action="camera_create", user=user, request=request, resource_type="camera", resource_id=str(cam.id))
    return cam


@router.patch("/{camera_id}", response_model=CameraOut)
def update_camera(
    camera_id: uuid.UUID,
    body: CameraUpdate,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    if user.role != UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=403, detail="SuperAdmin required")
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cam, k, v)
    db.commit()
    db.refresh(cam)
    audit(db, action="camera_update", user=user, request=request, resource_type="camera", resource_id=str(camera_id))
    return cam


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(
    camera_id: uuid.UUID,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    if user.role != UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=403, detail="SuperAdmin required")
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    db.delete(cam)
    db.commit()
    audit(db, action="camera_delete", user=user, request=request, resource_type="camera", resource_id=str(camera_id))
