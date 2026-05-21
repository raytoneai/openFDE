/**
 * API Client with automatic token refresh
 * Handles authentication tokens and provides a consistent interface for API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
}

type AuthChangeCallback = (isAuthenticated: boolean) => void;
type ApiRequestOptions = RequestInit & { timeoutMs?: number };

// Constants for token refresh
const REFRESH_TIMEOUT_MS = 10000; // 10 seconds timeout for refresh requests
const REFRESH_LOCK_TIMEOUT_MS = 15000; // 15 seconds max lock time

class ApiClient {
  private tokens: TokenStore = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
  };
  private refreshPromise: Promise<boolean> | null = null;
  private refreshLockTime: number | null = null;
  private authChangeCallbacks: Set<AuthChangeCallback> = new Set();

  constructor() {
    // Load tokens from localStorage on initialization
    this.loadTokens();
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokens(): void {
    try {
      const stored = localStorage.getItem('auth-tokens');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.tokens = {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        };
      }
    } catch {
      this.clearTokens();
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokens(): void {
    localStorage.setItem(
      'auth-tokens',
      JSON.stringify({
        accessToken: this.tokens.accessToken,
        refreshToken: this.tokens.refreshToken,
        expiresAt: this.tokens.expiresAt?.toISOString(),
      })
    );
  }

  /**
   * Clear all tokens
   */
  private clearTokens(): void {
    this.tokens = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    };
    localStorage.removeItem('auth-tokens');
    this.notifyAuthChange(false);
  }

  /**
   * Set tokens from auth response
   */
  setTokens(authResponse: AuthResponse): void {
    this.tokens = {
      accessToken: authResponse.tokens.accessToken,
      refreshToken: authResponse.tokens.refreshToken,
      expiresAt: new Date(authResponse.tokens.expiresAt),
    };
    this.saveTokens();
    this.notifyAuthChange(true);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.tokens.accessToken;
  }

  /**
   * Check if the access token has expired
   */
  isTokenExpired(): boolean {
    if (!this.tokens.expiresAt) return false;
    return new Date() >= this.tokens.expiresAt;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthChange(callback: AuthChangeCallback): () => void {
    this.authChangeCallbacks.add(callback);
    return () => this.authChangeCallbacks.delete(callback);
  }

  /**
   * Notify all subscribers of auth state change
   */
  private notifyAuthChange(isAuthenticated: boolean): void {
    this.authChangeCallbacks.forEach((callback) => callback(isAuthenticated));
  }

  /**
   * Make a fetch request with authentication
   */
  private async fetchWithAuth(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (this.tokens.accessToken) {
      headers.set('Authorization', `Bearer ${this.tokens.accessToken}`);
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  }

  /**
   * Create a promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Refresh access token with timeout
   */
  private async doRefresh(): Promise<boolean> {
    if (!this.tokens.refreshToken) {
      this.clearTokens();
      return false;
    }

    this.refreshLockTime = Date.now();

    try {
      const response = await this.withTimeout(
        fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
        }),
        REFRESH_TIMEOUT_MS
      );

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = (await response.json()) as AuthResponse;
      this.setTokens(data);
      return true;
    } catch {
      this.clearTokens();
      return false;
    } finally {
      this.refreshPromise = null;
      this.refreshLockTime = null;
    }
  }

  /**
   * Refresh tokens (with deduplication and stale lock detection)
   */
  private async refreshTokens(): Promise<boolean> {
    // Check for stale lock (refresh stuck for too long)
    if (
      this.refreshPromise &&
      this.refreshLockTime &&
      Date.now() - this.refreshLockTime > REFRESH_LOCK_TIMEOUT_MS
    ) {
      // Reset stale lock
      this.refreshPromise = null;
      this.refreshLockTime = null;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    return this.refreshPromise;
  }

  /**
   * Make an authenticated API request
   */
  async request<T>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { timeoutMs, signal: upstreamSignal, ...fetchOptions } = options;
    const controller = timeoutMs ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const abortFromUpstream = () => controller?.abort(upstreamSignal?.reason);
    if (controller && upstreamSignal) {
      if (upstreamSignal.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
      }
    }

    if (controller && timeoutMs) {
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timeout after ${Math.round(timeoutMs / 1000)} seconds`));
      }, timeoutMs);
    }

    const effectiveOptions: RequestInit = {
      ...fetchOptions,
      signal: controller?.signal ?? upstreamSignal,
    };

    try {
      let response = await this.fetchWithAuth(path, effectiveOptions);

      // If 401, try to refresh token and retry
      if (response.status === 401 && this.tokens.refreshToken) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          response = await this.fetchWithAuth(path, effectiveOptions);
        }
      }

      // Handle error responses
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP ${response.status}`,
        }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      if (controller?.signal.aborted && controller.signal.reason instanceof Error) {
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  /**
   * Logout - clear tokens and notify server
   */
  async logout(): Promise<void> {
    try {
      if (this.tokens.refreshToken) {
        await this.post('/auth/logout', {
          refreshToken: this.tokens.refreshToken,
        });
      }
    } finally {
      this.clearTokens();
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export type { AuthResponse };
