"""ルートの統合テスト"""
import pytest
from app import app, DBSession
from models import Base, CartItem, Order, Subscription
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from seed import run_seed
import os


@pytest.fixture(scope="function")
def test_app():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as s:
        run_seed(s)

    import app as app_module
    app_module.DBSession = Session

    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"
    with app.test_client() as c:
        yield c, Session


# ── 商品一覧 ────────────────────────────────────────────────────────────

def test_index_returns_200(test_app):
    c, _ = test_app
    resp = c.get("/")
    assert resp.status_code == 200


def test_index_shows_product_names(test_app):
    c, _ = test_app
    resp = c.get("/")
    body = resp.data.decode("utf-8")
    assert "食器用スポンジ" in body


def test_index_filter_by_category(test_app):
    c, _ = test_app
    resp = c.get("/?category=kitchen")
    body = resp.data.decode("utf-8")
    assert "食器用スポンジ" in body
    assert "浴室用洗剤" not in body


def test_index_invalid_category_returns_all(test_app):
    c, _ = test_app
    resp = c.get("/?category=nonexistent")
    assert resp.status_code == 200


# ── カート ───────────────────────────────────────────────────────────────

def test_cart_empty_returns_200(test_app):
    c, _ = test_app
    resp = c.get("/cart")
    assert resp.status_code == 200


def test_cart_add_valid_product(test_app):
    c, _ = test_app
    resp = c.post("/cart/add", data={"product_id": 1, "quantity": 2, "interval_days": 30})
    assert resp.status_code == 302
    assert "/cart" in resp.headers["Location"]


def test_cart_add_invalid_quantity(test_app):
    c, _ = test_app
    resp = c.post("/cart/add", data={"product_id": 1, "quantity": 6, "interval_days": 30})
    assert resp.status_code == 400


def test_cart_add_invalid_interval(test_app):
    c, _ = test_app
    resp = c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 7})
    assert resp.status_code == 400


def test_cart_add_out_of_stock_product(test_app):
    c, _ = test_app
    resp = c.post("/cart/add", data={"product_id": 12, "quantity": 1, "interval_days": 30})
    assert resp.status_code == 400


def test_cart_shows_added_item(test_app):
    c, _ = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 2, "interval_days": 30})
    resp = c.get("/cart")
    body = resp.data.decode("utf-8")
    assert "食器用スポンジ" in body


def test_cart_total_includes_tax(test_app):
    c, Session = test_app
    c.post("/cart/add", data={"product_id": 2, "quantity": 1, "interval_days": 30})
    resp = c.get("/cart")
    body = resp.data.decode("utf-8")
    tax_included = int(198 * 1.10)
    assert str(tax_included) in body


def test_cart_remove_item(test_app):
    c, Session = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 30})
    with Session() as db:
        item = db.query(CartItem).first()
        item_id = item.id
    resp = c.post("/cart/remove", data={"item_id": item_id})
    assert resp.status_code == 302


def test_cart_update_quantity(test_app):
    c, Session = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 30})
    with Session() as db:
        item = db.query(CartItem).first()
        item_id = item.id
    resp = c.post("/cart/update", data={"item_id": item_id, "quantity": 3})
    assert resp.status_code == 302
    with Session() as db:
        updated = db.get(CartItem, item_id)
        assert updated.quantity == 3


# ── 注文確定 ─────────────────────────────────────────────────────────────

def test_checkout_get_redirects_if_cart_empty(test_app):
    c, _ = test_app
    resp = c.get("/checkout")
    assert resp.status_code == 302


def test_checkout_post_honeypot_rejected(test_app):
    c, _ = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 30})
    resp = c.post("/checkout", data={
        "name": "山田太郎", "address": "東京都1-1", "phone": "09012345678",
        "website": "bot-value"
    })
    assert resp.status_code == 400


