import db from "../../db.js";
import { listConversations } from "../../services/slack/web-api-client.js";

export default async (req, res) => {
  if (!req.authenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const userId = req.authentication.user.id;
    // #region agent log
    const _log1 = { sessionId: 'da5c0c', location: 'slack-channels.js:entry', message: 'list channels entry', data: { userId, hasUserId: !!userId }, timestamp: Date.now(), hypothesisId: 'H2' };
    fetch('http://127.0.0.1:7638/ingest/79656976-3d7d-40e3-8c2f-1fcd56f4a972',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'da5c0c'},body:JSON.stringify(_log1)}).catch(()=>{});
    console.log('[DEBUG da5c0c]', JSON.stringify(_log1));
    // #endregion
    const integration = await db.Integration.findOne({
      where: { userId, provider: "slack" },
    });
    // #region agent log
    const _log2 = { sessionId: 'da5c0c', location: 'slack-channels.js:after findOne', message: 'integration lookup', data: { integrationFound: !!integration, hasAccessToken: !!integration?.accessToken, tokenType: typeof integration?.accessToken }, timestamp: Date.now(), hypothesisId: 'H2,H3' };
    fetch('http://127.0.0.1:7638/ingest/79656976-3d7d-40e3-8c2f-1fcd56f4a972',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'da5c0c'},body:JSON.stringify(_log2)}).catch(()=>{});
    console.log('[DEBUG da5c0c]', JSON.stringify(_log2));
    // #endregion
    if (!integration?.accessToken) {
      return res.status(400).json({ error: "Slack is not connected" });
    }

    // #region agent log
    const _log3 = { sessionId: 'da5c0c', location: 'slack-channels.js:before listConversations', message: 'call args', data: { firstArgType: 'object', firstArgIsTokenString: typeof integration.accessToken === 'string' }, timestamp: Date.now(), hypothesisId: 'H1' };
    fetch('http://127.0.0.1:7638/ingest/79656976-3d7d-40e3-8c2f-1fcd56f4a972',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'da5c0c'},body:JSON.stringify(_log3)}).catch(()=>{});
    console.log('[DEBUG da5c0c]', JSON.stringify(_log3));
    // #endregion
    const data = await listConversations(integration.accessToken);
    const channels =
      data.channels?.map((c) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
      })) || [];

    return res.json({ channels });
  } catch (err) {
    // #region agent log
    const _logCatch = { sessionId: 'da5c0c', location: 'slack-channels.js:catch', message: 'list channels error', data: { message: err.message, code: err.code }, timestamp: Date.now(), hypothesisId: 'H4,H5' };
    fetch('http://127.0.0.1:7638/ingest/79656976-3d7d-40e3-8c2f-1fcd56f4a972',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'da5c0c'},body:JSON.stringify(_logCatch)}).catch(()=>{});
    console.log('[DEBUG da5c0c]', JSON.stringify(_logCatch));
    // #endregion
    console.error("[API] slack-channels error:", err);
    return res.status(500).json({ error: "Failed to list Slack channels", message: err.message });
  }
};

