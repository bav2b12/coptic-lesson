// DOROS COPTIC — COPTIC VIRTUAL KEYBOARD & PHONETICS TOOL

const copticTools = {
  renderAlphabetView(container) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="animate-fade">
        <div style="margin-bottom: 2rem;">
          <h1 style="font-size: 1.8rem; font-weight: 900; margin-bottom: 0.5rem;">
            <span>Ⲁ</span>
            <span>${isAr ? 'حروف ونطق وقواعد اللغة القبطية' : 'Coptic Alphabet & Phonetics'}</span>
          </h1>
          <p style="color: var(--text-secondary); font-size: 1rem;">
            ${isAr ? 'اضغط على أي حرف للاستماع لطريقة النطق والتعرف على قواعد نطق الحروف المتحركة والساكنة.' : 'Click on any Coptic letter to review its phonetics and pronunciation rules.'}
          </p>
        </div>

        <div class="alphabet-grid">
          ${utils.copticAlphabet.map(letter => `
            <div class="alphabet-card" onclick="copticTools.speakLetter('${letter.name_ar}')">
              <div class="letter-glyph-large">${letter.char}</div>
              <div class="letter-name-ar">${isAr ? letter.name_ar : letter.name_en}</div>
              <div class="letter-sound-desc">${letter.sound}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  speakLetter(name) {
    window.api.showToast(`🗣️ ${window.i18n.getLang() === 'ar' ? 'نطق الحرف:' : 'Letter:'} ${name}`, 'info');
  },

  openKeyboard(targetInputId = null) {
    let modal = document.getElementById('coptic-kb-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'coptic-kb-modal';
      modal.className = 'modal-backdrop active';
      modal.innerHTML = `
        <div class="modal-box" style="max-width: 680px;">
          <div class="modal-header">
            <h3 class="modal-title">⌨️ ${window.i18n.t('coptic_keyboard')}</h3>
            <button class="modal-close-btn" onclick="document.getElementById('coptic-kb-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <input type="text" id="kb-live-text" class="form-input coptic-text" style="font-size: 1.4rem; height: 55px;" placeholder="ⲁⲛⲟⲕ...">
            </div>
            <div class="coptic-keyboard-modal">
              ${utils.copticAlphabet.map(l => {
                const charOnly = l.char.split(' ')[0];
                return `
                  <button class="coptic-key-btn" onclick="copticTools.insertKey('${charOnly}')">
                    <span>${charOnly}</span>
                    <span class="coptic-key-name">${l.name_ar}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline btn-sm" onclick="document.getElementById('kb-live-text').value = ''">مسح (Clear)</button>
            <button class="btn btn-gold btn-sm" onclick="copticTools.copyKeyboardText()">نسخ النص (Copy)</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.classList.add('active');
    }
  },

  insertKey(char) {
    const input = document.getElementById('kb-live-text');
    if (input) {
      input.value += char;
      input.focus();
    }
  },

  copyKeyboardText() {
    const input = document.getElementById('kb-live-text');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value);
      window.api.showToast(window.i18n.getLang() === 'ar' ? 'تم نسخ النص القبطي بنجاح!' : 'Coptic text copied to clipboard!', 'success');
    }
  }
};

window.copticTools = copticTools;
