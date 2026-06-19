import { useState, useEffect, useCallback } from 'react';
import { Link2, Unlink, ExternalLink, Loader2, MessageCircle, Mail } from 'lucide-react';
import { whatsAppStatus, clearWhatsAppSession, gmailStatus, getGmailAuthUrl, disconnectGmail } from '../services/tools';

const QR_PAGE_URL = 'http://localhost:3001/api/whatsapp/qr';

export default function Connections() {
  const [waStatus, setWaStatus] = useState('Checking...');
  const [waConnected, setWaConnected] = useState(false);
  const [waClearing, setWaClearing] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    const result = await whatsAppStatus();
    setWaStatus(result);
    setWaConnected(result.includes('✅') || result.includes('Connected'));
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleDisconnect = async () => {
    setWaClearing(true);
    await clearWhatsAppSession();
    await checkStatus();
    setWaClearing(false);
  };

  const handleConnect = useCallback(async () => {
    setWaConnecting(true);
    try {
      await fetch('http://localhost:3001/api/whatsapp/connect', { method: 'POST' });
    } catch { /* ignore */ }
    const win = window.open(QR_PAGE_URL, '_blank');
    if (!win) {
      window.location.href = QR_PAGE_URL;
    }
    const timer = setTimeout(async () => {
      await checkStatus();
      setWaConnecting(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkStatus]);

  const statusColor = waConnected ? 'text-nexu-accent-green' :
    waStatus.includes('⏳') ? 'text-nexu-accent-yellow' : 'text-nexu-accent-red';

  const statusBg = waConnected ? 'bg-nexu-accent-green/10 border-nexu-accent-green/30' :
    waStatus.includes('⏳') ? 'bg-nexu-accent-yellow/10 border-nexu-accent-yellow/30' : 'bg-nexu-accent-red/10 border-nexu-accent-red/30';

  // ─── Gmail connection state ───────────────────────────────────────────────
  const [gmStatus, setGmStatus] = useState('Checking...');
  const [gmConnected, setGmConnected] = useState(false);
  const [gmConnecting, setGmConnecting] = useState(false);
  const [gmDisconnecting, setGmDisconnecting] = useState(false);

  const checkGmailStatus = useCallback(async () => {
    const result = await gmailStatus();
    setGmStatus(result);
    setGmConnected(result.includes('✅') || result.includes('Connected'));
  }, []);

  useEffect(() => {
    checkGmailStatus();
    const interval = setInterval(checkGmailStatus, 5000);
    return () => clearInterval(interval);
  }, [checkGmailStatus]);

  const handleGmailConnect = useCallback(async () => {
    setGmConnecting(true);
    try {
      const clientId = localStorage.getItem('nexu:googleClientId') || '';
      const clientSecret = localStorage.getItem('nexu:googleClientSecret') || '';
      if (!clientId || !clientSecret) {
        alert('Please set your Google Client ID and Client Secret in Settings first.');
        setGmConnecting(false);
        return;
      }
      const result = await getGmailAuthUrl(clientId, clientSecret);
      // result should be the URL string from the backend, or an error object
      let url = '';
      if (typeof result === 'string' && result.startsWith('http')) {
        url = result;
      } else if (typeof result === 'object' && result?.error) {
        throw new Error(result.error);
      } else if (typeof result === 'string' && result.startsWith('Failed')) {
        throw new Error(result);
      } else if (typeof result === 'object' && result?.url) {
        url = result.url;
      }
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('Received unexpected response from server: ' + JSON.stringify(result));
      }
      setTimeout(() => {
        checkGmailStatus();
        setGmConnecting(false);
      }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('Gmail connect error:', msg);
      alert('❌ Gmail connection failed:\n\n' + msg);
      setGmConnecting(false);
    }
  }, [checkGmailStatus]);

  const handleGmailDisconnect = useCallback(async () => {
    setGmDisconnecting(true);
    await disconnectGmail();
    await checkGmailStatus();
    setGmDisconnecting(false);
  }, [checkGmailStatus]);

  const gmStatusColor = gmConnected ? 'text-nexu-accent-green' :
    gmStatus.includes('⏳') ? 'text-nexu-accent-yellow' : 'text-nexu-accent-red';
  const gmStatusBg = gmConnected ? 'bg-nexu-accent-green/10 border-nexu-accent-green/30' :
    gmStatus.includes('⏳') ? 'bg-nexu-accent-yellow/10 border-nexu-accent-yellow/30' : 'bg-nexu-accent-red/10 border-nexu-accent-red/30';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-nexu-text mb-1">Connections</h2>
          <p className="text-sm text-nexu-text-dim">Manage connected services</p>
        </div>

        {/* WhatsApp */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <MessageCircle size={16} className="text-nexu-primary-hover" />
            WhatsApp
          </div>

          <div className={`p-4 rounded-lg border ${statusBg} transition-colors`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${statusColor}`}>
                  {waConnected ? 'Connected' : waStatus.includes('⏳') ? 'Connecting' : 'Disconnected'}
                </span>
              </div>
              {waConnected && (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-nexu-accent-green/20 text-nexu-accent-green text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexu-accent-green animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-nexu-text-dim mb-3 leading-relaxed">
              {waStatus}
            </p>
            <div className="flex gap-2">
              {!waConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={waConnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover disabled:bg-nexu-border disabled:text-nexu-text-muted text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {waConnecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                  {waConnecting ? 'Connecting...' : 'Connect WhatsApp'}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  disabled={waClearing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-accent-red/20 hover:bg-nexu-accent-red/30 text-nexu-accent-red text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink size={14} />
                  {waClearing ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
              <a
                href={QR_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-surface-2 hover:bg-nexu-border border border-nexu-border text-nexu-text-dim hover:text-nexu-text text-sm font-medium transition-colors cursor-pointer no-underline"
              >
                <ExternalLink size={14} />
                Open QR Page
              </a>
            </div>
          </div>

          <p className="text-xs text-nexu-text-muted">
            WhatsApp uses Baileys (unofficial API). On first connection, scan the QR code displayed in the QR page.
            Session is saved so you only need to scan once.
          </p>
        </section>

        {/* Gmail */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <Mail size={16} className="text-nexu-primary-hover" />
            Gmail
          </div>

          <div className={`p-4 rounded-lg border ${gmStatusBg} transition-colors`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${gmStatusColor}`}>
                  {gmConnected ? 'Connected' : gmStatus.includes('⏳') ? 'Authorizing' : 'Disconnected'}
                </span>
              </div>
              {gmConnected && (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-nexu-accent-green/20 text-nexu-accent-green text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexu-accent-green animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-nexu-text-dim mb-3 leading-relaxed">
              {gmStatus}
            </p>
            <div className="flex gap-2">
              {!gmConnected ? (
                <button
                  onClick={handleGmailConnect}
                  disabled={gmConnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover disabled:bg-nexu-border disabled:text-nexu-text-muted text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {gmConnecting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {gmConnecting ? 'Opening Google...' : 'Connect Gmail'}
                </button>
              ) : (
                <button
                  onClick={handleGmailDisconnect}
                  disabled={gmDisconnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-accent-red/20 hover:bg-nexu-accent-red/30 text-nexu-accent-red text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink size={14} />
                  {gmDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-nexu-text-muted">
            Connect your Gmail account via Google OAuth. You'll need to set your
            Google Client ID and Client Secret in Settings first.
            After authorizing, Nexu can read and send emails on your behalf.
          </p>
        </section>
      </div>
    </div>
  );
}
