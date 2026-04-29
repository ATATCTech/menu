const DEFAULT_MENU = [
  {
    id: "pasta-alla-vodka",
    name: "Pasta alla vodka",
    description: "Silky tomato cream sauce, parmesan, basil, and a little heat.",
    price: "$16"
  },
  {
    id: "crispy-chicken-sandwich",
    name: "Crispy chicken sandwich",
    description: "Buttermilk chicken, pickles, slaw, and house sauce.",
    price: "$14"
  },
  {
    id: "miso-salmon-bowl",
    name: "Miso salmon bowl",
    description: "Glazed salmon, rice, cucumber, avocado, and sesame.",
    price: "$18"
  },
  {
    id: "chocolate-lava-cake",
    name: "Chocolate lava cake",
    description: "Warm chocolate cake with a molten center.",
    price: "$8"
  }
];

const STATE_KEY = "date-night-menu-state";
const memory = {
  menu: DEFAULT_MENU,
  order: null
};

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...init.headers
  }
});

const slug = (value) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "")
  .slice(0, 48);

const getStore = (env) => env && env.MENU_STORE ? env.MENU_STORE : null;

const readState = async (env) => {
  const store = getStore(env);
  if (!store) return structuredClone(memory);

  const saved = await store.get(STATE_KEY, "json");
  if (saved && Array.isArray(saved.menu)) return saved;

  const initial = { menu: DEFAULT_MENU, order: null };
  await store.put(STATE_KEY, JSON.stringify(initial));
  return initial;
};

const writeState = async (env, state) => {
  const next = {
    menu: Array.isArray(state.menu) ? state.menu : [],
    order: state.order || null
  };

  const store = getStore(env);
  if (!store) {
    memory.menu = next.menu;
    memory.order = next.order;
    return next;
  }

  await store.put(STATE_KEY, JSON.stringify(next));
  return next;
};

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const sanitizeMenuItem = (payload, existingIds) => {
  const name = String(payload.name || "").trim().slice(0, 80);
  if (!name) return null;

  const base = slug(name) || crypto.randomUUID();
  let id = base;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return {
    id,
    name,
    description: String(payload.description || "").trim().slice(0, 180),
    price: String(payload.price || "").trim().slice(0, 24)
  };
};

const sanitizeOrder = (payload) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const cleanItems = items
    .map((item) => ({
      id: String(item.id || "").slice(0, 80),
      name: String(item.name || "").trim().slice(0, 80),
      quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1))
    }))
    .filter((item) => item.id && item.name);

  return {
    items: cleanItems,
    note: String(payload.note || "").trim().slice(0, 280),
    createdAt: new Date().toISOString()
  };
};

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "state") {
    return json(await readState(env));
  }

  if (method === "POST" && path === "menu") {
    const state = await readState(env);
    const payload = await readJson(request);
    const item = sanitizeMenuItem(payload, new Set(state.menu.map((entry) => entry.id)));
    if (!item) return json({ error: "Menu item name is required." }, { status: 400 });

    state.menu = [...state.menu, item];
    return json(await writeState(env, state), { status: 201 });
  }

  const removeMatch = path.match(/^menu\/([^/]+)$/);
  if (method === "DELETE" && removeMatch) {
    const state = await readState(env);
    const id = decodeURIComponent(removeMatch[1]);
    state.menu = state.menu.filter((item) => item.id !== id);
    return json(await writeState(env, state));
  }

  if (method === "POST" && path === "order") {
    const state = await readState(env);
    const payload = await readJson(request);
    const order = sanitizeOrder(payload);
    if (!order.items.length) return json({ error: "Order must include at least one item." }, { status: 400 });

    state.order = order;
    return json(await writeState(env, state), { status: 201 });
  }

  if (method === "DELETE" && path === "order") {
    const state = await readState(env);
    state.order = null;
    return json(await writeState(env, state));
  }

  return json({ error: "Not found." }, { status: 404 });
}
