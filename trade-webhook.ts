// supabase/functions/trade-webhook/index.ts
// Receives trade data from MT4/MT5 EAs via HTTP POST
// Deploy: supabase functions deploy trade-webhook
// Endpoint: POST https://<project>.supabase.co/functions/v1/trade-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    // Authenticate via webhook secret in header or URL param
    const url = new URL(req.url);
    const accountId = url.searchParams.get("account_id");
    const secret    = req.headers.get("x-webhook-secret") || url.searchParams.get("secret");

    if (!accountId || !secret) return new Response("Missing account_id or secret", { status: 400 });

    // Verify the secret matches the account's webhook_secret
    const { data: account, error: accError } = await supabase
      .from("accounts")
      .select("id, user_id, webhook_secret, status")
      .eq("id", accountId)
      .single();

    if (accError || !account) return new Response("Account not found", { status: 404 });
    if (account.webhook_secret !== secret) return new Response("Invalid secret", { status: 401 });
    if (account.status !== "active") return new Response("Account is not active", { status: 403 });

    // Check user plan (only Pro/Elite get webhook auto-import)
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", account.user_id)
      .single();

    if (profile?.plan === "free") return new Response("Webhook import requires Pro plan", { status: 403 });

    // Parse trade payload
    const body = await req.json();

    // Support both single trade and array of trades
    const rawTrades = Array.isArray(body) ? body : [body];

    const trades = rawTrades.map(t => ({
      account_id:  accountId,
      user_id:     account.user_id,
      pair:        (t.pair || t.symbol || "UNKNOWN").replace("/", ""),
      type:        (t.type || t.direction || "BUY").toUpperCase().includes("BUY") ? "BUY" : "SELL",
      lots:        parseFloat(t.lots || t.volume || t.size || 0),
      entry:       parseFloat(t.entry || t.open || t.open_price || 0),
      exit:        parseFloat(t.exit || t.close || t.close_price || 0),
      pnl:         parseFloat(t.pnl || t.profit || t.net_profit || 0),
      trade_date:  t.date || t.close_time || new Date().toISOString().split("T")[0],
      notes:       t.notes || t.comment || "Webhook import",
      source:      "webhook",
      external_id: t.id || t.ticket || t.order_id || null,
    }));

    // Insert trades (ON CONFLICT DO NOTHING prevents duplicates)
    const { data: inserted, error: insertError } = await supabase
      .from("trades")
      .upsert(trades, { onConflict: "account_id,external_id", ignoreDuplicates: true })
      .select();

    if (insertError) throw insertError;

    console.log(`Webhook: inserted ${inserted?.length || 0} trades for account ${accountId}`);
    return new Response(JSON.stringify({ success: true, imported: inserted?.length || 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
