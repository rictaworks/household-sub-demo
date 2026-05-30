function confirmCancel() {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `
    <div style="padding:1.5rem;max-width:320px">
      <p style="margin-bottom:1rem;font-weight:600">このサブスクリプションを解約しますか？</p>
      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button id="cancelNo"  class="btn btn-outline">キャンセル</button>
        <button id="cancelYes" class="btn btn-danger">解約する</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  dialog.showModal();

  return new Promise((resolve) => {
    dialog.querySelector("#cancelYes").addEventListener("click", () => {
      dialog.close();
      dialog.remove();
      resolve(true);
    });
    dialog.querySelector("#cancelNo").addEventListener("click", () => {
      dialog.close();
      dialog.remove();
      resolve(false);
    });
  });
}

document.querySelectorAll("[onsubmit]").forEach((form) => {
  if (form.getAttribute("onsubmit") === "return confirmCancel()") {
    form.removeAttribute("onsubmit");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = await confirmCancel();
      if (ok) form.submit();
    });
  }
});
