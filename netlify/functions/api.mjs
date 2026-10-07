// ../../home/claude/sobrevive/node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify: Netlify2, process } = globalThis;
  return Netlify2?.env ?? Deno?.env ?? {
    delete: (key) => delete process?.env[key],
    get: (key) => process?.env[key],
    has: (key) => Boolean(process?.env[key]),
    set: (key, value) => {
      if (process?.env) {
        process.env[key] = value;
      }
    },
    toObject: () => process?.env ?? {}
  };
};

// ../../home/claude/sobrevive/node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// ../../home/claude/sobrevive/node_modules/@netlify/blobs/dist/chunk-QDL6ESI2.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var DEPLOY_STORE_PREFIX = "deploy:";
var SITE_STORE_PREFIX = "site:";
var isDeniedWrite = (res, { method, storeName }) => (res.status === 401 || res.status === 403) && (method === "put" || method === "delete") && storeName !== void 0 && !storeName.startsWith(DEPLOY_STORE_PREFIX);
var blobsErrorMessage = (res, context, responseBody) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
  }
  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX) ? context.storeName.slice(SITE_STORE_PREFIX.length) : context.storeName;
    const summary = `Netlify Blobs could not write to store '${storeName}' (${details}).`;
    if (context.edgeAccess) {
      return summary;
    }
    return `${summary} Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`;
  }
  let message = `Netlify Blobs has generated an internal error (${details})`;
  if (!res.headers.get(NF_ERROR) && responseBody) {
    message += `: ${responseBody}`;
  }
  return message;
};
var BlobsInternalError = class extends Error {
  constructor(res, context = {}, responseBody) {
    super(blobsErrorMessage(res, context, responseBody));
    this.name = "BlobsInternalError";
    this.status = res.status;
    this.responseBody = responseBody;
  }
};
var createBlobsInternalError = async (res, context = {}) => {
  const responseBody = await res.clone().text().catch(() => void 0);
  return new BlobsInternalError(res, context, responseBody);
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var REGION_AUTO = "auto";
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY, getRetryUrl) => {
  try {
    const res = await fetch(url, options);
    const isRetryable = res.status === 429 || res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;
    if (attemptsLeft > 0 && isRetryable) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      const retryUrl = getRetryUrl ? await getRetryUrl() : url;
      return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    const retryUrl = getRetryUrl ? await getRetryUrl() : url;
    return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  /**
   * Whether requests reach Blobs through the edge rather than the API. Only
   * runtime environments are given an edge URL.
   */
  get edgeAccess() {
    return this.edgeURL !== void 0;
  }
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw await createBlobsInternalError(res, { edgeAccess: this.edgeAccess, method, storeName });
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    const usesSignedUrl = !this.edgeURL && key !== void 0 && storeName !== void 0 && method !== "head" && method !== "delete";
    let getRetryUrl;
    if (usesSignedUrl) {
      getRetryUrl = async () => {
        const finalRequest = await this.getFinalRequest({ consistency, key, metadata, method, parameters, storeName });
        return finalRequest.url;
      };
    }
    return fetchAndRetry(this.fetch, url, options, void 0, getRetryUrl);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// ../../home/claude/sobrevive/node_modules/@netlify/blobs/dist/main.js
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "delete",
        storeName: this.name
      });
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        throw new BlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "delete",
          storeName: this.name
        });
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getDeployStoreRegion = (clientOptions, context) => {
  if (clientOptions.region) {
    return clientOptions.region;
  }
  if (clientOptions.edgeURL || clientOptions.uncachedEdgeURL) {
    if (!context.primaryRegion) {
      throw new Error(
        "When accessing a deploy store, the Netlify Blobs client needs to be configured with a region, and one was not found in the environment. To manually set the region, set the `region` property in the store options. If you are using the Netlify CLI, you may have an outdated version; run `npm install -g netlify-cli@latest` to update and try again."
      );
    }
    return context.primaryRegion;
  }
  return REGION_AUTO;
};
var getDeployStore = (input = {}, options) => {
  const context = getEnvironmentContext();
  const mergedOptions = typeof input === "string" ? { ...options, name: input } : input;
  const deployID = mergedOptions.deployID ?? context.deployID;
  if (!deployID) {
    throw new MissingBlobsEnvironmentError(["deployID"]);
  }
  const clientOptions = getClientOptions(mergedOptions, context);
  clientOptions.region = getDeployStoreRegion(clientOptions, context);
  const client = new Client(clientOptions);
  return new Store({ client, deployID, name: mergedOptions.name });
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const context = getEnvironmentContext();
    const clientOptions = getClientOptions(input, context);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    clientOptions.region = getDeployStoreRegion(clientOptions, context);
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// ../../home/claude/sobrevive/netlify/lib/api.mjs
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var WIN_WAVE = 30;
var MAX_WAVE = 120;
var waveDur = (n) => Math.min(20 + (n - 1) * 2, 40);
var cumKills = (L) => Math.round(2.5 * L * (L + 3) * (1 + L / 7));
var earnedLevel = (k) => {
  let l = 1;
  while (k >= cumKills(l)) l++;
  return l;
};
var scoreOf = (cleared, kills, win) => cleared * 100 + kills + (win ? 1e3 : 0);
function spawnsEst(n) {
  const base = Math.max(0.45, 1.7 - n * 0.045), grp = 1 + Math.floor(n / 6);
  return waveDur(n) / (base * 0.8) * grp;
}
function maxKillsWave(n) {
  const s = spawnsEst(n);
  return Math.ceil(s * (1.35 + (n >= 8 ? 0.4 : 0))) + (n % 6 === 0 ? 120 : 0) + (n >= 19 ? 40 : 0) + 20;
}
var sumWaves = (from, to, f) => {
  let t = 0;
  for (let i = from; i <= to; i++) t += f(i);
  return t;
};
var CHAR_IDS = ["cacador", "medico", "coveiro", "bruxa", "cavaleiro", "padre"];
var ARENA_IDS = ["cemiterio", "floresta", "cripta"];
var b64u = (buf) => Buffer.from(buf).toString("base64url");
var sha = (s) => createHash("sha256").update(String(s)).digest("hex");
var safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
var CROCK = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function newCode() {
  const r = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += CROCK[r[i] % 32];
  return s;
}
var normCode = (raw) => String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
var fmtCode = (c) => c.replace(/(.{4})(?=.)/g, "$1-");
var inv8 = (s) => String(99999999 - Math.max(0, Math.min(99999999, s))).padStart(8, "0");
function weekId(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + "-W" + String(w).padStart(2, "0");
}
var NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,12}[\p{L}\p{N}]$/u;
var BLOCK_SUB = ["caralho", "puta", "merda", "foder", "porra", "bosta", "buceta", "punheta", "cabrao", "viado", "fuck", "shit", "bitch", "cunt", "nigg", "nazi", "hitler", "rape", "sexo", "penis", "pila"];
var BLOCK_EXACT = ["cu", "cus", "fdp", "pq", "admin", "moderador", "sistema"];
var flatName = (n) => String(n).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
function cleanName(raw) {
  const n = String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!NAME_RE.test(n)) return null;
  const f = flatName(n);
  if (f.length < 3 || BLOCK_EXACT.includes(f) || BLOCK_SUB.some((w) => f.includes(w))) return null;
  return n;
}
var cap = (v, max) => Math.max(0, Math.min(max, Number.isFinite(+v) ? Math.floor(+v) : 0));
var capProg = (p) => ({ best: cap(p?.best, MAX_WAVE), kills: cap(p?.kills, 5e6), bosses: cap(p?.bosses, 5e3), wins: cap(p?.wins, 5e3) });
var mergeProg = (a, b) => {
  const x = capProg(a), y = capProg(b);
  return { best: Math.max(x.best, y.best), kills: Math.max(x.kills, y.kills), bosses: Math.max(x.bosses, y.bosses), wins: Math.max(x.wins, y.wins) };
};
var cleanSel = (s) => ({ c: CHAR_IDS.includes(s?.c) ? s.c : "cacador", a: ARENA_IDS.includes(s?.a) ? s.a : "cemiterio" });
function createApi({ players, lb, runs, misc, now = () => Date.now(), adminKey = "" }) {
  const json = async (store, key) => await store.get(key, { type: "json" }) ?? null;
  async function listKeys(store, prefix, max = 200) {
    const out = [];
    for await (const page of store.list({ prefix, paginate: true })) {
      for (const b of page.blobs) out.push(b.key);
      if (out.length >= max * 4 && out.length >= 1e3) break;
    }
    out.sort();
    return out.slice(0, max);
  }
  async function countBefore(store, prefix, key) {
    let n = 0;
    for await (const page of store.list({ prefix, paginate: true })) {
      for (const b of page.blobs) if (b.key < key) n++;
      if (n > 5e4) return null;
    }
    return n + 1;
  }
  const rlKey = (bucket, windowSec) => `rl/${bucket}/${Math.floor(now() / 1e3 / windowSec)}`;
  async function count(bucket, windowSec) {
    return (await json(misc, rlKey(bucket, windowSec)) ?? { n: 0 }).n;
  }
  async function hit(bucket, windowSec) {
    const k = rlKey(bucket, windowSec), c = await json(misc, k) ?? { n: 0 };
    c.n++;
    await misc.setJSON(k, c);
    return c.n;
  }
  async function limited(bucket, max, windowSec) {
    return await hit(bucket, windowSec) > max;
  }
  const mem = /* @__PURE__ */ new Map();
  function memLimited(bucket, max, windowSec) {
    const k = bucket + "/" + Math.floor(now() / 1e3 / windowSec), n = (mem.get(k) || 0) + 1;
    mem.set(k, n);
    if (mem.size > 5e3) for (const key of mem.keys()) {
      mem.delete(key);
      if (mem.size < 2500) break;
    }
    return n > max;
  }
  async function auth(headers) {
    const m = /^Bearer ([A-Za-z0-9_-]{6,32})\.([A-Za-z0-9_-]{20,80})$/.exec(headers.authorization || "");
    if (!m) return null;
    const p = await json(players, "p/" + m[1]);
    if (!p || p.banned) return null;
    const h = sha(m[2]);
    return p.tokens.some((t) => safeEq(t, h)) ? { p, tok: h } : null;
  }
  const publicPlayer = (p) => ({ id: p.id, name: p.name, prog: p.prog, sel: p.sel });
  async function removeBoardEntries(playerId) {
    const ptr = await json(lb, "ptr/" + playerId);
    if (ptr?.all) await lb.delete(ptr.all);
    if (ptr?.week?.key) await lb.delete(ptr.week.key);
    await lb.delete("ptr/" + playerId);
  }
  const R = {};
  R["POST /profile"] = async ({ body, ip }) => {
    if (await limited("prof:" + ip, 6, 3600)) return [429, { error: "rate" }];
    const name = cleanName(body.name);
    if (!name) return [400, { error: "bad_name" }];
    const nameKey = flatName(name);
    if (await json(players, "n/" + nameKey)) return [409, { error: "name_taken" }];
    const id = b64u(randomBytes(9)), token = b64u(randomBytes(32)), code = newCode();
    const p = { id, name, nameKey, created: now(), tokens: [sha(token)], codeHash: sha(code), prog: capProg(body.prog), sel: cleanSel(body.sel), banned: false, flags: 0 };
    await players.setJSON("p/" + id, p);
    await players.setJSON("n/" + nameKey, { id });
    await players.setJSON("c/" + p.codeHash, { id });
    return [200, { id, token, code: fmtCode(code), name, prog: p.prog, sel: p.sel }];
  };
  R["POST /login"] = async ({ body, ip }) => {
    if (await count("lf:" + ip, 3600) >= 15 || await limited("login:" + ip, 12, 60)) return [429, { error: "rate" }];
    const code = normCode(body.code);
    if (code.length !== 12) return [400, { error: "bad_code" }];
    const ref = await json(players, "c/" + sha(code));
    const p = ref ? await json(players, "p/" + ref.id) : null;
    if (!p || p.banned) {
      await hit("lf:" + ip, 3600);
      return [404, { error: "code_not_found" }];
    }
    const token = b64u(randomBytes(32));
    p.tokens = [...p.tokens.slice(-7), sha(token)];
    await players.setJSON("p/" + p.id, p);
    return [200, { id: p.id, token, name: p.name, prog: p.prog, sel: p.sel }];
  };
  R["GET /me"] = async ({ p }) => [200, publicPlayer(p)];
  R["POST /sync"] = async ({ p, body }) => {
    if (memLimited("sync:" + p.id, 30, 60)) return [429, { error: "rate" }];
    p.prog = mergeProg(p.prog, body.prog);
    if (body.sel) p.sel = cleanSel(body.sel);
    await players.setJSON("p/" + p.id, p);
    return [200, publicPlayer(p)];
  };
  R["POST /rename"] = async ({ p, body }) => {
    if (await limited("rename:" + p.id, 3, 86400)) return [429, { error: "rate" }];
    const name = cleanName(body.name);
    if (!name) return [400, { error: "bad_name" }];
    const nameKey = flatName(name);
    const taken = await json(players, "n/" + nameKey);
    if (taken && taken.id !== p.id) return [409, { error: "name_taken" }];
    if (nameKey !== p.nameKey) {
      await players.delete("n/" + p.nameKey);
      await players.setJSON("n/" + nameKey, { id: p.id });
    }
    p.name = name;
    p.nameKey = nameKey;
    await players.setJSON("p/" + p.id, p);
    const ptr = await json(lb, "ptr/" + p.id);
    for (const k of [ptr?.all, ptr?.week?.key]) {
      if (!k) continue;
      const e = await json(lb, k);
      if (e) {
        e.n = name;
        await lb.setJSON(k, e);
      }
    }
    return [200, publicPlayer(p)];
  };
  R["POST /newcode"] = async ({ p, tok }) => {
    if (await limited("newcode:" + p.id, 5, 3600)) return [429, { error: "rate" }];
    await players.delete("c/" + p.codeHash);
    const code = newCode();
    p.codeHash = sha(code);
    p.tokens = [tok];
    await players.setJSON("p/" + p.id, p);
    await players.setJSON("c/" + p.codeHash, { id: p.id });
    return [200, { code: fmtCode(code) }];
  };
  R["POST /delete"] = async ({ p }) => {
    await removeBoardEntries(p.id);
    await players.delete("c/" + p.codeHash);
    await players.delete("n/" + p.nameKey);
    await players.delete("p/" + p.id);
    const act = await json(runs, "a/" + p.id);
    if (act) {
      await runs.delete("r/" + act.runId);
      await runs.delete("a/" + p.id);
    }
    return [200, { ok: true }];
  };
  const sign = (key, kind, runId, wave, kills, level) => createHmac("sha256", key).update(`${kind}|${runId}|${wave}|${kills}|${level}`).digest("hex");
  const num = (v) => Number.isFinite(+v) ? Math.floor(+v) : NaN;
  R["POST /run/start"] = async ({ p, body }) => {
    if (await limited("rstart:" + p.id, 12, 60)) return [429, { error: "rate" }];
    const prev = await json(runs, "a/" + p.id);
    if (prev) await runs.delete("r/" + prev.runId);
    const runId = b64u(randomBytes(9)), key = b64u(randomBytes(24)), t = now();
    await runs.setJSON("r/" + runId, { id: runId, p: p.id, key, c: CHAR_IDS.includes(body.c) ? body.c : "cacador", a: ARENA_IDS.includes(body.a) ? body.a : "cemiterio", t0: t, tw: t, w: 0, k: 0, bad: 0 });
    await runs.setJSON("a/" + p.id, { runId });
    return [200, { runId, key }];
  };
  R["POST /run/checkpoint"] = async ({ p, body }) => {
    const run = await json(runs, "r/" + String(body.runId));
    if (!run || run.p !== p.id) return [404, { error: "no_run" }];
    const wave = num(body.wave), kills = num(body.kills), level = num(body.level);
    if (![wave, kills, level].every(Number.isFinite) || !safeEq(sign(run.key, "c", run.id, wave, kills, level), String(body.sig))) {
      run.bad++;
      await runs.setJSON("r/" + run.id, run);
      return [200, { ok: true }];
    }
    if (wave > run.w) {
      const t = now();
      const need = sumWaves(run.w + 1, Math.min(wave, MAX_WAVE), (i) => (waveDur(i) - 1) * 1e3);
      if (wave > MAX_WAVE || t - run.tw < need) run.bad++;
      const dk = kills - run.k, maxDk = sumWaves(run.w + 1, Math.min(wave, MAX_WAVE), maxKillsWave);
      if (dk < 0 || dk > maxDk) run.bad++;
      if (level < 1 || level > earnedLevel(kills)) run.bad++;
      run.w = wave;
      run.k = kills;
      run.tw = t;
      await runs.setJSON("r/" + run.id, run);
    }
    return [200, { ok: true }];
  };
  async function placeOnBoard(p, e) {
    const wk = weekId(e.t);
    const ptr = await json(lb, "ptr/" + p.id) ?? {};
    const out = {};
    const keyAll = `all/${inv8(e.s)}-${p.id}`;
    if (!ptr.all || e.s > (ptr.allScore ?? -1)) {
      if (ptr.all && ptr.all !== keyAll) await lb.delete(ptr.all);
      await lb.setJSON(keyAll, e);
      ptr.all = keyAll;
      ptr.allScore = e.s;
    }
    out.all = await countBefore(lb, "all/", ptr.all);
    const keyWk = `week/${wk}/${inv8(e.s)}-${p.id}`;
    if (!ptr.week || ptr.week.id !== wk || e.s > (ptr.week.score ?? -1)) {
      if (ptr.week?.key && ptr.week.key !== keyWk) await lb.delete(ptr.week.key);
      await lb.setJSON(keyWk, e);
      ptr.week = { id: wk, key: keyWk, score: e.s };
    }
    out.week = await countBefore(lb, `week/${wk}/`, ptr.week.key);
    await lb.setJSON("ptr/" + p.id, ptr);
    return out;
  }
  R["POST /run/finish"] = async ({ p, body }) => {
    if (await limited("rfin:" + p.id, 12, 60)) return [429, { error: "rate" }];
    const run = await json(runs, "r/" + String(body.runId));
    if (!run || run.p !== p.id) return [404, { error: "no_run" }];
    await runs.delete("r/" + run.id);
    await runs.delete("a/" + p.id);
    const cleared = num(body.cleared), kills = num(body.kills), level = num(body.level), win = !!body.win;
    const t = now();
    let ok = run.bad === 0 && [cleared, kills, level].every(Number.isFinite) && safeEq(sign(run.key, "f", run.id, cleared, kills, level), String(body.sig));
    if (ok) {
      ok = cleared >= 0 && cleared <= MAX_WAVE && cleared >= run.w && kills >= run.k && kills <= 5e5 && level >= 1 && level <= earnedLevel(kills) && (!win || cleared >= WIN_WAVE) && t - run.t0 <= 8 * 36e5 && t - run.t0 >= sumWaves(1, cleared, (i) => (waveDur(i) - 1) * 1e3) && t - run.tw >= sumWaves(run.w + 1, cleared, (i) => (waveDur(i) - 1) * 1e3) && kills - run.k <= sumWaves(run.w + 1, cleared + 1, maxKillsWave);
    }
    if (!ok) {
      p.flags = (p.flags || 0) + 1;
      await players.setJSON("p/" + p.id, p);
      return [200, { ok: true, verified: false }];
    }
    const s = scoreOf(cleared, kills, win);
    p.prog = mergeProg(p.prog, { best: cleared, kills: p.prog.kills + kills, bosses: p.prog.bosses + Math.floor(cleared / 6), wins: p.prog.wins + (win ? 1 : 0) });
    await players.setJSON("p/" + p.id, p);
    if (cleared < 1) return [200, { ok: true, verified: true, score: s, rank: {} }];
    const entry = { n: p.name, p: p.id, s, w: cleared, k: kills, lv: level, c: run.c, a: run.a, win, t };
    const rank = await placeOnBoard(p, entry);
    return [200, { ok: true, verified: true, score: s, rank, prog: p.prog }];
  };
  R["GET /leaderboard"] = async ({ query, p, ip }) => {
    if (memLimited("lb:" + (p?.id || ip), 60, 60)) return [429, { error: "rate" }];
    const scope = query.get("scope") === "week" ? "week" : "all";
    const limit = Math.max(1, Math.min(50, +query.get("limit") || 25));
    const prefix = scope === "week" ? `week/${weekId(now())}/` : "all/";
    const keys = await listKeys(lb, prefix, limit);
    const entries = (await Promise.all(keys.map((k) => json(lb, k)))).filter(Boolean).map((e, i) => ({ rank: i + 1, name: e.n, score: e.s, wave: e.w, kills: e.k, level: e.lv, char: e.c, arena: e.a, win: !!e.win, t: e.t, me: !!p && e.p === p.id }));
    let me = null;
    if (p) {
      const ptr = await json(lb, "ptr/" + p.id);
      const key = scope === "week" ? ptr?.week?.id === weekId(now()) ? ptr.week.key : null : ptr?.all;
      if (key) {
        const e = await json(lb, key);
        if (e) me = { rank: await countBefore(lb, prefix, key), score: e.s, wave: e.w };
      }
    }
    return [200, { scope, week: weekId(now()), entries, me }];
  };
  R["GET /ping"] = async () => [200, { ok: true, t: now() }];
  R["POST /admin"] = async ({ body, headers, ip }) => {
    if (!adminKey || await count("af:" + ip, 3600) >= 10 || !safeEq(headers["x-admin-key"] || "", adminKey)) {
      await hit("af:" + ip, 3600);
      return [403, { error: "forbidden" }];
    }
    const find = async () => {
      if (body.id) return json(players, "p/" + body.id);
      if (body.name) {
        const r = await json(players, "n/" + flatName(body.name));
        return r ? json(players, "p/" + r.id) : null;
      }
      return null;
    };
    if (body.action === "list") {
      const ks = await listKeys(players, "p/", 200);
      const all = (await Promise.all(ks.map((k) => json(players, k)))).filter(Boolean);
      return [200, { players: all.map((x) => ({ id: x.id, name: x.name, created: x.created, prog: x.prog, flags: x.flags || 0, banned: !!x.banned })) }];
    }
    const t = await find();
    if (!t) return [404, { error: "not_found" }];
    if (body.action === "remove") {
      await removeBoardEntries(t.id);
      return [200, { ok: true }];
    }
    if (body.action === "ban") {
      t.banned = true;
      await players.setJSON("p/" + t.id, t);
      await removeBoardEntries(t.id);
      return [200, { ok: true }];
    }
    if (body.action === "unban") {
      t.banned = false;
      await players.setJSON("p/" + t.id, t);
      return [200, { ok: true }];
    }
    return [400, { error: "bad_action" }];
  };
  const PUBLIC = /* @__PURE__ */ new Set(["POST /profile", "POST /login", "GET /ping", "POST /admin"]);
  const OPTIONAL_AUTH = /* @__PURE__ */ new Set(["GET /leaderboard"]);
  return async function handle({ method, path, query = new URLSearchParams(), headers = {}, body = {}, ip = "x" }) {
    const route = `${method} ${path}`;
    const fn = R[route];
    if (!fn) return [404, { error: "not_found" }];
    if (!PUBLIC.has(route) && !OPTIONAL_AUTH.has(route)) {
      const a2 = await auth(headers);
      if (!a2) return [401, { error: "auth" }];
      return fn({ body, headers, query, ip, p: a2.p, tok: a2.tok });
    }
    const a = OPTIONAL_AUTH.has(route) ? await auth(headers) : null;
    return fn({ body, headers, query, ip, p: a ? a.p : null });
  };
}

