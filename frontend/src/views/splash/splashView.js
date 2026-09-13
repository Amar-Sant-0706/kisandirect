export const SplashView = {
  render(container, router) {
    container.innerHTML = `
      <div id="splashWrapper" style="position: fixed; inset: 0; background: radial-gradient(circle at center, #111e38 0%, #060a14 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100;">
        <div id="splashSequence" style="display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.6s ease;">
          <div style="width: 100px; height: 100px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; display: flex; align-items: center; justify-content: center; color: #10b981; font-size: 3rem; box-shadow: 0 0 50px rgba(16, 185, 129, 0.4); animation: pulseLogo 1.5s infinite ease-in-out; margin-bottom: 1.5rem;">
            🌱
          </div>
          <h1 style="font-size: 2.2rem; font-weight: 800; color: #fff; letter-spacing: -0.03em; margin-bottom: 8px;">
            KisanDirect <span style="color: #10b981;">AI</span>
          </h1>
          <p style="font-size: 0.95rem; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; margin-bottom: 2rem;">
            Ministry of Consumer Affairs (DOCA) • National Farmgate Grid
          </p>
          <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; position: relative;">
            <div style="width: 50%; height: 100%; background: #10b981; position: absolute; animation: loadBar 1.2s infinite ease-in-out;"></div>
          </div>
        </div>

        <!-- Role Choice Gateway (Revealed after splash) -->
        <div id="gatewaySequence" style="display: none; max-width: 1080px; width: 92%; margin: 0 auto; text-align: center; opacity: 0; transition: opacity 0.5s ease-out;">
          <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 16px; border-radius: 9999px; color: #34d399; font-size: 0.8rem; font-weight: 700; margin-bottom: 1.5rem;">
            🏛️ Government of India • DOCA Disintermediation Grid
          </div>
          <h2 style="font-size: 2.4rem; font-weight: 800; color: #fff; letter-spacing: -0.02em; margin-bottom: 12px;">
            Choose Your Dedicated Platform Portal
          </h2>
          <p style="font-size: 1.05rem; color: #94a3b8; max-width: 650px; margin: 0 auto 3rem;">
            Strict Role-Based Architecture. Select your participant profile to access isolated grower, buyer, or regulatory controls.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; text-align: left;">
            <!-- Farmer Card -->
            <div class="card" style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 2rem; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;" id="cardFarmer">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 1.25rem;">
                🚜
              </div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-bottom: 8px;">Farmer & FPO Portal</h3>
              <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem;">
                Direct farmgate price realization, AI crop quality grading, T+1 escrow payout tracker, and scheduled cold-chain reefer pickups.
              </p>
              <button class="btn btn-primary-farmer" style="width: 100%; padding: 12px;">
                Enter as Farmer &rarr;
              </button>
            </div>

            <!-- Buyer Card -->
            <div class="card" style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 2rem; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;" id="cardBuyer">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 1.25rem;">
                🛒
              </div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-bottom: 8px;">Buyer Marketplace</h3>
              <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem;">
                Transparent procurement directly from verified growers, cold-chain GPS reefer telemetry tracking, Grade A+ certified produce.
              </p>
              <button class="btn btn-primary-buyer" style="width: 100%; padding: 12px;">
                Enter as Buyer &rarr;
              </button>
            </div>

            <!-- Owner Card -->
            <div class="card" style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(192, 132, 252, 0.3); border-radius: 16px; padding: 2rem; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;" id="cardOwner">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(192, 132, 252, 0.15); border: 1px solid #c084fc; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 1.25rem;">
                🛡️
              </div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-bottom: 8px;">DOCA Control Room</h3>
              <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem;">
                National regulator command tower: Live Activity Feed, Double-Approval Escrow verification queue, and instant user dismissal moderation.
              </p>
              <button class="btn btn-primary-owner" style="width: 100%; padding: 12px;">
                Admin Portal &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>
        @keyframes pulseLogo {
          0%, 100% { transform: scale(1); box-shadow: 0 0 35px rgba(16, 185, 129, 0.35); }
          50% { transform: scale(1.06); box-shadow: 0 0 65px rgba(16, 185, 129, 0.65); }
        }
        @keyframes loadBar {
          0% { left: -50%; }
          100% { left: 100%; }
        }
        #cardFarmer:hover { transform: translateY(-4px); border-color: #10b981; box-shadow: 0 12px 30px rgba(16, 185, 129, 0.25); }
        #cardBuyer:hover { transform: translateY(-4px); border-color: #38bdf8; box-shadow: 0 12px 30px rgba(56, 189, 248, 0.25); }
        #cardOwner:hover { transform: translateY(-4px); border-color: #c084fc; box-shadow: 0 12px 30px rgba(192, 132, 252, 0.25); }
      </style>
    `;

    // 1.5 second splash transition
    setTimeout(() => {
      const splashSeq = document.getElementById('splashSequence');
      const gateSeq = document.getElementById('gatewaySequence');
      if (splashSeq && gateSeq) {
        splashSeq.style.display = 'none';
        gateSeq.style.display = 'block';
        setTimeout(() => gateSeq.style.opacity = '1', 50);
      }
    }, 1500);

    // Bind card clicks
    document.getElementById('cardFarmer')?.addEventListener('click', () => router.navigate('/auth/login?role=farmer'));
    document.getElementById('cardBuyer')?.addEventListener('click', () => router.navigate('/auth/login?role=buyer'));
    document.getElementById('cardOwner')?.addEventListener('click', () => router.navigate('/auth/login?role=owner'));
  }
};
