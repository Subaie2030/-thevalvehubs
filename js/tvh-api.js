/**
 * TheValveHubs — API Client
 * ربط الـ Frontend بالـ Backend API
 * جميع الصفحات تستخدم هذا الملف
 */

const TVH_API = (() => {

  const BASE = 'https://thevalvehubs-backend-production.up.railway.app/api';

  // ── Token Management ─────────────────────────────
  const getToken  = ()        => localStorage.getItem('tvh_token');
  const setToken  = (tok)     => localStorage.setItem('tvh_token', tok);
  const clearAuth = ()        => { localStorage.removeItem('tvh_token'); localStorage.removeItem('tvh_user'); };
  const getUser   = ()        => { try { return JSON.parse(localStorage.getItem('tvh_user')); } catch { return null; } };
  const setUser   = (user)    => localStorage.setItem('tvh_user', JSON.stringify(user));
  const isLoggedIn = ()       => !!getToken();

  // ── HTTP Helper ──────────────────────────────────
  const request = async (method, path, body = null, auth = false) => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const tok = getToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
    }
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, message: data.error || 'Request failed', data };
    return data;
  };

  // ── AUTH ─────────────────────────────────────────
  const auth = {
    register: async ({ email, password, role, nameEn }) => {
      const data = await request('POST', '/auth/register', { email, password, role, nameEn });
      setToken(data.token);
      setUser(data.user);
      return data;
    },
    login: async ({ email, password }) => {
      const data = await request('POST', '/auth/login', { email, password });
      setToken(data.token);
      setUser(data.user);
      return data;
    },
    logout: () => {
      clearAuth();
      window.location.href = 'index.html';
    },
    me: () => request('GET', '/auth/me', null, true),
  };

  // ── SUPPLIERS ────────────────────────────────────
  const suppliers = {
    list:       (params = {}) => request('GET', '/suppliers?' + new URLSearchParams(params)),
    get:        (id)          => request('GET', `/suppliers/${id}`),
    saveProfile:(data)        => request('POST', '/suppliers/profile', data, true),
    myProfile:  ()            => request('GET', '/suppliers/me/profile', null, true),
    addCert:    (data)        => request('POST', '/suppliers/certs', data, true),
  };

  // ── SUBSCRIPTIONS ────────────────────────────────
  const subscriptions = {
    plans:   ()           => request('GET', '/plans'),
    current: ()           => request('GET', '/subscriptions/current', null, true),
    create:  (data)       => request('POST', '/subscriptions', data, true),
    cancel:  (id)         => request('DELETE', `/subscriptions/${id}`, null, true),
    invoices:()           => request('GET', '/invoices', null, true),
  };

  // ── RFQs ─────────────────────────────────────────
  const rfqs = {
    list:      (params={}) => request('GET', '/rfqs?' + new URLSearchParams(params), null, true),
    create:    (data)      => request('POST', '/rfqs', data, true),
    get:       (id)        => request('GET', `/rfqs/${id}`, null, true),
    respond:   (id, data)  => request('POST', `/rfqs/${id}/respond`, data, true),
    award:     (id, data)  => request('PUT', `/rfqs/${id}/award`, data, true),
  };

  // ── EMERGENCY ────────────────────────────────────
  const emergency = {
    submit: (data) => request('POST', '/rfqs/emergency', data, true),
    get:    (id)   => request('GET', `/rfqs/emergency/${id}`, null, true),
  };

  // ── IKTVA ────────────────────────────────────────
  const iktva = {
    calculate: (data)  => request('POST', '/iktva/calculate', data, true),
    history:   ()      => request('GET', '/iktva/history', null, true),
    benchmark: ()      => request('GET', '/iktva/benchmark'),
  };

  // ── UI Helpers ───────────────────────────────────
  const ui = {
    // عرض رسالة نجاح
    success: (msg, containerId = 'tvh-msg') => {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = `<div style="background:#E8F5E9;border:1px solid #4CAF50;color:#1B5E20;padding:12px 16px;border-radius:8px;font-size:.88rem;font-weight:600;">${msg}</div>`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    // عرض رسالة خطأ
    error: (msg, containerId = 'tvh-msg') => {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = `<div style="background:#FFEBEE;border:1px solid #F44336;color:#B71C1C;padding:12px 16px;border-radius:8px;font-size:.88rem;font-weight:600;">⚠️ ${msg}</div>`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    // تعطيل/تفعيل زر
    setLoading: (btn, loading, originalText) => {
      btn.disabled = loading;
      btn.textContent = loading ? '⏳ Please wait...' : originalText;
    },
    // تحديث شريط التنقل حسب حالة تسجيل الدخول
    updateNav: () => {
      const user = getUser();
      const loginBtn = document.getElementById('tvh-login-btn');
      const logoutBtn = document.getElementById('tvh-logout-btn');
      const userDisplay = document.getElementById('tvh-user-display');
      if (loginBtn)    loginBtn.style.display    = user ? 'none' : 'inline-block';
      if (logoutBtn)   logoutBtn.style.display   = user ? 'inline-block' : 'none';
      if (userDisplay) userDisplay.textContent   = user ? user.email : '';
    },
  };

  // تهيئة تلقائية عند تحميل أي صفحة
  document.addEventListener('DOMContentLoaded', () => ui.updateNav());

  return { auth, suppliers, subscriptions, rfqs, emergency, iktva, ui, isLoggedIn, getUser, getToken };

})();
