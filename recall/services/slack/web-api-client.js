import fetch from "node-fetch";

/**
 * Lightweight Slack Web API client for bot token calls.
 */
const BASE_URL = "https://slack.com/api";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };
}

async function slackRequest({ token, path, method = "GET", body, query }) {
  const url = new URL(`${BASE_URL}/${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: authHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!json.ok) {
    // #region agent log
    const _logSlack = { sessionId: 'da5c0c', location: 'web-api-client.js:slackRequest', message: 'Slack API not ok', data: { path, slackError: json.error, ok: json.ok, tokenType: typeof token }, timestamp: Date.now(), hypothesisId: 'H1,H4' };
    fetch('http://127.0.0.1:7638/ingest/79656976-3d7d-40e3-8c2f-1fcd56f4a972',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'da5c0c'},body:JSON.stringify(_logSlack)}).catch(()=>{});
    console.log('[DEBUG da5c0c]', JSON.stringify(_logSlack));
    // #endregion
    const err = new Error(
      `Slack API error for ${path}: ${json.error || "unknown_error"}`
    );
    err.data = json;
    throw err;
  }
  return json;
}

export async function listConversations(token, { limit = 1000 } = {}) {
  return slackRequest({
    token,
    path: "conversations.list",
    query: { limit, types: "public_channel,private_channel" },
  });
}

export async function createConversation(token, { name, isPrivate = false }) {
  return slackRequest({
    token,
    path: "conversations.create",
    method: "POST",
    body: { name, is_private: isPrivate },
  });
}

export async function inviteUsers(token, { channel, users }) {
  return slackRequest({
    token,
    path: "conversations.invite",
    method: "POST",
    body: { channel, users },
  });
}

export async function listUsers(token, { limit = 200 } = {}) {
  return slackRequest({
    token,
    path: "users.list",
    query: { limit },
  });
}

export async function postMessage(token, { channel, text, blocks, threadTs }) {
  return slackRequest({
    token,
    path: "chat.postMessage",
    method: "POST",
    body: {
      channel,
      text: text || "New meeting",
      blocks,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    },
  });
}


