import os
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, DateTime,
    ForeignKey, Text, Date
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


def get_db_path():
    env = os.getenv("FLASK_ENV", "development")
    if env == "test":
        return "sqlite:///:memory:"
    return f"sqlite:///{os.getenv('DB_PATH', 'demo.db')}"


def create_db_engine():
    return create_engine(get_db_path(), connect_args={"check_same_thread": False})


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    slug = Column(String(50), nullable=False, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    price = Column(Integer, nullable=False)
    in_stock = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    category = relationship("Category", back_populates="products")

    def is_available(self):
        return self.in_stock


class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    session_key = Column(String(255), nullable=False, unique=True)
    data = Column(Text, default="{}")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    interval_days = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product")

    def subtotal(self):
        return self.product.price * self.quantity


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    total_price = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    subscriptions = relationship("Subscription", back_populates="order")

    def calc_total(self, items):
        subtotal = sum(item.subtotal() for item in items)
        return int(subtotal * 1.10)

    def validate(self):
        errors = []
        if not (1 <= len(self.name) <= 100):
            errors.append("氏名は1〜100文字で入力してください。")
        if not (1 <= len(self.address) <= 255):
            errors.append("住所は1〜255文字で入力してください。")
        if not self.phone.isdigit() or not (10 <= len(self.phone) <= 11):
            errors.append("電話番号は数字のみ・10〜11桁で入力してください。")
        return errors


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    session_id = Column(String(255), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    interval_days = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    next_delivery = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    order = relationship("Order", back_populates="subscriptions")
    product = relationship("Product")

    def calc_next_date(self, base_date):
        from datetime import timedelta
        return base_date + timedelta(days=self.interval_days)

    def pause(self):
        self.status = "paused"
        self.next_delivery = None
        self.updated_at = datetime.now(timezone.utc)

    def resume(self, base_date):
        from datetime import date
        self.status = "active"
        self.next_delivery = self.calc_next_date(base_date)
        self.updated_at = datetime.now(timezone.utc)

    def cancel(self):
        self.status = "cancelled"
        self.updated_at = datetime.now(timezone.utc)

    def change_interval(self, new_interval_days, base_date):
        from datetime import timedelta
        self.interval_days = new_interval_days
        self.next_delivery = base_date + timedelta(days=new_interval_days)
        self.updated_at = datetime.now(timezone.utc)


class ResetLog(Base):
    __tablename__ = "reset_logs"

    id = Column(Integer, primary_key=True)
    executed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    tables_reset = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False)
