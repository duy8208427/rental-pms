from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    AssetCondition,
    BillingCycle,
    CleaningKind,
    CleaningStatus,
    ExpenseDueCycle,
    ExpenseStatus,
    FeedbackStatus,
    InvoiceStatus,
    OccupancyKind,
    OccupancyStatus,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    PropertyType,
    UnitStatus,
    UnitType,
    UserRole,
)

_PERSON_NAME_RE = re.compile(r"^[^\W\d_]+(?:[ '\-][^\W\d_]+)*$", re.UNICODE)
_PHONE_RE = re.compile(r"^\d{9,11}$")
_ID_NUMBER_RE = re.compile(r"^(\d{9}|\d{12})$")


def _strip_str(v: object) -> object:
    if isinstance(v, str):
        return v.strip()
    return v


def validate_person_name(v: object) -> str:
    v = _strip_str(v)
    if not isinstance(v, str) or not v:
        raise ValueError("Họ tên là bắt buộc")
    if not _PERSON_NAME_RE.fullmatch(v):
        raise ValueError("Họ tên chỉ gồm chữ cái, khoảng trắng, dấu ' hoặc -")
    return v


def validate_phone(v: object, *, required: bool = True) -> str | None:
    v = _strip_str(v)
    if v is None or v == "":
        if required:
            raise ValueError("Số điện thoại là bắt buộc")
        return None
    if not isinstance(v, str):
        raise ValueError("Số điện thoại không hợp lệ")
    digits = re.sub(r"\D", "", v)
    if not _PHONE_RE.fullmatch(digits):
        raise ValueError("Số điện thoại chỉ gồm 9–11 chữ số")
    return digits


def validate_id_number(v: object, *, required: bool = True) -> str | None:
    v = _strip_str(v)
    if v is None or v == "":
        if required:
            raise ValueError("CCCD là bắt buộc")
        return None
    if not isinstance(v, str):
        raise ValueError("CCCD không hợp lệ")
    digits = re.sub(r"\D", "", v)
    if not _ID_NUMBER_RE.fullmatch(digits):
        raise ValueError("CCCD phải gồm 9 hoặc 12 chữ số")
    return digits


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    id_number: Optional[str] = None
    role: UserRole
    tenant_id: Optional[str] = None
    managed_property_id: Optional[str] = None
    managed_property_name: Optional[str] = None
    is_active: bool = True


class ManagerCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    phone: Optional[str] = None
    id_number: str = Field(min_length=1)
    managed_property_id: str

    @field_validator("full_name", mode="before")
    @classmethod
    def _name(cls, v: object) -> str:
        return validate_person_name(v)

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v: object) -> str | None:
        return validate_phone(v, required=False)

    @field_validator("id_number", mode="before")
    @classmethod
    def _id_number(cls, v: object) -> str:
        out = validate_id_number(v, required=True)
        assert out is not None
        return out


class ManagerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    id_number: Optional[str] = None
    managed_property_id: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)
    is_active: Optional[bool] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def _name(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return v
        return validate_person_name(v)

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v: object) -> object:
        if v is None:
            return None
        return validate_phone(v, required=False)

    @field_validator("id_number", mode="before")
    @classmethod
    def _id_number(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return v
        return validate_id_number(v, required=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Property / Unit ----------
class PropertyCreate(BaseModel):
    name: str
    property_type: PropertyType
    address: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    floors: int = 1


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    property_type: Optional[PropertyType] = None
    address: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    floors: Optional[int] = None


class PropertyOut(ORMModel):
    id: str
    name: str
    property_type: PropertyType
    address: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    floors: int
    created_at: datetime


class UnitCreate(BaseModel):
    property_id: str
    code: str
    name: str
    unit_type: UnitType = UnitType.room
    floor: int = 1
    area_m2: Optional[Decimal] = None
    capacity: int = 1
    price_per_night: Optional[Decimal] = None
    price_per_month: Optional[Decimal] = None
    price_per_hour: Optional[Decimal] = None
    notes: Optional[str] = None


class UnitUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    unit_type: Optional[UnitType] = None
    floor: Optional[int] = None
    area_m2: Optional[Decimal] = None
    capacity: Optional[int] = None
    price_per_night: Optional[Decimal] = None
    price_per_month: Optional[Decimal] = None
    price_per_hour: Optional[Decimal] = None
    status_override: Optional[UnitStatus] = None
    notes: Optional[str] = None


class UnitOut(ORMModel):
    id: str
    property_id: str
    code: str
    name: str
    unit_type: UnitType
    floor: int
    area_m2: Optional[Decimal] = None
    capacity: int
    price_per_night: Optional[Decimal] = None
    price_per_month: Optional[Decimal] = None
    price_per_hour: Optional[Decimal] = None
    status_override: Optional[UnitStatus] = None
    notes: Optional[str] = None
    display_status: Optional[UnitStatus] = None
    created_at: datetime


# ---------- Tenant ----------
class TenantCreate(BaseModel):
    full_name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    email: EmailStr
    id_number: str = Field(min_length=1)
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def _name(cls, v: object) -> str:
        return validate_person_name(v)

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v: object) -> str:
        out = validate_phone(v, required=True)
        assert out is not None
        return out

    @field_validator("id_number", mode="before")
    @classmethod
    def _id_number(cls, v: object) -> str:
        out = validate_id_number(v, required=True)
        assert out is not None
        return out


class TenantUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    id_number: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def _name(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return v
        return validate_person_name(v)

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v: object) -> object:
        if v is None:
            return None
        return validate_phone(v, required=False)

    @field_validator("id_number", mode="before")
    @classmethod
    def _id_number(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return v
        return validate_id_number(v, required=True)


class TenantOut(ORMModel):
    id: str
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    id_number: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


# ---------- Asset ----------
class AssetCreate(BaseModel):
    unit_id: str
    name: str
    category: Optional[str] = None
    quantity: int = 1
    condition: AssetCondition = AssetCondition.good
    supplier: Optional[str] = None
    purchased_at: Optional[date] = None
    last_repaired_at: Optional[date] = None
    purchase_value: Optional[Decimal] = None
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    condition: Optional[AssetCondition] = None
    supplier: Optional[str] = None
    purchased_at: Optional[date] = None
    last_repaired_at: Optional[date] = None
    purchase_value: Optional[Decimal] = None
    notes: Optional[str] = None


class AssetOut(ORMModel):
    id: str
    unit_id: str
    name: str
    category: Optional[str] = None
    quantity: int
    condition: AssetCondition
    supplier: Optional[str] = None
    purchased_at: Optional[date] = None
    last_repaired_at: Optional[date] = None
    purchase_value: Optional[Decimal] = None
    notes: Optional[str] = None
    unit_code: Optional[str] = None
    created_at: datetime


# ---------- Occupancy / Booking / Contract ----------
class OccupancyOut(ORMModel):
    id: str
    unit_id: str
    tenant_id: str
    kind: OccupancyKind
    status: OccupancyStatus
    start_date: date
    end_date: date
    notes: Optional[str] = None
    tenant_name: Optional[str] = None
    unit_code: Optional[str] = None
    created_at: datetime


class BookingCreate(BaseModel):
    unit_id: str
    tenant_id: str
    start_date: date
    end_date: date  # exclusive checkout date
    guests: Optional[int] = None
    adults: Optional[int] = Field(default=None, ge=1)
    children: Optional[int] = Field(default=None, ge=0)
    rate_per_night: Optional[Decimal] = None
    notes: Optional[str] = None
    auto_invoice: bool = True


class BookingOut(ORMModel):
    id: str
    occupancy_id: str
    guests: int
    adults: int = 1
    children: int = 0
    rate_per_night: Decimal
    total_amount: Decimal
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    occupancy: Optional[OccupancyOut] = None
    created_at: datetime


class ContractCreate(BaseModel):
    unit_id: str
    tenant_id: str
    start_date: date
    end_date: date
    monthly_rent: Optional[Decimal] = None
    deposit: Decimal = Decimal("0")
    billing_cycle: BillingCycle = BillingCycle.monthly
    contract_no: Optional[str] = None
    signed_at: Optional[date] = None
    notes: Optional[str] = None
    auto_invoice: bool = True


class ContractOut(ORMModel):
    id: str
    occupancy_id: str
    contract_no: str
    deposit: Decimal
    monthly_rent: Decimal
    billing_cycle: BillingCycle
    signed_at: Optional[date] = None
    terminated_at: Optional[date] = None
    occupancy: Optional[OccupancyOut] = None
    unit_code: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    created_at: datetime


# ---------- Finance ----------
class InvoiceCreate(BaseModel):
    tenant_id: str
    occupancy_id: Optional[str] = None
    amount: Decimal
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    description: Optional[str] = None
    invoice_no: Optional[str] = None


class InvoiceOut(ORMModel):
    id: str
    occupancy_id: Optional[str] = None
    tenant_id: str
    invoice_no: str
    issue_date: date
    due_date: date
    amount: Decimal
    paid_amount: Decimal
    status: InvoiceStatus
    description: Optional[str] = None
    tenant_name: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    unit_code: Optional[str] = None
    balance: Optional[Decimal] = None
    created_at: datetime


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: Decimal = Field(gt=0)
    method: PaymentMethod = PaymentMethod.cash
    paid_at: Optional[datetime] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class OnlinePaymentCreate(BaseModel):
    invoice_id: str
    method: PaymentMethod = Field(description="momo hoặc vietqr")
    amount: Optional[Decimal] = Field(default=None, gt=0)


class PaymentOut(ORMModel):
    id: str
    invoice_id: str
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus = PaymentStatus.confirmed
    provider: PaymentProvider = PaymentProvider.manual
    provider_order_id: Optional[str] = None
    pay_url: Optional[str] = None
    qr_code: Optional[str] = None
    paid_at: datetime
    confirmed_at: Optional[datetime] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    tenant_name: Optional[str] = None
    invoice_no: Optional[str] = None


class PublicCalendarBlock(BaseModel):
    unit_id: str
    unit_code: str
    property_id: Optional[str] = None
    kind: OccupancyKind
    status: OccupancyStatus
    start_date: date
    end_date: date


class ExpenseCreate(BaseModel):
    property_id: str
    category: str
    amount: Decimal
    expense_date: date
    description: Optional[str] = None
    status: ExpenseStatus = ExpenseStatus.unpaid
    paid_at: Optional[datetime] = None
    image_url: Optional[str] = None
    due_cycle: ExpenseDueCycle = ExpenseDueCycle.monthly
    recurring: bool = True
    due_date: Optional[date] = None
    next_due_date: Optional[date] = None


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[date] = None
    description: Optional[str] = None
    status: Optional[ExpenseStatus] = None
    paid_at: Optional[datetime] = None
    image_url: Optional[str] = None
    due_cycle: Optional[ExpenseDueCycle] = None
    recurring: Optional[bool] = None
    due_date: Optional[date] = None
    next_due_date: Optional[date] = None


class ExpenseOut(ORMModel):
    id: str
    property_id: str
    category: str
    amount: Decimal
    expense_date: date
    description: Optional[str] = None
    status: ExpenseStatus = ExpenseStatus.unpaid
    paid_at: Optional[datetime] = None
    image_url: Optional[str] = None
    due_cycle: ExpenseDueCycle = ExpenseDueCycle.monthly
    recurring: bool = True
    due_date: Optional[date] = None
    next_due_date: Optional[date] = None
    created_at: datetime


class ExpenseJournalOut(ORMModel):
    id: str
    expense_id: str
    amount: Decimal
    due_date: Optional[date] = None
    paid_at: datetime
    image_url: Optional[str] = None
    category: str
    description: Optional[str] = None
    created_at: datetime


class ExpenseMonthStatus(BaseModel):
    year: int
    month: int
    total: int
    unpaid: int
    paid: bool
    label: str


# ---------- Dashboard / Calendar ----------
class RoomBoardUnit(BaseModel):
    id: str
    code: str
    name: str
    floor: int
    unit_type: UnitType
    capacity: int = 1
    price_per_night: Optional[Decimal] = None
    price_per_month: Optional[Decimal] = None
    price_per_hour: Optional[Decimal] = None
    notes: Optional[str] = None
    display_status: UnitStatus
    tenant_name: Optional[str] = None
    occupancy_id: Optional[str] = None
    occupancy_kind: Optional[OccupancyKind] = None
    end_date: Optional[date] = None
    balance_due: Decimal = Decimal("0")


class CalendarBlock(BaseModel):
    occupancy_id: str
    unit_id: str
    unit_code: str
    tenant_name: str
    kind: OccupancyKind
    status: OccupancyStatus
    start_date: date
    end_date: date


class DashboardOut(BaseModel):
    total_units: int
    vacant_units: int
    occupied_units: int
    reserved_units: int
    maintenance_units: int
    occupancy_rate: float
    revenue_month: Decimal
    expense_month: Decimal
    overdue_invoices: int
    overdue_amount: Decimal
    checkouts_today: int
    contracts_expiring_30d: int


# ---------- Feedback ----------
class FeedbackImageOut(ORMModel):
    id: str
    url: str
    sort_order: int


class FeedbackOut(ORMModel):
    id: str
    user_id: str
    title: str
    content: str
    status: FeedbackStatus
    created_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[UserRole] = None
    images: list[FeedbackImageOut] = []
