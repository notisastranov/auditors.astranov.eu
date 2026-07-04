window.AstranovAuthBridge = {
  client: null,
  user: null,
  session: null,
  siteId: null,
  async init(config = {}) {
    this.siteId = config.siteId || null;
    const url = config.supabaseUrl || window.ASTRANOV_SITES_DEFAULTS?.supabaseUrl || window.ASTRANOV_CENTRAL_DB?.supabaseUrl;
    const key = config.supabaseAnonKey || window.ASTRANOV_SITES_DEFAULTS?.supabaseAnonKey || window.ASTRANOV_CENTRAL_DB?.supabaseAnonKey;
    if (!url || !key || !window.supabase) return null;
    this.client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'astranov_auth_v2' },
    });
    const { data } = await this.client.auth.getSession();
    this.session = data?.session || null;
    this.user = this.session?.user || null;
    this.client.auth.onAuthStateChange((_e, s) => {
      this.session = s;
      this.user = s?.user || null;
      window.dispatchEvent(new CustomEvent('astranov-auth', { detail: { user: this.user } }));
    });
    if (window.self !== window.top) {
      window.addEventListener('message', (e) => {
        if (e.data?.type !== 'astranov-auth' || !this.client) return;
        this.client.auth.setSession({
          access_token: e.data.access_token,
          refresh_token: e.data.refresh_token,
        }).catch(() => {});
      });
      try { window.parent.postMessage({ type: 'astranov-auth-request' }, '*'); } catch { /* */ }
    }
    return this;
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
      central: true
    };
  },
};