from .ai import router as ai_router
from .answers import router as answers_router
from .auth import router as auth_router
from .question_sets import router as question_sets_router
from .questions import router as questions_router
from .payments import router as payments_router
from .admin import router as admin_router
from .two_factor import router as two_factor_router
from .translate import router as translate_router

__all__ = ["ai_router", "answers_router", "auth_router", "question_sets_router", "questions_router", "payments_router", "admin_router", "two_factor_router", "translate_router"]
