import { ApiError, alertBox, api, confirmDialog, el, errorBox, formatYen, icon } from "./lib.js";
import { UI } from "./messages.js";

const root = document.getElementById("app");
const cartBadge = document.getElementById("cart-badge");

const CATEGORY_ICONS = {
  kitchen: "kitchen-set",
  bathroom: "shower",
  toilet: "toilet",
};
const DEFAULT_CATEGORY_ICON = "box-archive";

function setContent(...nodes) {
  root.replaceChildren(...nodes);
}

function setCartBadge(count) {
  cartBadge.textContent = String(count);
  cartBadge.hidden = count === 0;
}

async function refreshCartBadge() {
  try {
    const cart = await api("/api/cart");
    setCartBadge(cart.count);
  } catch (error) {
    console.error("cart badge refresh failed", error);
    cartBadge.hidden = true;
  }
}

function heroSection(title, description) {
  return el(
    "section",
    { class: "page-hero" },
    el("h1", {}, icon(title.icon), ` ${title.text}`),
    description ? el("p", { text: description }) : null,
  );
}

// ── 商品一覧 ─────────────────────────────────────────────────────────────

async function renderProducts() {
  document.title = UI.titles.products;
  const category = new URLSearchParams(location.search).get("category") ?? "";
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const data = await api(`/api/products${query}`);

  const feedback = el("div");
  const filter = el(
    "div",
    { class: "filter-bar" },
    el("a", { href: "/", class: `filter-btn${data.selectedCategory ? "" : " active"}`, text: UI.products.filterAll }),
    data.categories.map((cat) =>
      el("a", {
        href: `/?category=${encodeURIComponent(cat.slug)}`,
        class: `filter-btn${data.selectedCategory === cat.slug ? " active" : ""}`,
        text: cat.name,
      }),
    ),
  );
  const grid =
    data.products.length === 0
      ? el("p", { class: "empty-msg", text: UI.products.empty })
      : el(
          "div",
          { class: "product-grid" },
          data.products.map((product) => productCard(product, data, feedback)),
        );

  setContent(heroSection({ icon: "store", text: UI.products.heroTitle }, UI.products.heroDescription), filter, feedback, grid);
}

function productCard(product, data, feedback) {
  const iconName = CATEGORY_ICONS[product.categorySlug] ?? DEFAULT_CATEGORY_ICON;
  return el(
    "article",
    { class: `product-card${product.inStock ? "" : " out-of-stock"}` },
    el("div", { class: "product-icon" }, icon(iconName)),
    el(
      "div",
      { class: "product-info" },
      el("span", { class: "product-category", text: product.categoryName }),
      el("h2", { class: "product-name", text: product.name }),
      el("p", { class: "product-price" }, formatYen(product.price), " ", el("span", { class: "price-note", text: UI.products.priceNote })),
      product.inStock
        ? el("p", { class: "stock-badge in", text: UI.products.inStock })
        : el("p", { class: "stock-badge out", text: UI.products.outOfStock }),
      product.inStock ? addToCartForm(product, data, feedback) : null,
    ),
  );
}

function addToCartForm(product, data, feedback) {
  const quantitySelect = el(
    "select",
    { name: "quantity", "aria-label": UI.products.quantityLabel },
    Array.from({ length: data.quantityMax }, (_, index) => el("option", { value: index + 1, text: String(index + 1) })),
  );
  const intervalSelect = el(
    "select",
    { name: "interval_days", "aria-label": UI.products.intervalLabel },
    data.intervalOptions.map((days) => el("option", { value: days, text: `${days}${UI.common.intervalSuffix}` })),
  );

  return el(
    "form",
    {
      class: "add-form",
      onsubmit: async (event) => {
        event.preventDefault();
        feedback.replaceChildren();
        try {
          await api("/api/cart/add", {
            method: "POST",
            body: {
              productId: product.id,
              quantity: Number(quantitySelect.value),
              intervalDays: Number(intervalSelect.value),
            },
          });
          location.assign("/cart");
        } catch (error) {
          feedback.replaceChildren(errorBox(error));
        }
      },
    },
    el(
      "div",
      { class: "form-row" },
      el("label", { text: UI.products.quantityLabel }),
      quantitySelect,
    ),
    el(
      "div",
      { class: "form-row" },
      el("label", { text: UI.products.intervalLabel }),
      intervalSelect,
    ),
    el("button", { type: "submit", class: "btn btn-primary" }, icon("cart-plus"), ` ${UI.products.addToCart}`),
  );
}

// ── カート ───────────────────────────────────────────────────────────────