// ../../home/claude/sobrevive/netlify/lib/http.mjs
var reply = (status, data) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
function createHandler(deps) {
  const handle = createApi(deps);
  return async (req, ctx = {}) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "") || "/";
    const headers = Object.fromEntries(req.headers);
    let body = {};
    if (req.method === "POST") {
      const txt = await req.text();
      if (txt.length > 16e3) return reply(413, { error: "too_big" });
      try {
        body = txt ? JSON.parse(txt) : {};
      } catch {
        return reply(400, { error: "bad_json" });
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) body = {};
    }
    const ip = ctx.ip || headers["x-nf-client-connection-ip"] || (headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
    try {
      const [status, data] = await handle({ method: req.method, path, query: url.searchParams, headers, body, ip });
      return reply(status, data);
    } catch (e) {
      console.error("api error", req.method, path, e && e.stack || e);
      return reply(500, { error: "server" });
    }
  };
}

// ../../home/claude/sobrevive/netlify/functions/api.mts
var handler = null;
function build(context) {
  const prod = context.deploy?.context === "production";
  const open = (name) => prod ? getStore({ name, consistency: "strong" }) : getDeployStore({ name, consistency: "strong" });
  return createHandler({
    players: open("players"),
    lb: open("leaderboard"),
    runs: open("runs"),
    misc: open("misc"),
    adminKey: Netlify.env.get("ADMIN_KEY") || ""
  });
}
var api_default = async (req, context) => {
  handler ||= build(context);
  return handler(req, context);
};
var config = {
  path: "/api/*"
};
export {
  config,
  api_default as default
};
