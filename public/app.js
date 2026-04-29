const menuList = document.querySelector("#menu-list");
const cartList = document.querySelector("#cart-list");
const receivedOrder = document.querySelector("#received-order");
const statusEl = document.querySelector("#status");
const noteEl = document.querySelector("#order-note");
const template = document.querySelector("#menu-item-template");
const cart = new Map();

let state = { menu: [], order: null };

const moneyish = (value) => value ? value : "";

const setStatus = (message) => {
  statusEl.textContent = message;
};

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json();
};

const loadState = async ({ quiet = false } = {}) => {
  if (!quiet) setStatus("Loading...");
  state = await api("/api/state");
  render();
  setStatus("Up to date");
};

const selectedItems = () => state.menu
  .map((item) => ({ ...item, quantity: cart.get(item.id) || 0 }))
  .filter((item) => item.quantity > 0);

const renderMenu = () => {
  menuList.innerHTML = "";

  if (!state.menu.length) {
    menuList.innerHTML = `<div class="empty">No menu items yet.</div>`;
    return;
  }

  for (const item of state.menu) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = item.name;
    node.querySelector("p").textContent = item.description || "Made with love.";
    node.querySelector("span").textContent = moneyish(item.price);
    node.querySelector("output").textContent = cart.get(item.id) || 0;

    node.querySelector(".minus").addEventListener("click", () => {
      const next = Math.max(0, (cart.get(item.id) || 0) - 1);
      next ? cart.set(item.id, next) : cart.delete(item.id);
      render();
    });

    node.querySelector(".plus").addEventListener("click", () => {
      cart.set(item.id, (cart.get(item.id) || 0) + 1);
      render();
    });

    node.querySelector(".remove-button").addEventListener("click", async () => {
      setStatus("Removing...");
      await api(`/api/menu/${item.id}`, { method: "DELETE" });
      cart.delete(item.id);
      await loadState({ quiet: true });
    });

    menuList.append(node);
  }
};

const renderCart = () => {
  const items = selectedItems();
  cartList.innerHTML = "";

  if (!items.length) {
    cartList.innerHTML = `<div class="empty">Nothing selected yet.</div>`;
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    const name = document.createElement("strong");
    const quantity = document.createElement("span");

    row.className = "cart-row";
    name.textContent = item.name;
    quantity.textContent = `x${item.quantity}`;
    row.append(name, quantity);
    cartList.append(row);
  }
};

const renderReceivedOrder = () => {
  receivedOrder.innerHTML = "";

  if (!state.order || !state.order.items.length) {
    receivedOrder.innerHTML = `<div class="empty">No order has been sent yet.</div>`;
    return;
  }

  const time = new Date(state.order.createdAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const stamp = document.createElement("p");
  stamp.className = "timestamp";
  stamp.textContent = `Sent ${time}`;
  receivedOrder.append(stamp);

  for (const item of state.order.items) {
    const row = document.createElement("div");
    const name = document.createElement("strong");
    const quantity = document.createElement("span");

    row.className = "received-row";
    name.textContent = item.name;
    quantity.textContent = `x${item.quantity}`;
    row.append(name, quantity);
    receivedOrder.append(row);
  }

  if (state.order.note) {
    const note = document.createElement("p");
    note.textContent = state.order.note;
    receivedOrder.append(note);
  }
};

const render = () => {
  renderMenu();
  renderCart();
  renderReceivedOrder();
};

document.querySelector("#menu-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    name: form.get("name").trim(),
    description: form.get("description").trim(),
    price: form.get("price").trim()
  };

  if (!payload.name) return;
  setStatus("Adding...");
  await api("/api/menu", { method: "POST", body: JSON.stringify(payload) });
  event.currentTarget.reset();
  await loadState({ quiet: true });
});

document.querySelector("#send-order").addEventListener("click", async () => {
  const items = selectedItems();
  if (!items.length) return;

  setStatus("Sending...");
  state = await api("/api/order", {
    method: "POST",
    body: JSON.stringify({ items, note: noteEl.value.trim() })
  });
  cart.clear();
  noteEl.value = "";
  render();
  setStatus("Order sent");
});

document.querySelector("#clear-cart").addEventListener("click", () => {
  cart.clear();
  noteEl.value = "";
  render();
});

document.querySelector("#refresh").addEventListener("click", () => loadState());

document.querySelector("#clear-order").addEventListener("click", async () => {
  setStatus("Clearing...");
  state = await api("/api/order", { method: "DELETE" });
  render();
  setStatus("Order cleared");
});

loadState().catch((error) => {
  console.error(error);
  setStatus("Offline");
});

setInterval(() => {
  loadState({ quiet: true }).catch(() => setStatus("Offline"));
}, 5000);