async function renderCart() {
  document.title = UI.titles.cart;
  const feedback = el("div");
  const body = el("div");
  setContent(heroSection({ icon: "cart-shopping", text: UI.cart.heroTitle }, null), feedback, body);
  await drawCart(body, feedback);
}

async function drawCart(body, feedback) {
  const cart = await api("/api/cart");
  setCartBadge(cart.count);

  if (cart.items.length === 0) {
    body.replaceChildren(
      el(
        "div",
        { class: "empty-cart" },
        icon("cart-shopping"),
        el("p", { text: UI.cart.emptyMessage }),
        el("a", { href: "/", class: "btn btn-primary" }, icon("store"), ` ${UI.cart.toProducts}`),
      ),
    );
    return;
  }

  const reload = () => drawCart(body, feedback).catch((error) => feedback.replaceChildren(errorBox(error)));
  const lines = cart.items.map((item) =>
    el(
      "article",
      { class: "cart-item" },
      el(
        "div",
        { class: "cart-item-info" },
        el("p", { class: "item-name", text: item.productName }),
        el(
          "p",
          { class: "item-price" },
          `${formatYen(item.unitPrice)} × ${item.quantity}${UI.common.quantitySuffix} = `,
          el("strong", { text: formatYen(item.subtotal) }),
        ),
        el("p", { class: "item-interval" }, icon("rotate"), ` ${item.intervalDays}${UI.common.deliveryEvery}`),
      ),
      el(
        "div",
        { class: "cart-item-actions" },
        el(
          "select",
          {
            "aria-label": UI.cart.quantityAria,
            onchange: async (event) => {
              feedback.replaceChildren();
              try {
                await api("/api/cart/update", { method: "POST", body: { itemId: item.id, quantity: Number(event.target.value) } });
                await reload();
              } catch (error) {
                feedback.replaceChildren(errorBox(error));
              }
            },
          },
          Array.from({ length: 5 }, (_, index) => {
            const quantity = index + 1;
            return el("option", { value: quantity, text: `${quantity}${UI.common.quantitySuffix}`, selected: quantity === item.quantity });
          }),
        ),
        el(
          "button",
          {
            type: "button",
            class: "btn btn-danger btn-sm",
            "aria-label": UI.cart.remove,
            title: UI.cart.remove,
            onclick: async () => {
              feedback.replaceChildren();
              try {
                await api("/api/cart/remove", { method: "POST", body: { itemId: item.id } });
                await reload();
              } catch (error) {
                feedback.replaceChildren(errorBox(error));
              }
            },
          },
          icon("trash"),
        ),
      ),
    ),
  );

  body.replaceChildren(
    el(
      "div",
      { class: "cart-layout" },
      el("div", { class: "cart-items" }, lines),
      el(
        "aside",
        { class: "cart-summary" },
        el("h2", { text: UI.cart.summaryTitle }),
        el(
          "dl",
          {},
          el("dt", { text: UI.cart.subtotal }),
          el("dd", { text: formatYen(cart.subtotal) }),
          el("dt", { text: UI.cart.tax }),
          el("dd", { text: formatYen(cart.total - cart.subtotal) }),
          el("dt", { class: "total-label", text: UI.cart.total }),
          el("dd", { class: "total-price", text: formatYen(cart.total) }),
        ),
        el("a", { href: "/checkout", class: "btn btn-primary btn-lg" }, icon("credit-card"), ` ${UI.cart.goCheckout}`),
        el("a", { href: "/", class: "btn btn-outline btn-lg" }, icon("arrow-left"), ` ${UI.cart.continueShopping}`),
      ),
    ),
  );
}

// ── 注文確定 ─────────────────────────────────────────────────────────────

