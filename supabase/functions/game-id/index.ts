// game-id is switched off: termgame.com blocks server-side requests (HTTP 403 from its bot protection), so the
// OpenID -> in-game name lookup cannot work. Kept as a stub so old clients get a clear answer; safe to delete.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(JSON.stringify({ error: "ฟีเจอร์ผูกไอดีเกมปิดใช้งานชั่วคราว", code: "disabled" }), {
    status: 410,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
