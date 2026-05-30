# household-sub-demo

世帯向け消耗品サブスクリプション管理サービス — **デモ版**

> 認証なし・SQLite・外部 API なし。サービスの基本体験を提供する体験版です。
> データは毎日 JST 03:00 に自動リセットされます。

---

## 起動方法

```bash
cd src
cp .env.example .env   # 必要に応じて SECRET_KEY を変更
pip install -r requirements.txt
python app.py
```

ブラウザで `http://localhost:5000` を開いてください。

---

## ページ一覧

| ページ名 | URL | 説明 |
|---------|-----|------|
| 商品一覧 | [/](http://localhost:5000/) | カテゴリフィルタ・カートに追加 |
| カート | [/cart](http://localhost:5000/cart) | 数量変更・削除・税込合計確認 |
| 注文手続き | [/checkout](http://localhost:5000/checkout) | 配送先入力・サブスク登録 |
| 注文完了 | [/checkout/complete](http://localhost:5000/checkout/complete) | 登録完了画面 |
| マイサブスク | [/my-subs](http://localhost:5000/my-subs) | 一時停止・再開・解約・間隔変更 |

---

## ルート一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/` | 商品一覧（`?category=slug` でフィルタ） |
| GET | `/cart` | カート表示 |
| POST | `/cart/add` | カートに追加 |
| POST | `/cart/update` | 数量変更 |
| POST | `/cart/remove` | アイテム削除 |
| GET | `/checkout` | 注文フォーム表示 |
| POST | `/checkout` | 注文確定・サブスク登録 |
| GET | `/checkout/complete` | 注文完了 |
| GET | `/my-subs` | サブスク一覧 |
| POST | `/my-subs/<id>/pause` | 一時停止 |
| POST | `/my-subs/<id>/resume` | 再開 |
| POST | `/my-subs/<id>/cancel` | 解約 |
| POST | `/my-subs/<id>/change-interval` | 配送間隔変更 |

---

## 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | Jinja2 テンプレート + Vanilla JS |
| バックエンド | Python / Flask |
| データベース | SQLite |
| セッション | Flask Cookie Session |
| スケジューラ | APScheduler（JST 03:00 DB リセット） |
| テスト | pytest / pytest-flask |
| アイコン | Font Awesome 6 |
| 図解 | Mermaid |

---

## 環境変数

`.env.example` をコピーして `.env` を作成してください。

| 変数名 | デフォルト | 説明 |
|-------|---------|------|
| `FLASK_ENV` | `development` | `development` / `test` / `production` |
| `SECRET_KEY` | `demo-secret-change-in-prod` | Cookie 署名キー（本番は必ず変更） |
| `DB_PATH` | `demo.db` | SQLite ファイルパス |
| `PORT` | `5000` | 起動ポート |

---

## テスト実行

```bash
cd src
pytest tests/ -v
```

**42 件 / 42 件グリーン**（モデルユニット・ルート統合・ハードコードチェック）

---

## ドキュメント

| ドキュメント | パス |
|------------|------|
| API（ルート）仕様書 | [SPEC/api.md](./SPEC/api.md) |
| ER 図 | [SPEC/er-diagram.md](./SPEC/er-diagram.md) |
| シーケンス図 | [SPEC/sequence.md](./SPEC/sequence.md) |
| デモ版設計ドキュメント | [SPEC/household-sub-demo-spec.md](./SPEC/household-sub-demo-spec.md) |
| 開発環境 | [ENV/DEVELOPMENT.md](./ENV/DEVELOPMENT.md) |
| 本番環境 | [ENV/PRODUCTION.md](./ENV/PRODUCTION.md) |
| タスク管理 | [TASKS/](./TASKS/) |
| バグ報告 | [DEBUG/](./DEBUG/) |
| 作業報告 | [WORK/](./WORK/) |
