const CATALOG = {
  1: { name: "Omi", price: 600 },
  2: { name: "Nord", price: 650 },
  3: { name: "Havn", price: 700 },
  4: { name: "Klar", price: 550 }
};

const reply = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Use POST." });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return reply(500, { error: "Payment is not set up yet." });

  let items;
  try { items = JSON.parse(event.body).items; } catch { return reply(400, { error: "Bad request." }); }
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) return reply(400, { error: "Your cart is empty." });

  const body = new URLSearchParams();
  const site = process.env.URL || "http://localhost:8888";
  body.append("mode", "payment");
  body.append("success_url", site + "/?paid=1");
  body.append("cancel_url", site + "/");
  ["DK", "SE", "NO", "DE"].forEach((c, i) => body.append("shipping_address_collection[allowed_countries][" + i + "]", c));

  for (let i = 0; i < items.length; i++) {
    const product = CATALOG[items[i].id];
    const qty = items[i].qty;
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 10) return reply(400, { error: "Invalid item in cart." });
    body.append("line_items[" + i + "][quantity]", String(qty));
    body.append("line_items[" + i + "][price_data][currency]", "dkk");
    body.append("line_items[" + i + "][price_data][unit_amount]", String(product.price * 100));
    body.append("line_items[" + i + "][price_data][product_data][name]", product.name + " sunglasses");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Stripe error:", data.error && data.error.message);
    return reply(502, { error: "Could not start payment." });
  }
  return reply(200, { url: data.url });
};
