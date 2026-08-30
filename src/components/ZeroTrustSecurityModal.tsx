import React, { useState } from "react";
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Globe,
  Key,
  Copy,
  Check,
  Server,
  Mail,
  UserCheck,
  Terminal,
  ExternalLink,
  Zap,
  HelpCircle,
  Smartphone,
  Layers,
  Sparkles,
} from "lucide-react";
import { ZeroTrustAuthStatus } from "../types";

interface ZeroTrustSecurityModalProps {
  authStatus: ZeroTrustAuthStatus | null;
  onClose: () => void;
  onRefreshAuth: () => void;
}

export const ZeroTrustSecurityModal: React.FC<ZeroTrustSecurityModalProps> = ({
  authStatus,
  onClose,
  onRefreshAuth,
}) => {
  const [activeTab, setActiveTab] = useState<"status" | "cloudflare" | "tailscale" | "passcode">("status");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [passcodeVal, setPasscodeVal] = useState("");
  const [passcodeMessage, setPasscodeMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSettingPasscode, setIsSettingPasscode] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [allowedEmails, setAllowedEmails] = useState<string[]>(
    authStatus?.allowedAdminEmails || ["crazybeevub@gmail.com"]
  );

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerifyOrSetPasscode = async () => {
    if (!passcodeVal.trim()) return;
    setIsSettingPasscode(true);
    setPasscodeMessage(null);
    try {
      const res = await fetch("/api/auth/verify-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcodeVal.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setPasscodeMessage({ text: "Passcode verified successfully! Admin session active.", isError: false });
        if (data.sessionToken) {
          localStorage.setItem("station_admin_token", data.sessionToken);
        }
        onRefreshAuth();
      } else {
        setPasscodeMessage({ text: data.message || "Invalid passcode.", isError: true });
      }
    } catch {
      setPasscodeMessage({ text: "Failed to communicate with server.", isError: true });
    } finally {
      setIsSettingPasscode(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) return;
    const updated = Array.from(new Set([...allowedEmails, newEmail.trim().toLowerCase()]));
    setAllowedEmails(updated);
    setNewEmail("");

    try {
      await fetch("/api/auth/allowed-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("station_admin_token") || ""}`,
        },
        body: JSON.stringify({ emails: updated }),
      });
      onRefreshAuth();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    const updated = allowedEmails.filter((e) => e !== emailToRemove);
    setAllowedEmails(updated);
    try {
      await fetch("/api/auth/allowed-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("station_admin_token") || ""}`,
        },
        body: JSON.stringify({ emails: updated }),
      });
      onRefreshAuth();
    } catch (e) {
      console.error(e);
    }
  };

  const cfQuickCommand = `pkg install -y cloudflared && cloudflared tunnel --url http://127.0.0.1:3000`;

  const cfStepByStepCommands = `# Step 1: Install cloudflared in Termux
pkg update -y && pkg install -y cloudflared

# Step 2: Login to your free Cloudflare account
cloudflared tunnel login

# Step 3: Create your named tunnel
cloudflared tunnel create termux-weather

# Step 4: Route your domain (e.g. weather.yourdomain.com)
cloudflared tunnel route dns termux-weather weather.yourdomain.com

# Step 5: Start the tunnel daemon (0 open router ports!)
cloudflared tunnel run termux-weather`;

  const tailscaleCommands = `# Option B: Tailscale Funnel Setup
pkg install -y tailscale
tailscaled &
tailscale up
# Expose Port 3000 securely with auto HTTPS
tailscale funnel 3000`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Zero-Trust Security &amp; Public Access
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Option A
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Secure public exposure without opening ports on your home router
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("status")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "status"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security Status</span>
          </button>
          <button
            onClick={() => setActiveTab("cloudflare")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "cloudflare"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-orange-500" />
            <span>Cloudflare Zero Trust (Free)</span>
          </button>
          <button
            onClick={() => setActiveTab("tailscale")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "tailscale"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Tailscale Funnel</span>
          </button>
          <button
            onClick={() => setActiveTab("passcode")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "passcode"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Admin Authorization</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 text-xs overflow-y-auto space-y-4">
          {/* TAB 1: Live Status */}
          {activeTab === "status" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-slate-900 text-white border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    Current Authentication Mode
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {authStatus?.provider || "LOCAL_OPEN"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-slate-400 text-[10px] mb-0.5">Authenticated User</div>
                    <div className="font-bold text-white font-mono flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      {authStatus?.userEmail || "Local LAN User"}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-slate-400 text-[10px] mb-0.5">Admin Rights &amp; Easee Control</div>
                    <div className="font-bold font-mono flex items-center gap-1.5 text-emerald-400">
                      <UserCheck className="w-3.5 h-3.5" />
                      {authStatus?.isAdmin ? "Authorized Admin" : "Viewer (Read Only)"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Zero-Trust Security Guarantees */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Why Zero-Trust Tunnels (Option A) are 100% Free &amp; Ideal:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 text-[11px]">
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span><b>0 Open Ports:</b> No port forwarding on your router; immune to internet port scanners.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span><b>Free for up to 50 users:</b> Cloudflare Zero Trust free plan includes Google/Email SSO.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span><b>Automatic HTTPS/TLS:</b> Automated edge SSL certificates with HTTP-to-HTTPS redirect.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span><b>DDoS &amp; Bot Defense:</b> Cloudflare edge blocks malicious scrapers before reaching your phone.</span>
                  </div>
                </div>
              </div>

              {/* Active Security Protections */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Active Application Security Layer</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="font-bold text-slate-900 flex items-center gap-1 mb-1">
                      <Lock className="w-3 h-3 text-emerald-600" /> RSA-2048
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Client-side hybrid encryption protects Easee credentials even over plain HTTP LAN.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="font-bold text-slate-900 flex items-center gap-1 mb-1">
                      <Shield className="w-3 h-3 text-blue-600" /> IP Rate Limiter
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Automatic 15-minute lockout after 5 failed login or passcode attempts.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="font-bold text-slate-900 flex items-center gap-1 mb-1">
                      <UserCheck className="w-3 h-3 text-purple-600" /> Header Auth
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Server validates <code className="font-mono text-[9px] bg-slate-100 px-1 rounded">Cf-Access-Authenticated-User-Email</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Cloudflare Zero Trust Guide */}
          {activeTab === "cloudflare" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 p-3.5 rounded-xl text-orange-950">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-orange-600 shrink-0" />
                  <div>
                    <div className="font-bold text-xs">Cloudflare Zero Trust Free Plan</div>
                    <div className="text-[11px] text-orange-800">
                      Free for up to 50 users. No credit card required. Works directly inside Termux on Android.
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Quick Tunnel (Test mode) */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>⚡ Quick Test Tunnel (Instant HTTPS, No Account Needed):</span>
                  <button
                    onClick={() => copyToClipboard(cfQuickCommand, "cfquick")}
                    className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold hover:underline"
                  >
                    {copiedId === "cfquick" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === "cfquick" ? "Copied" : "Copy Command"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-inner">
                  {cfQuickCommand}
                </pre>
                <p className="text-[10px] text-slate-500">
                  Generates an instant <code className="bg-slate-100 px-1 rounded text-slate-700">https://xxxx.trycloudflare.com</code> URL that securely proxies to your Termux port 3000.
                </p>
              </div>

              {/* Permanent Cloudflare Access Setup */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>🛡️ Permanent Production Setup with Google/Email Login:</span>
                  <button
                    onClick={() => copyToClipboard(cfStepByStepCommands, "cfsteps")}
                    className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold hover:underline"
                  >
                    {copiedId === "cfsteps" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === "cfsteps" ? "Copied" : "Copy All Steps"}</span>
                  </button>
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto shadow-inner leading-relaxed">
                  {cfStepByStepCommands}
                </pre>

                <div className="space-y-1.5 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900">How to lock it to your email:</div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to <b>Cloudflare Zero Trust Dashboard</b> &gt; <b>Access</b> &gt; <b>Applications</b>.</li>
                    <li>Click <b>Add an application</b> &gt; <b>Self-hosted</b>.</li>
                    <li>Enter your domain (e.g. <code className="bg-white px-1 border rounded">weather.yourdomain.com</code>).</li>
                    <li>Add Policy: <b>Action = Allow</b>, Rule: <b>Include Email = {authStatus?.userEmail || "crazybeevub@gmail.com"}</b>.</li>
                    <li>Save. Now only you can access the dashboard after logging in with Google or receiving an email OTP code!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Tailscale Funnel Guide */}
          {activeTab === "tailscale" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                <div className="font-bold text-xs mb-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Tailscale (100% Free Personal Plan)
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Tailscale is free for up to 100 devices and 3 users. It creates a private mesh VPN between your phone, laptop, and PC with zero router configuration.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Termux Commands for Tailscale:</span>
                  <button
                    onClick={() => copyToClipboard(tailscaleCommands, "tailscale")}
                    className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold hover:underline"
                  >
                    {copiedId === "tailscale" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === "tailscale" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-inner">
                  {tailscaleCommands}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: Admin Authorization & Allowed Emails */}
          {activeTab === "passcode" && (
            <div className="space-y-4">
              {/* Allowed Admin Emails */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  Authorized Cloudflare / Zero-Trust Admin Emails
                </div>
                <p className="text-[11px] text-slate-600">
                  Only authenticated users matching these email addresses will be permitted to control Easee charging and sync schedules:
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {allowedEmails.map((email) => (
                    <span
                      key={email}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-mono font-medium border border-blue-200"
                    >
                      <span>{email}</span>
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="hover:text-rose-600 ml-1 font-bold"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="add-email@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <button
                    onClick={handleAddEmail}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700"
                  >
                    Add Admin
                  </button>
                </div>
              </div>

              {/* Local Passcode Lock */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  Local Network Admin Passcode
                </div>
                <p className="text-[11px] text-slate-600">
                  Optional master passcode to lock Easee controls when accessing the station directly via local Wi-Fi without Cloudflare Access:
                </p>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter admin passcode"
                    value={passcodeVal}
                    onChange={(e) => setPasscodeVal(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <button
                    onClick={handleVerifyOrSetPasscode}
                    disabled={isSettingPasscode}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSettingPasscode ? "Verifying..." : "Verify / Unlock"}
                  </button>
                </div>

                {passcodeMessage && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-semibold ${
                      passcodeMessage.isError
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {passcodeMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
