import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

/**
 * React Router `errorElement` fallback — catches loader / routing failures
 * (e.g. Failed to fetch static-loader-data) that the render ErrorBoundary
 * cannot see. Prefer this over RR's default "Unexpected Application Error".
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const isZh =
    typeof document !== 'undefined' &&
    document.documentElement.lang?.startsWith('zh');

  let detail = '';
  if (isRouteErrorResponse(error)) {
    detail = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}
        >
          {isZh ? '出了点问题' : 'Something went wrong'}
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}
        >
          {isZh
            ? '页面加载时遇到意外错误。请刷新后重试。'
            : 'An unexpected error occurred while loading this page. Please reload and try again.'}
        </p>
        {detail ? (
          <p
            style={{
              fontSize: '12px',
              color: '#999',
              margin: '0 0 24px',
              wordBreak: 'break-word',
            }}
          >
            {detail}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '6px',
            background: '#1a1a1a',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {isZh ? '刷新页面' : 'Reload'}
        </button>
      </div>
    </div>
  );
}
