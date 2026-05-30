import logging
from datetime import datetime
import pytz

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
JST = pytz.timezone("Asia/Tokyo")


def reset_demo_db(db_session_factory, ResetLog):
    """毎日 JST 03:00 に動的データをリセットする。マスタデータは保持する。"""
    from models import SessionRecord, CartItem, Order, Subscription
    with db_session_factory() as db:
        try:
            db.query(Subscription).delete()
            db.query(Order).delete()
            db.query(CartItem).delete()
            db.query(SessionRecord).delete()
            log = ResetLog(
                executed_at=datetime.now(JST),
                tables_reset="sessions,cart_items,orders,subscriptions",
                status="success",
            )
            db.add(log)
            db.commit()
            logger.info("DBデイリーリセット完了: %s", datetime.now(JST))
        except Exception as exc:
            db.rollback()
            log = ResetLog(
                executed_at=datetime.now(JST),
                tables_reset="sessions,cart_items,orders,subscriptions",
                status="error",
            )
            db.add(log)
            db.commit()
            logger.error("DBデイリーリセット失敗: %s", exc)
            raise


def start_scheduler(db_session_factory, ResetLog):
    scheduler = BackgroundScheduler(timezone=JST)
    scheduler.add_job(
        reset_demo_db,
        CronTrigger(hour=3, minute=0, timezone=JST),
        args=[db_session_factory, ResetLog],
        id="daily_reset",
        replace_existing=True,
    )
    scheduler.start()
    return scheduler