async function renderCheckout() {
  document.title = UI.titles.checkout;
  let checkout;
  try {
    checkout = await api("/api/checkout");
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      location.replace("/cart");
      return;
    }
    throw error;
  }

  const feedback = el("div");
  const nameInput = el("input", { type: "text", id: "name", name: "name", maxlength: 100, required: true, placeholder: UI.checkout.namePlaceholder });
  const addressInput = el("input", { type: "text", id: "address", name: "address", maxlength: 255, required: true, placeholder: UI.checkout.addressPlaceholder });
  const phoneInput = el("input", { type: "tel", id: "phone", name: "phone", maxlength: 11, required: true, placeholder: UI.checkout.phonePlaceholder });
  // ハニーポット: 人間には見えず、Bot だけが埋める欄。値が入っていれば API が拒否する。
  const honeypotInput = el("input", { type: "text", name: "website", autocomplete: "off", tabindex: "-1", hidden: true, "aria-hidden": "true" });

  const form = el(
    "form",
    {
      class: "checkout-form",
      onsubmit: async (event) => {
        event.preventDefault();
        feedback.replaceChildren();
        try {
          await api("/api/checkout", {
            method: "POST",
            body: {
              name: nameInput.value,
              address: addressInput.value,
              phone: phoneInput.value,
              website: honeypotInput.value,
            },
          });
          location.assign("/checkout/complete");
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            location.replace("/");
            return;
          }
          feedback.replaceChildren(errorBox(error));
        }
      },
    },
    honeypotInput,
    el("div", { class: "field" }, el("label", { for: "name" }, UI.checkout.name, " ", el("span", { class: "req", text: UI.checkout.required })), nameInput),
    el("div", { class: "field" }, el("label", { for: "address" }, UI.checkout.address, " ", el("span", { class: "req", text: UI.checkout.required })), addressInput),
    el(
      "div",
      { class: "field" },
      el("label", { for: "phone" }, UI.checkout.phone, " ", el("span", { class: "req", text: UI.checkout.required })),
      phoneInput,
      el("small", { text: UI.checkout.phoneHint }),
    ),
    el(
      "div",
      { class: "field" },
      el("label", { text: UI.checkout.paymentLabel }),
      el("div", { class: "payment-demo" }, icon("coins"), ` ${UI.checkout.paymentDemo}`),
    ),
    el("button", { type: "submit", class: "btn btn-primary btn-lg" }, icon("check"), ` ${UI.checkout.submit}`),
  );

  const summary = el(
    "aside",
    { class: "checkout-summary" },
    el("h2", { text: UI.checkout.summaryTitle }),
    checkout.items.map((item) =>
      el(
        "div",
        { class: "summary-item" },
        el("p", { class: "s-name", text: item.productName }),
        el("p", { class: "s-detail", text: `${item.quantity}${UI.common.quantitySuffix} / ${item.intervalDays}${UI.common.intervalSuffix}` }),
        el("p", { class: "s-price", text: formatYen(item.subtotal) }),
      ),
    ),
    el(
      "div",
      { class: "summary-total" },
      el(
        "dl",
        {},
        el("dt", { text: UI.cart.subtotal }),
        el("dd", { text: formatYen(checkout.subtotal) }),
        el("dt", { text: UI.cart.tax }),
        el("dd", { text: formatYen(checkout.total - checkout.subtotal) }),
        el("dt", { class: "total-label", text: UI.cart.total }),
        el("dd", { class: "total-price", text: formatYen(checkout.total) }),
      ),
    ),
  );

  setContent(
    heroSection({ icon: "credit-card", text: UI.checkout.heroTitle }, null),
    feedback,
    el(
      "div",
      { class: "checkout-layout" },
      el("div", { class: "checkout-form-wrap" }, el("h2", { text: UI.checkout.shippingTitle }), form),
      summary,
    ),
  );
}

// ── 注文完了 ─────────────────────────────────────────────────────────────

function renderComplete() {
  document.title = UI.titles.complete;
  setContent(
    el(
      "div",
      { class: "complete-wrap" },
      el("div", { class: "complete-icon" }, icon("circle-check")),
      el("h1", { text: UI.complete.title }),
      el("p", {}, UI.complete.body, el("br"), UI.complete.bodyHint),
      el(
        "div",
        { class: "complete-actions" },
        el("a", { href: "/my-subs", class: "btn btn-primary btn-lg" }, icon("rotate"), ` ${UI.complete.toMySubs}`),
        el("a", { href: "/", class: "btn btn-outline btn-lg" }, icon("store"), ` ${UI.complete.toProducts}`),
      ),
    ),
  );
}

// ── マイサブスク ──────────────────────────────────────────────────────────

async function renderMySubs() {
  document.title = UI.titles.mySubs;
  const feedback = el("div");
  const body = el("div");
  setContent(heroSection({ icon: "rotate", text: UI.mySubs.heroTitle }, UI.mySubs.heroDescription), feedback, body);
  await drawSubs(body, feedback);
}

async function drawSubs(body, feedback) {
  const data = await api("/api/my-subs");
  const reload = () => drawSubs(body, feedback).catch((error) => feedback.replaceChildren(errorBox(error)));

  if (data.subs.length === 0) {
    body.replaceChildren(
      el(
        "div",
        { class: "empty-cart" },
        icon("rotate"),
        el("p", { text: UI.mySubs.empty }),
        el("a", { href: "/", class: "btn btn-primary" }, icon("store"), ` ${UI.cart.toProducts}`),
      ),
    );
    return;
  }

  const runAction = (action) => async () => {
    feedback.replaceChildren();
    try {
      await action();
      await reload();
    } catch (error) {
      feedback.replaceChildren(errorBox(error));
    }
  };

  body.replaceChildren(
    el(
      "div",
      { class: "subs-list" },
      data.subs.map((sub) => subCard(sub, runAction)),
    ),
  );
}

