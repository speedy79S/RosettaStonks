import {
    BeforeSendHeadersParams,
    FoundationsTimeRequestKey,
    FoundationsCourseRequestKey,
    FoundationsRequestFilter,
    BeforeSendRequestParams,
    FluencyBuilderRequestFilter,
    FluencyBuilderTimeRequestKey,
} from "../lib/env.ts";

import { Request } from "../lib/request.ts";

interface BeforeSendRequestRequest {
    requestId: string;
    requestHeaders: Array<{ name: string; value: string }> | undefined; // Headers for Firefox
    headers: any | undefined; // Headers for Chrome
    requestBody: any;
    timeStamp: number;
}

interface BeforeSendHeaderRequest {
    requestId: string;
    requestHeaders: Array<{ name: string; value: string }> | undefined; // Headers for Firefox
    headers: any | undefined; // Headers for Chrome
}

function storeRequest(key: string, isDecrease: boolean = false): (req: Request) => void {
    return async (req: Request) => {
        const slice: any = {};
        slice[key] = req;

        if (isDecrease) {
            console.debug(`Storing decrease request at "${key}"`, req);
        } else {
            console.debug(`Storing add request at "${key}"`, req);
        }

        await browser.storage.session.set(slice);
    };
}

function requestFromObject(req: BeforeSendRequestRequest): Request {
    let body: string | null = null;
    if (req.requestBody != null) {
        body = new TextDecoder().decode(req.requestBody.raw[0].bytes);
    }
    const headers: any = {};

    if (req.requestHeaders !== undefined)
        req.requestHeaders.forEach(({ name, value }) => (headers[name] = value));
    else if (req.headers !== undefined)
        Object.entries(req.headers).forEach(([name, value]) => (headers[name] = value));

    const timestamp: Date = req.timeStamp != null ? new Date(req.timeStamp) : new Date();

    return {
        ...(req as any),
        body,
        timestamp,
        headers,
    };
}

export interface RequestFilter {
    filter: (details: Request) => boolean;
    onMatched: (request: Request) => Promise<void>;
}

// Foundations Request Filter for Time Decrease
const foundationsDecreaseTimeRequest: RequestFilter = {
    filter: (details: Request) => {
        if (details.method !== "POST" || details.tabId === -1) return false;
        const url = URL.parse(details.url);
        return url?.pathname?.endsWith("decrease_time") || false; // Hypothetical endpoint for decreasing time
    },
    onMatched: storeRequest(FoundationsTimeRequestKey, true),
};

// Foundations Time Request Filter for Time Addition
const foundationsTimeRequest: RequestFilter = {
    filter: (details: Request) => {
        if (details.method !== "POST" || details.tabId === -1) return false;
        const url = URL.parse(details.url);
        return url?.pathname?.endsWith("path_scores") || false;
    },
    onMatched: storeRequest(FoundationsTimeRequestKey),
};

const foundationsCourseRequest: RequestFilter = {
    filter: (details: Request) => {
        if (details.method !== "GET" || details.tabId === -1) return false;
        const url = URL.parse(details.url);
        return url?.pathname?.endsWith("path_step_scores") || false;
    },
    onMatched: storeRequest(FoundationsCourseRequestKey),
};

const fluencyBuilderTimeRequest: RequestFilter = {
    filter: (details: Request) => {
        if (details.method !== "POST" || details.body === null || details.tabId === -1) return false;
        const url = URL.parse(details.url);
        if (url?.pathname !== "/graphql") return false;

        const body = JSON.parse(details.body);
        return body.operationName === "AddProgress";
    },
    onMatched: storeRequest(FluencyBuilderTimeRequestKey),
};

function setupRequestListeners(
    urlFilters: { urls: string[] },
    filters: Array<RequestFilter>
): void {
    const requestBuffers: Array<Request | null> = new Array(filters.length);

    browser.webRequest.onBeforeRequest.addListener(
        (details: BeforeSendRequestRequest) => {
            for (let i = 0; i < filters.length; i++) {
                const req = requestFromObject(details);
                if (filters[i].filter(req)) requestBuffers[i] = req;
            }
        },
        urlFilters,
        BeforeSendRequestParams
    );

    browser.webRequest.onBeforeSendHeaders.addListener(
        async (details: BeforeSendHeaderRequest) => {
            for (let i = 0; i < requestBuffers.length; i++) {
                const req = requestBuffers[i];
                if (req?.requestId !== details.requestId) continue;

                if (details.requestHeaders !== undefined)
                    details.requestHeaders.forEach(({ name, value }) => (req.headers[name] = value));
                else if (details.headers !== undefined)
                    Object.entries(details.headers).forEach(([name, value]) => (req.headers[name] = value));

                await filters[i].onMatched(req);
                requestBuffers[i] = null;
            }
        },
        urlFilters,
        BeforeSendHeadersParams
    );
}

export function setupListeners(): void {
    setupRequestListeners(FoundationsRequestFilter, [
        foundationsTimeRequest,
        foundationsCourseRequest,
        foundationsDecreaseTimeRequest, // Add the decrease time request filter
    ]);

    setupRequestListeners(FluencyBuilderRequestFilter, [fluencyBuilderTimeRequest]);
}
