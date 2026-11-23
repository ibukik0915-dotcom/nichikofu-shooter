// ゲームの部屋サーバー(全員が1つの部屋に入り、状態(presence)を中継するだけ)
export class Lobby {
  constructor() { this.peers = new Map(); }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    if (this.peers.size >= 60) return new Response('full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const id = crypto.randomUUID().slice(0, 12), me = { ws: server, p: {}, t: Date.now() }, snap = {};
    for (const [k, v] of this.peers) snap[k] = { p: v.p, a: Date.now() - v.t };
    server.send(JSON.stringify({ t: 'hello', id, peers: snap }));
    this.peers.set(id, me); this.bcast({ t: 'join', id }, id);
    server.addEventListener('message', e => {
      if (typeof e.data !== 'string' || e.data.length > 6000) return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m.p !== 'object' || m.p === null) return;
      const o = { ...me.p }; for (const [k, v] of Object.entries(m.p)) { if (v === null) delete o[k]; else o[k] = v; }
      me.p = o; me.t = Date.now(); this.bcast({ t: 'p', id, p: m.p }, id);
    });
    const bye = () => { if (this.peers.delete(id)) this.bcast({ t: 'left', id }); };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  bcast(m, except) { const t = JSON.stringify(m); for (const [k, v] of this.peers) if (k !== except) { try { v.ws.send(t); } catch { } } }
}
import html from './index.html';   // ゲーム本体(index.html)をそのまま読み込む
export default {
  fetch(req, env) {
    if (new URL(req.url).pathname === '/ws') return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(req);   // 通信
    return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } });   // それ以外はゲームの画面
  },
};