function subCard(sub, runAction) {
  const statusBadge =
    sub.status === "active"
      ? el("span", { class: "badge active" }, icon("circle-check"), ` ${UI.mySubs.statusActive}`)
      : sub.status === "paused"
        ? el("span", { class: "badge paused" }, icon("circle-pause"), ` ${UI.mySubs.statusPaused}`)
        : null;

  const actions = [];
  if (sub.status === "active") {
    actions.push(
      el(
        "div",
        { class: "inline-form" },
        el(
          "select",
          {
            "aria-label": UI.mySubs.intervalAria,
            onchange: (event) =>
              runAction(() =>
                api(`/api/my-subs/${sub.id}/change-interval`, { method: "POST", body: { intervalDays: Number(event.target.value) } }),
              )(),
          },
          [14, 30, 60].map((days) =>
            el("option", { value: days, text: `${days}${UI.common.intervalSuffix}`, selected: days === sub.intervalDays }),
          ),
        ),
      ),
    );
    actions.push(
      el(
        "button",
        {
          type: "button",
          class: "btn btn-warning btn-sm",
          onclick: runAction(() => api(`/api/my-subs/${sub.id}/pause`, { method: "POST" })),
        },
        icon("pause"),
        ` ${UI.mySubs.pause}`,
      ),
    );
  } else if (sub.status === "paused") {
    actions.push(
      el(
        "button",
        {
          type: "button",
          class: "btn btn-primary btn-sm",
          onclick: runAction(() => api(`/api/my-subs/${sub.id}/resume`, { method: "POST" })),
        },
        icon("play"),
        ` ${UI.mySubs.resume}`,
      ),
    );
  }
  actions.push(
    el(
      "button",
      {
        type: "button",
        class: "btn btn-danger btn-sm",
        onclick: async () => {
          const confirmed = await confirmDialog(UI.mySubs.cancelQuestion, UI.mySubs.cancelYes, UI.mySubs.cancelNo);
          if (confirmed) {
            await runAction(() => api(`/api/my-subs/${sub.id}/cancel`, { method: "POST" }))();
          }
        },
      },
      icon("ban"),
      ` ${UI.mySubs.cancel}`,
    ),
  );

  return el(
    "article",
    { class: `sub-card status-${sub.status}` },
    el(
      "div",
      { class: "sub-info" },
      el("h2", { class: "sub-name", text: sub.productName }),
      el("p", { class: "sub-detail", text: `${sub.quantity}${UI.common.quantitySuffix} / ${sub.intervalDays}${UI.common.deliveryEvery}` }),
      el(
        "p",
        { class: "sub-price" },
        `${formatYen(sub.subtotal)}${UI.common.taxExcludedLabel}`,
        " ",
        `(${formatYen(sub.total)} ${UI.common.taxIncludedLabel})`,
      ),
      el(
        "p",
        { class: "sub-status" },
        statusBadge,
        sub.status === "active" && sub.nextDelivery ? ` ${UI.mySubs.nextDelivery}${sub.nextDelivery}` : null,
      ),
    ),
    el("div", { class: "sub-actions" }, actions),
  );
}

// ── 404 ───────────────────────────────────────────────────────────────────

function renderNotFound() {
  document.title = UI.titles.notFound;
  setContent(
    el(
      "div",
      { class: "complete-wrap" },
      el("div", { class: "complete-icon error-icon" }, icon("triangle-exclamation")),
      el("h1", { text: `${UI.common.errorTitle} 404` }),
      el("p", { text: UI.common.notFound }),
      el("div", { class: "complete-actions" }, el("a", { href: "/", class: "btn btn-primary" }, icon("house"), ` ${UI.common.toTop}`)),
    ),
  );
}

// ── ルーティング（旧 Flask のパスと同じ） ────────────────────────────────────

const ROUTES = new Map([
  ["/", renderProducts],
  ["/cart", renderCart],
  ["/checkout", renderCheckout],
  ["/checkout/complete", renderComplete],
  ["/my-subs", renderMySubs],
]);

function normalizePath(pathname) {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

async function boot() {
  const render = ROUTES.get(normalizePath(location.pathname)) ?? renderNotFound;
  refreshCartBadge();
  try {
    await render();
  } catch (error) {
    console.error("page render failed", error);
    setContent(alertBox(UI.common.loadFailed));
  }
}

boot();
