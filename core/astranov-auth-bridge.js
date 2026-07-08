window.AstranovAuthBridge = {
  client: null,
  user: null,
  session: null,
  siteId: null,

  async applySession(access_token, refresh_token) {
    if (!this.client || !access_token) return false;
    const { data, error } = await this.client.auth.setSession({ access_token, refresh_token: refresh_token || '' });
    if (error) return false;
    this.session = data?.session || null;
    this.user = this.session?.user || null;
    window.dispatchEvent(new CustomEvent('astranov-auth', { detail: { user: this.user } }));
    return true;
  },

  async init(config = {}) {
    this.siteId = config.siteId || null;
    const url = config.supabaseUrl || window.ASTRANOV_SITES_DEFAULTS?.supabaseUrl || window.ASTRANOV_CENTRAL_DB?.supabaseUrl;
    const key = config.supabaseAnonKey || window.ASTRANOV_SITES_DEFAULTS?.supabaseAnonKey || window.ASTRANOV_CENTRAL_DB?.supabaseAnonKey;
    if (!url || !key || !window.supabase) return null;

    this.client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'astranov_auth_v2',
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });

    const hash = location.hash || '';
    if (hash.includes('access_token=')) {
      await this.client.auth.getSession();
    }

    const { data } = await this.client.auth.getSession();
    this.session = data?.session || null;
    this.user = this.session?.user || null;

    this.client.auth.onAuthStateChange((_e, s) => {
      this.session = s;
      this.user = s?.user || null;
      window.dispatchEvent(new CustomEvent('astranov-auth', { detail: { user: this.user } }));
    });

    const onAuthMsg = (e) => {
      const ok = e.origin?.endsWith('.astranov.eu') || e.origin === 'https://astranov.eu';
      if (!ok || e.data?.type !== 'astranov-auth') return;
      void this.applySession(e.data.access_token, e.data.refresh_token);
    };
    window.addEventListener('message', onAuthMsg);

    if (window.self !== window.top) {
      try { window.parent.postMessage({ type: 'astranov-auth-request' }, '*'); } catch (_) {}
    } else if (window.opener) {
      try { window.opener.postMessage({ type: 'astranov-auth-request' }, '*'); } catch (_) {}
    } else if (new URLSearchParams(location.search).get('from_app') === '1') {
      setTimeout(() => {
        try { window.opener?.postMessage({ type: 'astranov-auth-request' }, '*'); } catch (_) {}
      }, 400);
    }

    return this;
  },

  async signInGoogle() {
    if (!this.client) return { error: { message: 'Auth unavailable' } };
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: location.origin + location.pathname + location.search,
        queryParams: { prompt: 'select_account' },
      },
    });
  },

  getCentralSession() {
    if (!this.user) return null;
    return {
      role: 'auditor',
      email: this.user.email,
      name: this.user.user_metadata?.full_name || this.user.user_metadata?.name || this.user.email?.split('@')[0],
      userId: this.user.id,
      token: this.session?.access_token,
      access_token: this.session?.access_token,
      central: true,
    };
  },
};