def test_checkout_post_creates_subscription(test_app):
    c, Session = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 30})
    resp = c.post("/checkout", data={
        "name": "山田太郎", "address": "東京都渋谷区1-1-1", "phone": "09012345678",
        "website": ""
    })
    assert resp.status_code == 302
    with Session() as db:
        assert db.query(Order).count() == 1
        assert db.query(Subscription).count() == 1
        sub = db.query(Subscription).first()
        assert sub.status == "active"
        assert sub.next_delivery is not None


def test_checkout_post_clears_cart(test_app):
    c, Session = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 30})
    c.post("/checkout", data={
        "name": "山田太郎", "address": "東京都渋谷区1-1-1", "phone": "09012345678",
        "website": ""
    })
    with Session() as db:
        assert db.query(CartItem).count() == 0


def test_checkout_post_validation_error(test_app):
    c, _ = test_app
    c.post("/cart/add", data={"product_id": 1, "quantity": 1, "interval_days": 30})
    resp = c.post("/checkout", data={
        "name": "", "address": "東京都渋谷区1-1-1", "phone": "09012345678",
        "website": ""
    })
    assert resp.status_code == 200
    assert "氏名" in resp.data.decode("utf-8")


# ── マイサブスク ──────────────────────────────────────────────────────────

def _create_subscription(c, Session, product_id=1, quantity=1, interval=30):
    c.post("/cart/add", data={"product_id": product_id, "quantity": quantity, "interval_days": interval})
    c.post("/checkout", data={
        "name": "山田太郎", "address": "東京都渋谷区1-1-1", "phone": "09012345678",
        "website": ""
    })
    with Session() as db:
        return db.query(Subscription).first().id


def test_my_subs_shows_active_subscription(test_app):
    c, Session = test_app
    _create_subscription(c, Session)
    resp = c.get("/my-subs")
    body = resp.data.decode("utf-8")
    assert "食器用スポンジ" in body
    assert "配送中" in body


def test_sub_pause(test_app):
    c, Session = test_app
    sub_id = _create_subscription(c, Session)
    resp = c.post(f"/my-subs/{sub_id}/pause")
    assert resp.status_code == 302
    with Session() as db:
        sub = db.get(Subscription, sub_id)
        assert sub.status == "paused"
        assert sub.next_delivery is None


def test_sub_resume(test_app):
    c, Session = test_app
    sub_id = _create_subscription(c, Session)
    c.post(f"/my-subs/{sub_id}/pause")
    resp = c.post(f"/my-subs/{sub_id}/resume")
    assert resp.status_code == 302
    with Session() as db:
        sub = db.get(Subscription, sub_id)
        assert sub.status == "active"
        assert sub.next_delivery is not None


def test_sub_cancel(test_app):
    c, Session = test_app
    sub_id = _create_subscription(c, Session)
    resp = c.post(f"/my-subs/{sub_id}/cancel")
    assert resp.status_code == 302
    with Session() as db:
        sub = db.get(Subscription, sub_id)
        assert sub.status == "cancelled"


def test_sub_change_interval(test_app):
    c, Session = test_app
    sub_id = _create_subscription(c, Session)
    resp = c.post(f"/my-subs/{sub_id}/change-interval", data={"interval_days": 14})
    assert resp.status_code == 302
    with Session() as db:
        sub = db.get(Subscription, sub_id)
        assert sub.interval_days == 14


def test_sub_invalid_interval_rejected(test_app):
    c, Session = test_app
    sub_id = _create_subscription(c, Session)
    resp = c.post(f"/my-subs/{sub_id}/change-interval", data={"interval_days": 7})
    assert resp.status_code == 400


def test_other_session_cannot_access_sub(test_app):
    c, Session = test_app
    sub_id = _create_subscription(c, Session)
    from flask import Flask
    app2 = app
    with app2.test_client() as c2:
        resp = c2.post(f"/my-subs/{sub_id}/pause")
        assert resp.status_code == 404
