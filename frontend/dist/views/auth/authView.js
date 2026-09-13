export const AuthView = {
  render(container, router, params) {
    const roleParam = (params && params.role) ? params.role.toLowerCase() : 'farmer';
    let currentRole = ['farmer', 'buyer', 'owner'].includes(roleParam) ? roleParam : 'farmer';
    let otpSent = false;
    let currentEmail = '';
    let currentPreviewOtp = '';

    const themeColor = currentRole === 'farmer' ? '#10b981' : currentRole === 'buyer' ? '#38bdf8' : '#c084fc';
    const roleTitle = currentRole === 'farmer' ? '👨‍🌾 Farmer & FPO Portal' : currentRole === 'buyer' ? '🛒 Institutional Buyer Portal' : '🛡️ Platform Owner / DOCA Regulator';
    const defaultEmail = currentRole === 'farmer' ? 'farmer@kisandirect.gov.in' : currentRole === 'buyer' ? 'procurement@reliancefresh.com' : 'owner@kisandirect.com';

    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; background: radial-gradient(circle at center, #0f1c32 0%, #060913 100%);">
        
        <div style="margin-bottom: 2rem; text-align: center;">
          <a href="/" id="btnBackGateway" style="display: inline-flex; align-items: center; gap: 8px; color: #94a3b8; text-decoration: none; font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; transition: color 0.2s;">
            &larr; Back to Role Gateway
          </a>
          <h2 style="font-size: 1.8rem; font-weight: 800; color: #fff;">
            Role-Aware OTP Verification Gateway
          </h2>
          <p style="font-size: 0.9rem; color: #94a3b8;">
            Direct single-use 6-digit authentication for authenticated participants
          </p>
        </div>

        <!-- Role Selector Tabs -->
        <div style="display: flex; gap: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 5px; border-radius: 9999px; margin-bottom: 2rem;">
          <button class="role-tab-btn ${currentRole === 'farmer' ? 'active farmer' : ''}" data-role="farmer" style="padding: 6px 16px; border-radius: 9999px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; color: ${currentRole === 'farmer' ? '#fff' : '#94a3b8'}; background: ${currentRole === 'farmer' ? '#10b981' : 'transparent'};">
            👨‍🌾 Farmer
          </button>
          <button class="role-tab-btn ${currentRole === 'buyer' ? 'active buyer' : ''}" data-role="buyer" style="padding: 6px 16px; border-radius: 9999px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; color: ${currentRole === 'buyer' ? '#fff' : '#94a3b8'}; background: ${currentRole === 'buyer' ? '#38bdf8' : 'transparent'};">
            🛒 Buyer
          </button>
          <button class="role-tab-btn ${currentRole === 'owner' ? 'active owner' : ''}" data-role="owner" style="padding: 6px 16px; border-radius: 9999px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; color: ${currentRole === 'owner' ? '#fff' : '#94a3b8'}; background: ${currentRole === 'owner' ? '#c084fc' : 'transparent'};">
            🛡️ Owner / Admin
          </button>
        </div>

        <!-- Auth Card -->
        <div class="card" style="width: 100%; max-width: 480px; border-color: ${themeColor}40; box-shadow: 0 15px 40px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 1.5rem;">${currentRole === 'farmer' ? '🌾' : currentRole === 'buyer' ? '🛒' : '🛡️'}</div>
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff;">${roleTitle}</h3>
              <span style="font-size: 0.75rem; color: ${themeColor}; font-weight: 700;">Secured Authentication Pipeline</span>
            </div>
          </div>

          <!-- Alert / Error message container -->
          <div id="authAlert" style="display: none; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1.25rem;"></div>

          <!-- STEP 1: REQUEST OTP FORM -->
          <form id="step1Form" style="display: block;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label">Email Address</label>
              <input type="email" id="inputEmail" class="form-control" value="${defaultEmail}" required placeholder="user@example.com" />
            </div>

            ${currentRole === 'owner' ? `
              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label">Owner Master Password (Required for Admin Access)</label>
                <input type="password" id="inputPassword" class="form-control" value="owner123" required placeholder="Master Password" />
                <span style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Pre-seeded Admin Security Requirement. Open registration prohibited.</span>
              </div>
            ` : ''}

            <!-- 1-Click Demo Fill Button -->
            <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 1.25rem; font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #94a3b8;">Demo Credentials: <strong>${defaultEmail}</strong></span>
              <button type="button" id="btnQuickDemoFill" style="background: none; border: none; color: ${themeColor}; font-weight: 700; cursor: pointer; text-decoration: underline;">
                1-Click Auto Fill
              </button>
            </div>

            <button type="submit" id="btnSendOtp" class="btn" style="width: 100%; padding: 12px; background: ${themeColor}; color: #fff; font-weight: 700;">
              Send 6-Digit Email OTP &rarr;
            </button>
          </form>

          <!-- STEP 2: VERIFY OTP FORM (Hidden initially) -->
          <form id="step2Form" style="display: none;">
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 1.25rem; text-align: center;">
              <div style="font-size: 0.78rem; color: #34d399; font-weight: 700;">OTP Dispatched Successfully</div>
              <div style="font-size: 0.82rem; color: #f8fafc; margin-top: 2px;">Enter 6-digit code sent to <strong id="displayEmail"></strong></div>
              <div id="otpLivePreview" style="margin-top: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 800; color: #fbbf24; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 4px; display: inline-block;"></div>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="text-align: center;">Enter 6-Digit Code</label>
              <input type="text" id="inputOtp" class="form-control" maxlength="6" style="text-align: center; font-size: 1.5rem; letter-spacing: 0.4em; font-family: monospace; font-weight: 800;" placeholder="••••••" required />
            </div>

            <button type="submit" id="btnVerifyOtp" class="btn" style="width: 100%; padding: 12px; background: ${themeColor}; color: #fff; font-weight: 700; margin-bottom: 10px;">
              Verify OTP & Enter Portal &rarr;
            </button>

            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 8px;">
              <button type="button" id="btnChangeEmail" style="background: none; border: none; color: #94a3b8; cursor: pointer;">
                &larr; Change Email
              </button>
              <button type="button" id="btnResendOtp" style="background: none; border: none; color: ${themeColor}; font-weight: 700; cursor: pointer;">
                Resend Code
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Role switcher tab buttons
    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selectedRole = e.currentTarget.getAttribute('data-role');
        router.navigate(`/auth/login?role=${selectedRole}`);
      });
    });

    document.getElementById('btnBackGateway')?.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/');
    });

    const step1Form = document.getElementById('step1Form');
    const step2Form = document.getElementById('step2Form');
    const inputEmail = document.getElementById('inputEmail');
    const inputPassword = document.getElementById('inputPassword');
    const inputOtp = document.getElementById('inputOtp');
    const authAlert = document.getElementById('authAlert');
    const displayEmail = document.getElementById('displayEmail');
    const otpLivePreview = document.getElementById('otpLivePreview');

    function showAlert(msg, isError = false) {
      authAlert.style.display = 'block';
      authAlert.style.background = isError ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      authAlert.style.border = isError ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
      authAlert.style.color = isError ? '#fda4af' : '#6ee7b7';
      authAlert.textContent = msg;
    }

    // Quick demo fill
    document.getElementById('btnQuickDemoFill')?.addEventListener('click', () => {
      inputEmail.value = defaultEmail;
      if (inputPassword) inputPassword.value = 'owner123';
      showAlert(`Loaded pre-configured credentials for ${currentRole.toUpperCase()}`, false);
    });

    // Step 1: Send OTP
    step1Form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = inputEmail.value.trim();
      const password = inputPassword ? inputPassword.value : undefined;

      showAlert('Generating secure 6-digit OTP...', false);

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: currentRole, password })
        });
        const data = await res.json();

        if (data.success) {
          currentEmail = email;
          currentPreviewOtp = data.otp_preview;
          displayEmail.textContent = email;
          otpLivePreview.textContent = `Demo OTP: ${data.otp_preview}`;
          inputOtp.value = data.otp_preview; // Auto-fill for friction-free evaluation!

          step1Form.style.display = 'none';
          step2Form.style.display = 'block';
          showAlert(`Verification code generated! (Valid for 5 minutes)`, false);
        } else {
          showAlert(data.message || data.error || 'Failed to send OTP', true);
        }
      } catch (err) {
        showAlert('Network error while requesting OTP.', true);
      }
    });

    // Step 2: Verify OTP
    step2Form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otp = inputOtp.value.trim();

      showAlert('Verifying code and issuing role token...', false);

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail, otp })
        });
        const data = await res.json();

        if (data.success && data.token) {
          localStorage.setItem('kd_token', data.token);
          localStorage.setItem('kd_user', JSON.stringify(data.user));

          showAlert(`Authentication verified as ${data.role.toUpperCase()}! Redirecting to portal...`, false);

          setTimeout(() => {
            if (data.role === 'farmer') {
              router.navigate('/farmer/dashboard');
            } else if (data.role === 'buyer') {
              router.navigate('/buyer/marketplace');
            } else if (data.role === 'owner') {
              router.navigate('/owner/control-room');
            }
          }, 400);
        } else {
          showAlert(data.message || data.error || 'Invalid OTP', true);
        }
      } catch (err) {
        showAlert('Network error during verification.', true);
      }
    });

    document.getElementById('btnChangeEmail')?.addEventListener('click', () => {
      step2Form.style.display = 'none';
      step1Form.style.display = 'block';
      authAlert.style.display = 'none';
    });

    document.getElementById('btnResendOtp')?.addEventListener('click', () => {
      step1Form.dispatchEvent(new Event('submit'));
    });
  }
};
