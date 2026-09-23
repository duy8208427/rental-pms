from app.routers import (
    assets,
    bookings,
    contracts,
    dashboard,
    feedback,
    finance,
    managers,
    properties,
    public,
    tenants,
    units,
)
from app.routers import auth as auth_router

__all__ = [
    "assets",
    "auth_router",
    "bookings",
    "contracts",
    "dashboard",
    "feedback",
    "finance",
    "managers",
    "properties",
    "public",
    "tenants",
    "units",
]
