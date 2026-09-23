"""Seed demo data: hotel + office + workshop."""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    Asset,
    AssetCondition,
    BillingCycle,
    Booking,
    Contract,
    Expense,
    ExpenseDueCycle,
    ExpenseStatus,
    Occupancy,
    OccupancyKind,
    OccupancyStatus,
    Property,
    PropertyType,
    Tenant,
    Unit,
    UnitType,
    User,
    UserRole,
)
from app.services.finance import create_invoice, compute_next_due_date


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = User(
            email="admin@example.com",
            password_hash=hash_password("admin123"),
            full_name="Quản trị viên",
            role=UserRole.admin,
            phone="0901000001",
        )
        db.add(admin)
        db.flush()

        hotel = Property(
            name="Khách sạn Mini Riverside",
            property_type=PropertyType.hotel,
            address="12 Nguyễn Huệ",
            city="Cao Lãnh",
            floors=2,
            description="KS nhỏ 8 phòng",
        )
        office = Property(
            name="Tòa văn phòng Center",
            property_type=PropertyType.office,
            address="45 Trần Hưng Đạo",
            city="Cao Lãnh",
            floors=3,
        )
        workshop = Property(
            name="Xưởng thuê Đông Á",
            property_type=PropertyType.workshop,
            address="KCN Hòa An",
            city="Cao Lãnh",
            floors=1,
        )
        db.add_all([hotel, office, workshop])
        db.flush()

        managers = [
            User(
                email="manager.hotel@example.com",
                password_hash=hash_password("manager123"),
                full_name="Quản lý KS Riverside",
                role=UserRole.manager,
                managed_property_id=hotel.id,
                phone="0902000001",
                id_number="079085111111",
            ),
            User(
                email="manager.office@example.com",
                password_hash=hash_password("manager123"),
                full_name="Quản lý VP Center",
                role=UserRole.manager,
                managed_property_id=office.id,
                phone="0902000002",
                id_number="079085222222",
            ),
            User(
                email="manager.workshop@example.com",
                password_hash=hash_password("manager123"),
                full_name="Quản lý Xưởng Đông Á",
                role=UserRole.manager,
                managed_property_id=workshop.id,
                phone="0902000003",
                id_number="079085333333",
            ),
        ]
        db.add_all(managers)

        hotel_units = []
        for floor in (1, 2):
            for n in range(1, 5):
                code = f"{floor}0{n}"
                u = Unit(
                    property_id=hotel.id,
                    code=code,
                    name=f"Phòng {code}",
                    unit_type=UnitType.room,
                    floor=floor,
                    capacity=2,
                    price_per_night=Decimal("450000"),
                    price_per_month=Decimal("8000000"),
                )
                hotel_units.append(u)
                db.add(u)
        db.flush()

        office_units = []
        for floor in (1, 2, 3):
            for n in range(1, 3):
                code = f"VP{floor}{n}"
                u = Unit(
                    property_id=office.id,
                    code=code,
                    name=f"Văn phòng {code}",
                    unit_type=UnitType.office,
                    floor=floor,
                    area_m2=Decimal("35"),
                    capacity=6,
                    price_per_month=Decimal("12000000"),
                    price_per_night=Decimal("500000"),
                )
                office_units.append(u)
                db.add(u)
        db.flush()

        workshop_units = []
        for n, area, price in (("X01", 120, 25000000), ("X02", 200, 40000000), ("X03", 80, 18000000)):
            u = Unit(
                property_id=workshop.id,
                code=n,
                name=f"Gian xưởng {n}",
                unit_type=UnitType.workshop,
                floor=1,
                area_m2=Decimal(str(area)),
                capacity=20,
                price_per_month=Decimal(str(price)),
            )
            workshop_units.append(u)
            db.add(u)
        db.flush()

        for u in hotel_units[:2]:
            db.add(
                Asset(
                    unit_id=u.id,
                    name="Máy lạnh",
                    category="Điện máy",
                    quantity=1,
                    condition=AssetCondition.good,
                    supplier="Điện Máy Xanh",
                    purchased_at=date.today() - timedelta(days=400),
                    last_repaired_at=date.today() - timedelta(days=45),
                    purchase_value=Decimal("8000000"),
                )
            )
            db.add(
                Asset(
                    unit_id=u.id,
                    name="Giường đôi",
                    category="Nội thất",
                    quantity=1,
                    condition=AssetCondition.good,
                    supplier="Nội Thất Hòa Phát",
                    purchased_at=date.today() - timedelta(days=300),
                    last_repaired_at=None,
                    purchase_value=Decimal("4500000"),
                )
            )

        t_guest = Tenant(full_name="Nguyễn Văn A", phone="0912345678", email="a@example.com", id_number="079085001234")
        t_office = Tenant(
            full_name="Trần Thị B",
            phone="0987654321",
            email="b@company.vn",
            company="Công ty ABC",
            id_number="079090005678",
        )
        t_ws = Tenant(full_name="Lê Văn C", phone="0909999888", company="Xưởng C cơ khí")
        db.add_all([t_guest, t_office, t_ws])
        db.flush()

        tenant_user = User(
            email="tenant@example.com",
            password_hash=hash_password("tenant123"),
            full_name=t_office.full_name,
            role=UserRole.tenant,
            tenant_id=t_office.id,
            phone=t_office.phone,
        )
        db.add(tenant_user)

        today = date.today()

        # Hotel booking active
        occ1 = Occupancy(
            unit_id=hotel_units[0].id,
            tenant_id=t_guest.id,
            kind=OccupancyKind.booking,
            status=OccupancyStatus.active,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=2),
        )
        db.add(occ1)
        db.flush()
        db.add(
            Booking(
                occupancy_id=occ1.id,
                guests=2,
                rate_per_night=Decimal("450000"),
                total_amount=Decimal("1350000"),
            )
        )
        create_invoice(
            db,
            tenant_id=t_guest.id,
            occupancy_id=occ1.id,
            amount=Decimal("1350000"),
            description="Booking phòng 101",
        )

        # Reserved tomorrow
        occ2 = Occupancy(
            unit_id=hotel_units[1].id,
            tenant_id=t_guest.id,
            kind=OccupancyKind.booking,
            status=OccupancyStatus.reserved,
            start_date=today + timedelta(days=1),
            end_date=today + timedelta(days=3),
        )
        db.add(occ2)
        db.flush()
        db.add(
            Booking(
                occupancy_id=occ2.id,
                guests=1,
                rate_per_night=Decimal("450000"),
                total_amount=Decimal("900000"),
            )
        )

        # Office long-term contract
        occ3 = Occupancy(
            unit_id=office_units[0].id,
            tenant_id=t_office.id,
            kind=OccupancyKind.contract,
            status=OccupancyStatus.active,
            start_date=today.replace(day=1) - timedelta(days=60),
            end_date=today + timedelta(days=120),
        )
        db.add(occ3)
        db.flush()
        db.add(
            Contract(
                occupancy_id=occ3.id,
                contract_no="HD-VP-001",
                deposit=Decimal("24000000"),
                monthly_rent=Decimal("12000000"),
                billing_cycle=BillingCycle.monthly,
                signed_at=occ3.start_date,
            )
        )
        create_invoice(
            db,
            tenant_id=t_office.id,
            occupancy_id=occ3.id,
            amount=Decimal("12000000"),
            description="Tiền thuê VP tháng này",
            due_date=today - timedelta(days=5),
        )
        create_invoice(
            db,
            tenant_id=t_office.id,
            occupancy_id=occ3.id,
            amount=Decimal("24000000"),
            description="Đặt cọc HĐ HD-VP-001 (còn nợ — dùng thử thanh toán online)",
            due_date=today + timedelta(days=7),
        )

        # Workshop contract
        occ4 = Occupancy(
            unit_id=workshop_units[0].id,
            tenant_id=t_ws.id,
            kind=OccupancyKind.contract,
            status=OccupancyStatus.active,
            start_date=today - timedelta(days=90),
            end_date=today + timedelta(days=275),
        )
        db.add(occ4)
        db.flush()
        db.add(
            Contract(
                occupancy_id=occ4.id,
                contract_no="HD-XUONG-001",
                deposit=Decimal("50000000"),
                monthly_rent=Decimal("25000000"),
                billing_cycle=BillingCycle.monthly,
                signed_at=occ4.start_date,
            )
        )

        db.add(
            Expense(
                property_id=hotel.id,
                category="Điện nước",
                amount=Decimal("3500000"),
                expense_date=today - timedelta(days=3),
                description="Hóa đơn điện tháng này",
                status=ExpenseStatus.unpaid,
                due_cycle=ExpenseDueCycle.monthly,
                recurring=True,
                due_date=today + timedelta(days=20),
                next_due_date=compute_next_due_date(
                    today + timedelta(days=20), ExpenseDueCycle.monthly, True
                ),
            )
        )
        db.add(
            Expense(
                property_id=office.id,
                category="Bảo trì",
                amount=Decimal("1500000"),
                expense_date=today - timedelta(days=10),
                description="Sửa điều hòa hành lang",
                status=ExpenseStatus.paid,
                paid_at=datetime.now(timezone.utc) - timedelta(days=8),
                due_cycle=ExpenseDueCycle.quarterly,
                recurring=True,
                due_date=today - timedelta(days=10),
                next_due_date=compute_next_due_date(
                    today - timedelta(days=10), ExpenseDueCycle.quarterly, True
                ),
            )
        )

        db.commit()
        print("Seed OK.")
        print("  admin@example.com / admin123")
        print("  manager.hotel@example.com / manager123")
        print("  manager.office@example.com / manager123")
        print("  manager.workshop@example.com / manager123")
        print("  tenant@example.com / tenant123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
