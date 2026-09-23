import os
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./rental_pms.db"
    jwt_secret: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:5173"

    # Public base URL of this API (for webhook / redirect construction)
    public_api_base: str = "http://127.0.0.1:8000"

    # sandbox | live — sandbox mocks gateway when keys empty or for local demo
    payment_mode: str = "sandbox"

    # MoMo
    momo_partner_code: str = ""
    momo_access_key: str = ""
    momo_secret_key: str = ""
    momo_endpoint: str = "https://test-payment.momo.vn/v2/gateway/api/create"
    momo_redirect_url: str = "http://127.0.0.1:8000/api/payments/return/momo"
    momo_ipn_url: str = "http://127.0.0.1:8000/api/webhooks/momo"

    # PayOS (VietQR / bank transfer)
    payos_client_id: str = ""
    payos_api_key: str = ""
    payos_checksum_key: str = ""
    payos_endpoint: str = "https://api-merchant.payos.vn/v2/payment-requests"
    payos_return_url: str = "http://127.0.0.1:8000/api/payments/return/payos"
    payos_cancel_url: str = "http://127.0.0.1:8000/api/payments/return/payos"
    payos_webhook_url: str = "http://127.0.0.1:8000/api/webhooks/payos"

    @field_validator("database_url", mode="before")
    @classmethod
    def use_psycopg2(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            return "postgresql+psycopg2://" + value[len("postgresql://") :]
        return value

    @field_validator("public_api_base", mode="before")
    @classmethod
    def public_base_from_render(cls, value: str) -> str:
        external = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
        if external:
            return external
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
