import os
import logging
from datetime import date, datetime

from flask import (
    Flask, render_template, request, session,
    redirect, url_for, jsonify, abort
)
from sqlalchemy.orm import sessionmaker

from models import (
    Base, Category, Product, CartItem, Order,
    Subscription, ResetLog, create_db_engine
)
from seed import run_seed
from scheduler import start_scheduler

logging.basicConfig(
    level=logging.DEBUG if os.getenv("FLASK_ENV") != "production" else logging.WARNING
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "demo-secret-change-in-prod")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

engine = create_db_engine()
Base.metadata.create_all(engine)
DBSession = sessionmaker(bind=engine)

with DBSession() as s:
    run_seed(s)

if os.getenv("FLASK_ENV") != "test":
    start_scheduler(DBSession, ResetLog)

INTERVAL_OPTIONS = [14, 30, 60]
TAX_RATE = 1.10


def get_session_key():
    if "sid" not in session:
        import uuid
        session["sid"] = str(uuid.uuid4())
    return session["sid"]


# ── 商品一覧 ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    sid = get_session_key()
    with DBSession() as db:
        categories = db.query(Category).order_by(Category.id).all()
        slug = request.args.get("category")
        query = db.query(Product)
        if slug:
            cat = db.query(Category).filter_by(slug=slug).first()
            if cat:
                query = query.filter_by(category_id=cat.id)
        products = query.order_by(Product.id).all()
        cart_count = db.query(CartItem).filter_by(session_id=sid).count()
        return render_template(
            "index.html",
            categories=categories,
            products=products,
            selected_slug=slug,
            cart_count=cart_count,
            interval_options=INTERVAL_OPTIONS,
        )


# ── カート ───────────────────────────────────────────────────────────────────

@app.route("/cart")
def cart():
    sid = get_session_key()
    with DBSession() as db:
        items = (
            db.query(CartItem)
            .filter_by(session_id=sid)
            .join(Product)
            .all()
        )
        subtotal = sum(i.subtotal() for i in items)
        total = int(subtotal * TAX_RATE)
        return render_template("cart.html", items=items, subtotal=subtotal, total=total)


@app.route("/cart/add", methods=["POST"])
def cart_add():
    sid = get_session_key()
    product_id = request.form.get("product_id", type=int)
    quantity = request.form.get("quantity", type=int)
    interval_days = request.form.get("interval_days", type=int)

    if not product_id or quantity not in range(1, 6) or interval_days not in INTERVAL_OPTIONS:
        abort(400, "入力値が不正です。")

    with DBSession() as db:
        product = db.get(Product, product_id)
        if not product or not product.is_available():
            abort(400, "この商品は現在購入できません。")

        existing = (
            db.query(CartItem)
            .filter_by(session_id=sid, product_id=product_id, interval_days=interval_days)
            .first()
        )
        if existing:
            existing.quantity = min(existing.quantity + quantity, 5)
        else:
            db.add(CartItem(
                session_id=sid,
                product_id=product_id,
                quantity=quantity,
                interval_days=interval_days,
            ))
        db.commit()

    return redirect(url_for("cart"))


@app.route("/cart/update", methods=["POST"])
def cart_update():
    sid = get_session_key()
    item_id = request.form.get("item_id", type=int)
    quantity = request.form.get("quantity", type=int)

    if not item_id or quantity not in range(1, 6):
        abort(400, "入力値が不正です。")

    with DBSession() as db:
        item = db.query(CartItem).filter_by(id=item_id, session_id=sid).first()
        if not item:
            abort(404)
        item.quantity = quantity
        db.commit()

    return redirect(url_for("cart"))


@app.route("/cart/remove", methods=["POST"])
def cart_remove():
    sid = get_session_key()
    item_id = request.form.get("item_id", type=int)

    with DBSession() as db:
        item = db.query(CartItem).filter_by(id=item_id, session_id=sid).first()
        if not item:
            abort(404)
        db.delete(item)
        db.commit()

    return redirect(url_for("cart"))


# ── 注文確定 ─────────────────────────────────────────────────────────────────

