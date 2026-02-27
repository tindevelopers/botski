import fetch from "node-fetch";

function authHeader(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`;
}

function normalizeBaseUrl(url) {
  if (!url) return url;
  return String(url).replace(/\/+$/, "");
}

async function teamworkRequest({ baseUrl, apiKey, path, method = "GET", body }) {
  if (!baseUrl || !apiKey) {
    throw new Error("Teamwork baseUrl and apiKey are required");
  }

  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(
      `Teamwork request failed (${res.status}): ${body || "unknown"}`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return await res.json();
}

export async function listProjects({ baseUrl, apiKey }) {
  return teamworkRequest({ baseUrl, apiKey, path: "/projects.json" });
}

export async function listTasklists({ baseUrl, apiKey, projectId }) {
  if (!projectId) throw new Error("projectId is required");
  return teamworkRequest({ baseUrl, apiKey, path: `/projects/${projectId}/tasklists.json` });
}

export async function createTask({ baseUrl, apiKey, content, description, tasklistId }) {
  if (!tasklistId) {
    throw new Error("tasklistId is required to create a Teamwork task");
  }
  const path = `/tasklists/${tasklistId}/tasks.json`;
  return teamworkRequest({
    baseUrl,
    apiKey,
    path,
    method: "POST",
    body: {
      "todo-item": {
        content,
        description,
      },
    },
  });
}

export async function createMilestone({ baseUrl, apiKey, projectId, title, description }) {
  if (!projectId) throw new Error("projectId is required");
  return teamworkRequest({
    baseUrl,
    apiKey,
    path: `/projects/${projectId}/milestones.json`,
    method: "POST",
    body: {
      milestone: {
        title,
        description,
      },
    },
  });
}


