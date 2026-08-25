// DOROS COPTIC — ADMIN PLATFORM SETTINGS CONTROLLER

const adminSettings = {
  async render(container) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="animate-fade" style="max-width: 750px;">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.8rem; font-weight: 900;">⚙️ ${window.i18n.t('settings')}</h1>
          <p style="color: var(--text-secondary); font-size: 0.95rem;">${isAr ? 'تخصيص هوية المنصة، بيانات التواصل، والألوان الأساسية.' : 'Customize platform branding, colors, and global configurations.'}</p>
        </div>

        <div class="card">
          <form id="platform-settings-form">
            <div class="form-group">
              <label class="form-label">${isAr ? 'اسم المنصة بالعربية' : 'Platform Name (Arabic)'}</label>
              <input type="text" id="set-name-ar" class="form-input" required>
            </div>

            <div class="form-group">
              <label class="form-label">${isAr ? 'اسم المنصة بالإنجليزية' : 'Platform Name (English)'}</label>
              <input type="text" id="set-name-en" class="form-input" required>
            </div>

            <div class="form-group">
              <label class="form-label">${isAr ? 'الشعار النصي (Tagline)' : 'Tagline'}</label>
              <input type="text" id="set-tagline-ar" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">${isAr ? 'البريد الإلكتروني للدعم' : 'Support Email'}</label>
              <input type="email" id="set-email" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">${isAr ? 'رقم الهاتف للتواصل' : 'Contact Phone'}</label>
              <input type="text" id="set-phone" class="form-input">
            </div>

            <button type="submit" class="btn btn-gold btn-lg" style="width: 100%; margin-top: 1rem;">
              <span>💾</span>
              <span>${isAr ? 'حفظ إعدادات المنصة' : 'Save Settings'}</span>
            </button>
          </form>
        </div>
      </div>
    `;

    await this.loadSettings();
  },

  async loadSettings() {
    try {
      const res = await window.api.get('/settings');
      const s = res.settings || {};

      if (document.getElementById('set-name-ar')) document.getElementById('set-name-ar').value = s.platform_name_ar || 'دروس قبطي';
      if (document.getElementById('set-name-en')) document.getElementById('set-name-en').value = s.platform_name || 'Doros Coptic';
      if (document.getElementById('set-tagline-ar')) document.getElementById('set-tagline-ar').value = s.platform_tagline_ar || '';
      if (document.getElementById('set-email')) document.getElementById('set-email').value = s.contact_email || '';
      if (document.getElementById('set-phone')) document.getElementById('set-phone').value = s.contact_phone || '';

      const form = document.getElementById('platform-settings-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const settings = {
            platform_name_ar: document.getElementById('set-name-ar').value,
            platform_name: document.getElementById('set-name-en').value,
            platform_tagline_ar: document.getElementById('set-tagline-ar').value,
            contact_email: document.getElementById('set-email').value,
            contact_phone: document.getElementById('set-phone').value
          };

          try {
            const res = await window.api.put('/settings', { settings });
            window.api.showToast(window.i18n.getLang() === 'ar' ? res.message_ar : res.message, 'success');
          } catch (err) {
            window.api.showToast(err.message, 'error');
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
};

window.adminSettings = adminSettings;
