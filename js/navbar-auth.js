/**
 * TheValveHubs — Smart Navbar Auth
 * Adds Dashboard/Admin button when logged in, hides Join Free
 * Include on every page: <script src="js/navbar-auth.js"></script>
 */
(function () {
  function getUser() {
    try { return JSON.parse(localStorage.getItem('tvh_user')); } catch { return null; }
  }
  function getToken() { return localStorage.getItem('tvh_token'); }

  function updateNavbar() {
    const token = getToken();
    const user  = getUser();
    const navCta = document.querySelector('.nav-cta');
    const mobileCta = document.querySelector('.mobile-cta');
    if (!navCta) return;

    if (token && user) {
      // Hide "Join Free" links
      navCta.querySelectorAll('a[href*="#join"], a[href*="index.html#join"]').forEach(el => el.style.display = 'none');
      if (mobileCta) mobileCta.querySelectorAll('a[href*="#join"], a[href*="index.html#join"]').forEach(el => el.style.display = 'none');

      // Don't add duplicate
      if (navCta.querySelector('.tvh-dash-btn')) return;

      const isAdmin = user.role === 'ADMIN';
      const dashUrl = isAdmin ? 'admin.html' : 'dashboard.html';
      const dashLabel = isAdmin ? '⚙️ Admin' : '👤 Dashboard';
      const dashColor = isAdmin ? '#C8973A' : '#006C35';

      // Insert before Emergency button
      const dashBtn = document.createElement('a');
      dashBtn.href = dashUrl;
      dashBtn.className = 'btn btn-outline-green btn-sm tvh-dash-btn';
      dashBtn.style.cssText = `border-color:${dashColor};color:${dashColor};font-weight:700;`;
      dashBtn.textContent = dashLabel;

      const emergencyBtn = navCta.querySelector('.btn-red, a[href*="emergency"]');
      if (emergencyBtn) {
        navCta.insertBefore(dashBtn, emergencyBtn);
      } else {
        navCta.appendChild(dashBtn);
      }

      // Add logout button
      if (!navCta.querySelector('.tvh-logout-btn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn btn-sm tvh-logout-btn';
        logoutBtn.style.cssText = 'background:transparent;border:1.5px solid #D0D0D0;color:#888;cursor:pointer;font-size:.75rem;padding:5px 10px;border-radius:6px;';
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = function() {
          localStorage.removeItem('tvh_token');
          localStorage.removeItem('tvh_user');
          window.location.href = 'index.html';
        };
        navCta.appendChild(logoutBtn);
      }

      // Mobile nav — add dashboard link
      if (mobileCta && !mobileCta.querySelector('.tvh-dash-btn')) {
        const mDash = document.createElement('a');
        mDash.href = dashUrl;
        mDash.className = 'btn btn-green tvh-dash-btn';
        mDash.textContent = dashLabel;
        mobileCta.insertBefore(mDash, mobileCta.firstChild);
      }

    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavbar);
  } else {
    updateNavbar();
  }
})();
