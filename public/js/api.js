// DOROS COPTIC — API CLIENT WRAPPER

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
    this.token = localStorage.getItem('doros_coptic_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('doros_coptic_token', token);
    } else {
      localStorage.removeItem('doros_coptic_token');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('doros_coptic_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If unauthorized or deactivated, clean token
        if (response.status === 401 || response.status === 403) {
          if (data.message && data.message.includes('expired') || response.status === 401) {
            // Trigger session expiry event
            if (this.token && !endpoint.includes('/login') && !endpoint.includes('/setup')) {
              this.setToken(null);
              window.dispatchEvent(new CustomEvent('sessionExpired'));
            }
          }
        }

        const isAr = window.i18n ? window.i18n.getLang() === 'ar' : true;
        const msg = (isAr && data.message_ar) ? data.message_ar : (data.message || 'An error occurred.');
        const error = new Error(msg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  get(endpoint, query = {}) {
    const params = new URLSearchParams();
    Object.keys(query).forEach(k => {
      if (query[k] !== undefined && query[k] !== null && query[k] !== '') {
        params.append(k, query[k]);
      }
    });
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`${endpoint}${queryString}`, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Toast Notification Trigger
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-size: 1.2rem;">${icon}</span>
      <div style="flex: 1; font-size: 0.9rem; font-weight: 600;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

window.api = new ApiClient();
