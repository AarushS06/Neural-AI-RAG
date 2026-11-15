from fastapi import APIRouter
from app.healthcare import TEMPLATES
from app.api.common import compute_quality_report

router = APIRouter(prefix="/api/knowledge-bases", tags=["quality"])

@router.get("/quality-report")
def get_quality_report():
    """Returns knowledge base integrity, governance audit, and template distribution."""
    return compute_quality_report()

@router.get("/templates")
def get_templates():
    """Lists available healthcare knowledge-base templates."""
    return {'templates': [{**{'name': k}, **v} for k, v in TEMPLATES.items()]}