@app.route("/checkout", methods=["GET", "POST"])
def checkout():
    sid = get_session_key()

    if request.method == "POST":
        # ハニーポット
        if request.form.get("website"):
            logger.warning("ハニーポット検知: session=%s ip=%s", sid, request.remote_addr)
            abort(400, "不正なリクエストを検知しました。")

        name = request.form.get("name", "").strip()
        address = request.form.get("address", "").strip()
        phone = request.form.get("phone", "").strip()

        with DBSession() as db:
            items = db.query(CartItem).filter_by(session_id=sid).join(Product).all()
            if not items:
                return redirect(url_for("index"))

            order = Order(session_id=sid, name=name, address=address, phone=phone, total_price=0)
            errors = order.validate()
            if errors:
                subtotal = sum(i.subtotal() for i in items)
                total = int(subtotal * TAX_RATE)
                return render_template(
                    "checkout.html",
                    items=items,
                    subtotal=subtotal,
                    total=total,
                    errors=errors,
                    form={"name": name, "address": address, "phone": phone},
                )

            subtotal = sum(i.subtotal() for i in items)
            order.total_price = int(subtotal * TAX_RATE)
            db.add(order)
            db.flush()

            today = date.today()
            for item in items:
                sub = Subscription(
                    order_id=order.id,
                    session_id=sid,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    interval_days=item.interval_days,
                    status="active",
                )
                sub.next_delivery = sub.calc_next_date(today)
                db.add(sub)

            db.query(CartItem).filter_by(session_id=sid).delete()
            db.commit()

        return redirect(url_for("checkout_complete"))

    with DBSession() as db:
        items = db.query(CartItem).filter_by(session_id=sid).join(Product).all()
        if not items:
            return redirect(url_for("cart"))
        subtotal = sum(i.subtotal() for i in items)
        total = int(subtotal * TAX_RATE)
        return render_template(
            "checkout.html",
            items=items,
            subtotal=subtotal,
            total=total,
            errors=[],
            form={},
        )


@app.route("/checkout/complete")
def checkout_complete():
    return render_template("checkout_complete.html")


# ── マイサブスク ──────────────────────────────────────────────────────────────

@app.route("/my-subs")
def my_subs():
    sid = get_session_key()
    with DBSession() as db:
        subs = (
            db.query(Subscription)
            .filter_by(session_id=sid)
            .filter(Subscription.status != "cancelled")
            .join(Product)
            .order_by(Subscription.id.desc())
            .all()
        )
        return render_template("my_subs.html", subs=subs, interval_options=INTERVAL_OPTIONS)


@app.route("/my-subs/<int:sub_id>/pause", methods=["POST"])
def sub_pause(sub_id):
    sid = get_session_key()
    with DBSession() as db:
        sub = db.query(Subscription).filter_by(id=sub_id, session_id=sid).first()
        if not sub:
            abort(404)
        if sub.status != "active":
            abort(400, "有効なサブスクリプションのみ一時停止できます。")
        sub.pause()
        db.commit()
    return redirect(url_for("my_subs"))


@app.route("/my-subs/<int:sub_id>/resume", methods=["POST"])
def sub_resume(sub_id):
    sid = get_session_key()
    with DBSession() as db:
        sub = db.query(Subscription).filter_by(id=sub_id, session_id=sid).first()
        if not sub:
            abort(404)
        if sub.status != "paused":
            abort(400, "停止中のサブスクリプションのみ再開できます。")
        sub.resume(date.today())
        db.commit()
    return redirect(url_for("my_subs"))


@app.route("/my-subs/<int:sub_id>/cancel", methods=["POST"])
def sub_cancel(sub_id):
    sid = get_session_key()
    with DBSession() as db:
        sub = db.query(Subscription).filter_by(id=sub_id, session_id=sid).first()
        if not sub:
            abort(404)
        sub.cancel()
        db.commit()
    return redirect(url_for("my_subs"))


@app.route("/my-subs/<int:sub_id>/change-interval", methods=["POST"])
def sub_change_interval(sub_id):
    sid = get_session_key()
    new_interval = request.form.get("interval_days", type=int)
    if new_interval not in INTERVAL_OPTIONS:
        abort(400, "配送間隔が不正です。")

    with DBSession() as db:
        sub = db.query(Subscription).filter_by(id=sub_id, session_id=sid).first()
        if not sub:
            abort(404)
        if sub.status != "active":
            abort(400, "有効なサブスクリプションのみ変更できます。")
        sub.change_interval(new_interval, date.today())
        db.commit()
    return redirect(url_for("my_subs"))


# ── エラーハンドラ ────────────────────────────────────────────────────────────

@app.errorhandler(400)
def bad_request(e):
    return render_template("error.html", code=400, message=str(e.description)), 400


@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="ページが見つかりません。"), 404


if __name__ == "__main__":
    debug = os.getenv("FLASK_ENV") != "production"
    app.run(debug=debug, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
