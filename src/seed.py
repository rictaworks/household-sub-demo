from models import Category, Product, Base, create_db_engine
from sqlalchemy.orm import sessionmaker

CATEGORIES = [
    {"id": 1, "name": "キッチン", "slug": "kitchen"},
    {"id": 2, "name": "バスルーム", "slug": "bathroom"},
    {"id": 3, "name": "トイレ", "slug": "toilet"},
    {"id": 4, "name": "その他", "slug": "other"},
]

PRODUCTS = [
    {"id": 1,  "category_id": 1, "name": "食器用スポンジ（3個入り）",      "price": 298, "in_stock": True},
    {"id": 2,  "category_id": 1, "name": "食器用洗剤（詰替）",             "price": 198, "in_stock": True},
    {"id": 3,  "category_id": 1, "name": "キッチンペーパー（200枚）",      "price": 398, "in_stock": True},
    {"id": 4,  "category_id": 1, "name": "アルミホイル（30m）",            "price": 298, "in_stock": True},
    {"id": 5,  "category_id": 2, "name": "浴室用洗剤",                    "price": 348, "in_stock": True},
    {"id": 6,  "category_id": 2, "name": "シャンプー（詰替）",             "price": 498, "in_stock": True},
    {"id": 7,  "category_id": 2, "name": "ボディソープ（詰替）",           "price": 448, "in_stock": True},
    {"id": 8,  "category_id": 3, "name": "トイレ用洗剤",                   "price": 298, "in_stock": True},
    {"id": 9,  "category_id": 3, "name": "トイレットペーパー（12ロール）", "price": 598, "in_stock": True},
    {"id": 10, "category_id": 4, "name": "ティッシュペーパー（5箱）",     "price": 498, "in_stock": True},
    {"id": 11, "category_id": 4, "name": "ゴミ袋（20枚入り）",            "price": 248, "in_stock": True},
    {"id": 12, "category_id": 4, "name": "除菌ウェットシート（80枚）",    "price": 398, "in_stock": False},
]


def run_seed(db_session):
    for c in CATEGORIES:
        if not db_session.get(Category, c["id"]):
            db_session.add(Category(**c))
    for p in PRODUCTS:
        if not db_session.get(Product, p["id"]):
            db_session.add(Product(**p))
    db_session.commit()


if __name__ == "__main__":
    engine = create_db_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as s:
        run_seed(s)
    print("シードデータを投入しました。")
