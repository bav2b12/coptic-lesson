// DOROS COPTIC — AUTHENTICATION CONTROLLER

const auth = {
  currentTab: 'login',

  async checkSession() {
    const token = window.api.getToken();
    if (!token) return false;

    try {
      const res = await window.api.get('/auth/me');
      if (res.success && res.user) {
        window.appState.setUser(res.user);
        return true;
      }
      return false;
    } catch (e) {
      window.api.setToken(null);
      return false;
    }
  },

  async checkSetupStatus() {
    try {
      const res = await window.api.get('/auth/setup-status');
      return !!res.setupRequired;
    } catch (e) {
      return false;
    }
  },

  renderAuthView(container, isFirstSetup = false) {
    const isAr = window.i18n.getLang() === 'ar';

    // 1. First Super Admin Setup Wizard (Only when zero users exist)
    if (isFirstSetup) {
      container.innerHTML = `
        <div class="auth-wrapper animate-fade">
          <div class="auth-card">
            <div class="auth-header">
              <div class="auth-brand-logo">ⲁ</div>
              <h1 class="auth-title">${isAr ? 'إعداد المدير العام للنظام' : 'Super Admin Initial Setup'}</h1>
              <p class="auth-subtitle">${isAr ? 'مرحباً بك في منصة دروس قبطي! قم بإنشاء أول حساب للمدير العام للبدء في إدارة المنصة.' : 'Welcome to Doros Coptic! Create the primary Super Administrator account.'}</p>
            </div>

            <div class="auth-first-admin-badge">
              <span>👑</span>
              <div>
                <strong>${isAr ? 'صلاحيات كاملة للمنصة (Super Admin)' : 'Full Platform Super Admin'}</strong>
                <div style="font-size: 0.8rem; opacity: 0.9;">${isAr ? 'هذا الحساب يمتلك صلاحيات إدارة كل الكورسات والطلاب والمشرفين والأكواد.' : 'This account has global control over courses, users, codes, and settings.'}</div>
              </div>
            </div>

            <form id="setup-form">
              <div class="form-group">
                <label class="form-label">${window.i18n.t('full_name')}</label>
                <input type="text" id="setup-name" class="form-input" placeholder="${isAr ? 'مثال: بيتر عادل' : 'e.g. Peter Adel'}" required>
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('phone_number')}</label>
                <input type="tel" id="setup-phone" class="form-input" placeholder="01000000000" required>
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('password')}</label>
                <input type="password" id="setup-password" class="form-input" placeholder="••••••••" minlength="6" required>
              </div>

              <div class="form-group">
                <label class="form-label">${isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                <input type="password" id="setup-confirm-password" class="form-input" placeholder="••••••••" minlength="6" required>
              </div>

              <button type="submit" class="btn btn-gold btn-lg" style="width: 100%; margin-top: 1.25rem;">
                <span>✨</span>
                <span>${isAr ? 'إنشاء حساب المدير العام وبدء العمل' : 'Create Super Admin & Launch'}</span>
              </button>
            </form>
          </div>
        </div>
      `;

      document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('setup-name').value;
        const phone = document.getElementById('setup-phone').value;
        const password = document.getElementById('setup-password').value;
        const confirm_password = document.getElementById('setup-confirm-password').value;

        if (password !== confirm_password) {
          window.api.showToast(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match', 'error');
          return;
        }

        try {
          const res = await window.api.post('/auth/setup', { name, phone, password, confirm_password });
          if (res.success) {
            window.api.setToken(res.token);
            window.appState.setUser(res.user);
            window.api.showToast(isAr ? 'تم إنشاء حساب المدير العام بنجاح!' : 'Super Admin created successfully!', 'success');
            window.appRouter.navigate('admin-dashboard');
          }
        } catch (err) {
          window.api.showToast(err.message, 'error');
        }
      });
      return;
    }

    // 2. Standard Two-Option Authentication Interface (Login vs Create/Activate Account)
    container.innerHTML = `
      <div class="auth-wrapper animate-fade">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-brand-logo">ⲁ</div>
            <h1 class="auth-title">${window.i18n.t('platform_name')}</h1>
            <p class="auth-subtitle">${window.i18n.t('tagline')}</p>
          </div>

          <!-- Two-Option Navigation Switch -->
          <div class="auth-toggle-tabs">
            <button type="button" class="auth-tab-btn active" id="tab-btn-login" onclick="auth.switchTab('login')">
              <span>🔐</span>
              <span>${window.i18n.t('login_btn')}</span>
            </button>
            <button type="button" class="auth-tab-btn" id="tab-btn-register" onclick="auth.switchTab('register')">
              <span>📝</span>
              <span>${isAr ? 'إنشاء وتفعيل الحساب' : 'Create Account'}</span>
            </button>
          </div>

          <!-- TAB 1: LOGIN -->
          <div id="auth-tab-login" class="auth-tab-content active">
            <form id="login-form">
              <div class="form-group">
                <label class="form-label">${window.i18n.t('phone_number')}</label>
                <input type="tel" id="login-phone" class="form-input" placeholder="01000000000" required autocomplete="tel">
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('password')}</label>
                <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
              </div>

              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: 1rem;">
                <span>🚀</span>
                <span>${window.i18n.t('login_btn')}</span>
              </button>
            </form>
          </div>

          <!-- TAB 2: CREATE ACCOUNT -->
          <div id="auth-tab-register" class="auth-tab-content" style="display: none;">
            <div class="auth-controlled-info-card">
              <div class="auth-controlled-icon">🛡️</div>
              <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--accent-gold);">${isAr ? 'إنشاء حساب جديد' : 'Create Account'}</h3>
              <p style="font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 1rem;">
                ${isAr ? 'يتم إصدار أكواد الدخول من خلال إدارة المنصة. إذا كان هذا أول حساب في النظام، فسيصبح المدير العام تلقائياً.' : 'Access codes are issued by the platform administrator. If this is the first account, it becomes the Super Admin automatically.'}
              </p>
            </div>

            <form id="register-form" style="margin-top: 1.25rem;">
              <div class="form-group">
                <label class="form-label">${isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                <input type="text" id="register-name" class="form-input" placeholder="${isAr ? 'مثال: John Hanna' : 'e.g. John Hanna'}" required>
              </div>

              <div class="form-group">
                <label class="form-label">${isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
                <input type="tel" id="register-phone" class="form-input" placeholder="01000000000" required autocomplete="tel">
              </div>

              <div class="form-group">
                <label class="form-label">${isAr ? 'كود الوصول' : 'Access Code'}</label>
                <input type="text" id="register-access-code" class="form-input" placeholder="COP-001" style="text-transform: uppercase; font-family: monospace; font-weight: 700; letter-spacing: 0.05em;">
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('password')}</label>
                <input type="password" id="register-password" class="form-input" placeholder="••••••••" minlength="6" required autocomplete="new-password">
              </div>

              <div class="form-group">
                <label class="form-label">${isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                <input type="password" id="register-confirm-password" class="form-input" placeholder="••••••••" minlength="6" required autocomplete="new-password">
              </div>

              <button type="submit" class="btn btn-gold btn-lg" style="width: 100%; margin-top: 1rem;">
                <span>✨</span>
                <span>${isAr ? 'إنشاء الحساب' : 'Create Account'}</span>
              </button>
            </form>
          </div>

        </div>
      </div>
    `;

    // Login Form Submit Handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('login-phone').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await window.api.post('/auth/login', { phone, password });
        if (res.success) {
          window.api.setToken(res.token);
          window.appState.setUser(res.user);
          window.api.showToast(isAr ? res.message_ar : res.message, 'success');

          if (res.user.role === 'student') {
            window.appRouter.navigate('dashboard');
          } else {
            window.appRouter.navigate('admin-dashboard');
          }
        }
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const phone = document.getElementById('register-phone').value;
        const access_code = document.getElementById('register-access-code').value;
        const password = document.getElementById('register-password').value;
        const confirm_password = document.getElementById('register-confirm-password').value;

        if (password !== confirm_password) {
          window.api.showToast(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match', 'error');
          return;
        }

        try {
          const res = await window.api.post('/auth/register', {
            name,
            phone,
            access_code: access_code || null,
            password,
            confirm_password
          });

          if (res.success) {
            window.api.setToken(res.token);
            window.appState.setUser(res.user);
            window.api.showToast(isAr ? res.message_ar : res.message, 'success');

            if (res.user.role === 'student') {
              window.appRouter.navigate('dashboard');
            } else {
              window.appRouter.navigate('admin-dashboard');
            }
          }
        } catch (err) {
          window.api.showToast(err.message, 'error');
        }
      });
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const loginTab = document.getElementById('auth-tab-login');
    const registerTab = document.getElementById('auth-tab-register');
    const btnLogin = document.getElementById('tab-btn-login');
    const btnRegister = document.getElementById('tab-btn-register');

    if (tabName === 'login') {
      if (loginTab) loginTab.style.display = 'block';
      if (registerTab) registerTab.style.display = 'none';
      if (btnLogin) btnLogin.classList.add('active');
      if (btnRegister) btnRegister.classList.remove('active');
    } else {
      if (loginTab) loginTab.style.display = 'none';
      if (registerTab) registerTab.style.display = 'block';
      if (btnLogin) btnLogin.classList.remove('active');
      if (btnRegister) btnRegister.classList.add('active');
    }
  },

  fillDemo(phone, password, code = '') {
    this.switchTab('login');
    if (document.getElementById('login-phone')) document.getElementById('login-phone').value = phone;
    if (document.getElementById('login-password')) document.getElementById('login-password').value = password;
  },

  logout() {
    window.api.setToken(null);
    window.appState.setUser(null);
    window.location.hash = '';
    window.location.reload();
  }
};

window.auth = auth;

