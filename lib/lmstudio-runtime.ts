type LmStudioConnection = {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  contextLength?: number;
};

type LoadedInstance = {
  id: string;
};

type ListedModel = {
  key?: string;
  loaded_instances?: LoadedInstance[];
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function getRootUrl(baseUrl: string) {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
}

function createHeaders(apiKey?: string) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  };
}

async function fetchLmStudioJson<T>(url: string, apiKey?: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...createHeaders(apiKey),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LM Studio request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

async function listLoadedInstances(connection: LmStudioConnection) {
  const rootUrl = getRootUrl(connection.baseUrl);
  const payload = await fetchLmStudioJson<{ models?: ListedModel[] }>(
    `${rootUrl}/api/v1/models`,
    connection.apiKey
  );

  return (payload.models ?? []).flatMap((model) =>
    (model.loaded_instances ?? []).map((instance) => ({
      instanceId: instance.id,
      modelKey: model.key ?? ""
    }))
  );
}

async function unloadInstance(connection: LmStudioConnection, instanceId: string) {
  const rootUrl = getRootUrl(connection.baseUrl);
  await fetchLmStudioJson<{ instance_id: string }>(
    `${rootUrl}/api/v1/models/unload`,
    connection.apiKey,
    {
      method: "POST",
      body: JSON.stringify({ instance_id: instanceId })
    }
  );
}

async function loadModel(connection: LmStudioConnection, modelKey: string) {
  const rootUrl = getRootUrl(connection.baseUrl);
  await fetchLmStudioJson<{ instance_id?: string }>(`${rootUrl}/api/v1/models/load`, connection.apiKey, {
    method: "POST",
    body: JSON.stringify({
      model: modelKey,
      ...(connection.contextLength ? { context_length: connection.contextLength } : {}),
      flash_attention: true,
      offload_kv_cache_to_gpu: true
    })
  });
}

function matchesRequestedModel(instanceModelKey: string, requestedModel: string) {
  return instanceModelKey === requestedModel;
}

export async function unloadAllLmStudioModels(connection: LmStudioConnection) {
  if (!connection.baseUrl) {
    return;
  }

  const loadedInstances = await listLoadedInstances(connection);
  await Promise.all(loadedInstances.map((instance) => unloadInstance(connection, instance.instanceId)));
}

export async function syncLmStudioLoadedModel(connection: LmStudioConnection) {
  const requestedModel = connection.model?.trim();
  if (!connection.baseUrl) {
    return;
  }

  const loadedInstances = await listLoadedInstances(connection);

  if (!requestedModel) {
    await Promise.all(loadedInstances.map((instance) => unloadInstance(connection, instance.instanceId)));
    return;
  }

  const matching = loadedInstances.filter((instance) => matchesRequestedModel(instance.modelKey, requestedModel));
  const nonMatching = loadedInstances.filter((instance) => !matchesRequestedModel(instance.modelKey, requestedModel));

  await Promise.all(nonMatching.map((instance) => unloadInstance(connection, instance.instanceId)));

  if (matching.length > 1) {
    await Promise.all(matching.slice(1).map((instance) => unloadInstance(connection, instance.instanceId)));
  }

  if (matching.length === 0) {
    await loadModel(connection, requestedModel);
  }
}
