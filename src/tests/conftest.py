import os
os.environ["FLASK_ENV"] = "test"
os.environ["SECRET_KEY"] = "test-secret"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Category, Product
from seed import run_seed, CATEGORIES, PRODUCTS


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as s:
        run_seed(s)
        yield s
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="function")
def client(db_session):
    import app as app_module
    app_module.DBSession = type(
        "BoundSession",
        (),
        {"__call__": staticmethod(lambda: db_session), "__enter__": lambda s: db_session, "__exit__": lambda s, *a: None},
    )

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    run_seed(SessionLocal())

    from contextlib import contextmanager
    from app import app
    app_module.DBSession = sessionmaker(bind=engine)
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c
