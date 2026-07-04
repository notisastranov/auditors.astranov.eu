window.AuditorApi = {
  async call(config, mode, filters = {}) {
    const bridge = window.AstranovAuthBridge;
    const session = bridge?.getCentralSession?.();
    const token = session?.token || session?.access_token;
    if (!token) throw new Error('Sign in required');
    const url = (config.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/auditor-api';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        apikey: config.supabaseAnonKey || '',
      },
      body: JSON.stringify({ mode, ...filters }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'auditor-api ' + r.status);
    return j;
  },
};