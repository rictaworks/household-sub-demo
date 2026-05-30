"""モデルのユニットテスト"""
from datetime import date, timedelta
import pytest
from models import Category, Product, CartItem, Order, Subscription


def test_category_has_correct_fields(db_session):
    cat = db_session.get(Category, 1)
    assert cat.name == "キッチン"
    assert cat.slug == "kitchen"


def test_product_is_available_when_in_stock(db_session):
    product = db_session.get(Product, 1)
    assert product.in_stock is True
    assert product.is_available() is True


def test_product_not_available_when_out_of_stock(db_session):
    product = db_session.get(Product, 12)
    assert product.in_stock is False
    assert product.is_available() is False


def test_cart_item_subtotal(db_session):
    product = db_session.get(Product, 1)
    item = CartItem(session_id="s1", product_id=product.id, quantity=3, interval_days=30)
    item.product = product
    assert item.subtotal() == product.price * 3


def test_order_validate_passes_with_valid_data(db_session):
    order = Order(session_id="s1", name="山田太郎", address="東京都渋谷区1-1-1", phone="09012345678", total_price=1000)
    errors = order.validate()
    assert errors == []


def test_order_validate_fails_with_invalid_phone(db_session):
    order = Order(session_id="s1", name="山田太郎", address="東京都渋谷区1-1-1", phone="abc", total_price=1000)
    errors = order.validate()
    assert any("電話番号" in e for e in errors)


def test_order_validate_fails_with_short_phone(db_session):
    order = Order(session_id="s1", name="山田太郎", address="東京都渋谷区1-1-1", phone="090", total_price=1000)
    errors = order.validate()
    assert any("電話番号" in e for e in errors)


def test_order_validate_fails_with_empty_name(db_session):
    order = Order(session_id="s1", name="", address="東京都渋谷区1-1-1", phone="09012345678", total_price=1000)
    errors = order.validate()
    assert any("氏名" in e for e in errors)


def test_subscription_calc_next_date():
    sub = Subscription(session_id="s1", order_id=1, product_id=1, quantity=1, interval_days=30)
    base = date(2026, 1, 1)
    next_d = sub.calc_next_date(base)
    assert next_d == date(2026, 1, 31)


def test_subscription_pause():
    sub = Subscription(
        session_id="s1", order_id=1, product_id=1, quantity=1,
        interval_days=30, status="active", next_delivery=date(2026, 2, 1)
    )
    sub.pause()
    assert sub.status == "paused"
    assert sub.next_delivery is None


def test_subscription_resume():
    sub = Subscription(
        session_id="s1", order_id=1, product_id=1, quantity=1,
        interval_days=30, status="paused", next_delivery=None
    )
    sub.resume(date(2026, 1, 10))
    assert sub.status == "active"
    assert sub.next_delivery == date(2026, 2, 9)


def test_subscription_cancel():
    sub = Subscription(
        session_id="s1", order_id=1, product_id=1, quantity=1,
        interval_days=30, status="active", next_delivery=date(2026, 2, 1)
    )
    sub.cancel()
    assert sub.status == "cancelled"


def test_subscription_change_interval():
    sub = Subscription(
        session_id="s1", order_id=1, product_id=1, quantity=1,
        interval_days=30, status="active", next_delivery=date(2026, 2, 1)
    )
    sub.change_interval(14, date(2026, 1, 15))
    assert sub.interval_days == 14
    assert sub.next_delivery == date(2026, 1, 29)


def test_seed_data_count(db_session):
    from models import Category, Product
    assert db_session.query(Category).count() == 4
    assert db_session.query(Product).count() == 12


def test_seed_out_of_stock_product(db_session):
    out_of_stock = db_session.query(Product).filter_by(in_stock=False).all()
    assert len(out_of_stock) == 1
    assert out_of_stock[0].id == 12
