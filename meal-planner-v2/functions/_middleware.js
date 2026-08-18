const ASSET_DIRECTORY = /^\/assets(?:\/|$)/;
const FILE_EXTENSION = /\/[^/]+\.[^/]+$/;

function isAssetRequest(request) {
  if (request.mode === 'navigate') return false;

  const { pathname } = new URL(request.url);
  return ASSET_DIRECTORY.test(pathname) || FILE_EXTENSION.test(pathname);
}

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';

  if (
    response.status === 200 &&
    isAssetRequest(context.request) &&
    contentType.toLowerCase().startsWith('text/html')
  ) {
    return new Response('Not Found\n', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return response;
}
