from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    tenant = "tenant"


class PropertyType(str, enum.Enum):
    office = "office"
    hotel = "hotel"
    workshop = "workshop"
    mixed = "mixed"


class UnitType(str, enum.Enum):
    room = "room"
    office = "office"
    workshop = "workshop"
    suite = "suite"


class UnitStatus(str, enum.Enum):
    vacant = "vacant"
    reserved = "reserved"
    occupied = "occupied"
    checkout_today = "checkout_today"
    maintenance = "maintenance"
    overdue = "overdue"


class AssetCondition(str, enum.Enum):
    good = "good"
    fair = "fair"
    damaged = "damaged"
    missing = "missing"


class OccupancyKind(str, enum.Enum):
    booking = "booking"
    contract = "contract"


class OccupancyStatus(str, enum.Enum):
    reserved = "reserved"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    partially_paid = "partially_paid"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class ExpenseStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
    collecting = "collecting"


class ExpenseDueCycle(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    transfer = "transfer"
    card = "card"
    momo = "momo"
    vietqr = "vietqr"
    other = "other"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    failed = "failed"
    expired = "expired"


class PaymentProvider(str, enum.Enum):
    manual = "manual"
    momo = "momo"
    payos = "payos"
    sandbox = "sandbox"


class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"
    one_time = "one_time"


class CleaningKind(str, enum.Enum):
    room_clean = "room_clean"
    deep_clean = "deep_clean"
    sanitize = "sanitize"


class CleaningStatus(str, enum.Enum):
    pending = "pending"
    done = "done"
    cancelled = "cancelled"


class FeedbackStatus(str, enum.Enum):
    new = "new"
    done = "done"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    id_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.admin)
    tenant_id: Mapped[Optional[str]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    managed_property_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("properties.id"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="user")
    managed_property: Mapped[Optional["Property"]] = relationship(
        foreign_keys=[managed_property_id]
    )


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    property_type: Mapped[PropertyType] = mapped_column(Enum(PropertyType))
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    floors: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    units: Mapped[list["Unit"]] = relationship(back_populates="property", cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship(back_populates="property", cascade="all, delete-orphan")


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("property_id", "code", name="uq_unit_property_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id"), index=True)
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255))
    unit_type: Mapped[UnitType] = mapped_column(Enum(UnitType), default=UnitType.room)
    floor: Mapped[int] = mapped_column(Integer, default=1)
    area_m2: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    price_per_night: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    price_per_month: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    price_per_hour: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    status_override: Mapped[Optional[UnitStatus]] = mapped_column(Enum(UnitStatus), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    property: Mapped["Property"] = relationship(back_populates="units")
    assets: Mapped[list["Asset"]] = relationship(back_populates="unit", cascade="all, delete-orphan")
    occupancies: Mapped[list["Occupancy"]] = relationship(back_populates="unit", cascade="all, delete-orphan")


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    id_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped[Optional["User"]] = relationship(back_populates="tenant")
    occupancies: Mapped[list["Occupancy"]] = relationship(back_populates="tenant")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    condition: Mapped[AssetCondition] = mapped_column(Enum(AssetCondition), default=AssetCondition.good)
    supplier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    purchased_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_repaired_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    purchase_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    unit: Mapped["Unit"] = relationship(back_populates="assets")


class Occupancy(Base):
    __tablename__ = "occupancies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    kind: Mapped[OccupancyKind] = mapped_column(Enum(OccupancyKind))
    status: Mapped[OccupancyStatus] = mapped_column(Enum(OccupancyStatus), default=OccupancyStatus.reserved)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)  # exclusive end for availability
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    unit: Mapped["Unit"] = relationship(back_populates="occupancies")
    tenant: Mapped["Tenant"] = relationship(back_populates="occupancies")
    booking: Mapped[Optional["Booking"]] = relationship(back_populates="occupancy", uselist=False)
    contract: Mapped[Optional["Contract"]] = relationship(back_populates="occupancy", uselist=False)
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="occupancy")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    occupancy_id: Mapped[str] = mapped_column(ForeignKey("occupancies.id"), unique=True)
    guests: Mapped[int] = mapped_column(Integer, default=1)
    adults: Mapped[int] = mapped_column(Integer, default=1)
    children: Mapped[int] = mapped_column(Integer, default=0)
    rate_per_night: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    checked_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    occupancy: Mapped["Occupancy"] = relationship(back_populates="booking")


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    occupancy_id: Mapped[str] = mapped_column(ForeignKey("occupancies.id"), unique=True)
    contract_no: Mapped[str] = mapped_column(String(100), unique=True)
    deposit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    monthly_rent: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle), default=BillingCycle.monthly)
    signed_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    terminated_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    occupancy: Mapped["Occupancy"] = relationship(back_populates="contract")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    occupancy_id: Mapped[Optional[str]] = mapped_column(ForeignKey("occupancies.id"), nullable=True, index=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    invoice_no: Mapped[str] = mapped_column(String(100), unique=True)
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.issued)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    occupancy: Mapped[Optional["Occupancy"]] = relationship(back_populates="invoices")
    tenant: Mapped["Tenant"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.cash)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.confirmed, index=True
    )
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider), default=PaymentProvider.manual
    )
    provider_order_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    provider_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pay_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    qr_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id"), index=True)
    category: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    expense_date: Mapped[date] = mapped_column(Date)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ExpenseStatus] = mapped_column(Enum(ExpenseStatus), default=ExpenseStatus.unpaid)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    due_cycle: Mapped[ExpenseDueCycle] = mapped_column(
        Enum(ExpenseDueCycle), default=ExpenseDueCycle.monthly
    )
    recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    property: Mapped["Property"] = relationship(back_populates="expenses")
    journals: Mapped[list["ExpenseJournal"]] = relationship(
        back_populates="expense", cascade="all, delete-orphan"
    )


class ExpenseJournal(Base):
    __tablename__ = "expense_journals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    expense_id: Mapped[str] = mapped_column(ForeignKey("expenses.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    expense: Mapped["Expense"] = relationship(back_populates="journals")


class CleaningRequest(Base):
    __tablename__ = "cleaning_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    occupancy_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("occupancies.id"), nullable=True, index=True
    )
    kind: Mapped[CleaningKind] = mapped_column(Enum(CleaningKind), default=CleaningKind.room_clean)
    preferred_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[CleaningStatus] = mapped_column(
        Enum(CleaningStatus), default=CleaningStatus.pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    tenant: Mapped["Tenant"] = relationship()
    unit: Mapped["Unit"] = relationship()
    occupancy: Mapped[Optional["Occupancy"]] = relationship()


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus), default=FeedbackStatus.new, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship()
    images: Mapped[list["FeedbackImage"]] = relationship(
        back_populates="feedback", cascade="all, delete-orphan", order_by="FeedbackImage.sort_order"
    )


class FeedbackImage(Base):
    __tablename__ = "feedback_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedbacks.id"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    feedback: Mapped["Feedback"] = relationship(back_populates="images")
