import { UI } from "./messages.js";

// 失敗は ApiError にまとめ、画面側で表示する。JSON でない応答は null として扱い、HTTP ステータスで判定する。
export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? UI.common.requestFailed, data?.errors ?? []);
  }
  return data;
}

// 子要素には文字列を textContent として入れる（利用者入力・DB 値を innerHTML に流さない）。
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") {
      node.className = value;
    } else if (key === "text") {
      node.textContent = String(value);
    } else if (key === "value" || key === "checked") {
      node[key] = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function icon(name) {
  return el("i", { class: `fa-solid fa-${name}` });
}

export function formatYen(amount) {
  return `¥${amount.toLocaleString("en-US")}`;
}

export function alertBox(message, details = []) {
  return el(
    "div",
    { class: "alert alert-error", role: "alert" },
    el("p", { text: message }),
    details.length > 0 ? el("ul", {}, details.map((detail) => el("li", { text: detail }))) : null,
  );
}

export function errorBox(error) {
  if (error instanceof ApiError) {
    return alertBox(error.message, error.details);
  }
  console.error("unexpected client error", error);
  return alertBox(UI.common.loadFailed);
}

// 解約などの確認は、ネイティブの確認ダイアログを使わず <dialog> で行う（CLAUDE.md の UI ルール）。
export function confirmDialog(question, yesLabel, noLabel) {
  return new Promise((resolve) => {
    const dialog = el(
      "dialog",
      {},
      el(
        "div",
        { class: "confirm-dialog" },
        el("p", { class: "confirm-question", text: question }),
        el(
          "div",
          { class: "confirm-actions" },
          el("button", { type: "button", class: "btn btn-outline", text: noLabel, onclick: () => finish(false) }),
          el("button", { type: "button", class: "btn btn-danger", text: yesLabel, onclick: () => finish(true) }),
        ),
      ),
    );
    let settled = false;
    function finish(answer) {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(answer);
    }
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
