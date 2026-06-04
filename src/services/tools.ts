import { stripFiller } from './api';

const API_BASE = 'http://localhost:3001';

async function callBackend(endpoint: string, body?: Record<string, unknown>): Promise<string> {
  try {
    const opts: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    return data.result || 'Done';
  } catch (e) {
    return `Failed: ${e instanceof Error ? e.message : 'Server not running'}`;
  }
}

// System tools
export function getBattery() { return callBackend('/api/system/battery'); }
export function getCpu() { return callBackend('/api/system/cpu'); }
export function getRam() { return callBackend('/api/system/ram'); }
export function setVolume(level: number) { return callBackend('/api/system/volume', { level }); }
export function notify(title: string, message: string) { return callBackend('/api/system/notify', { title, message }); }
export function runCommand(command: string) { return callBackend('/api/system/command', { command }); }
export function launchApp(name: string) { return callBackend('/api/system/launch', { name }); }
export function lockWorkstation() { return callBackend('/api/system/lock'); }
export function sleep() { return callBackend('/api/system/sleep'); }
export function shutdownPC() { return callBackend('/api/system/shutdown'); }
export function hibernate() { return callBackend('/api/system/hibernate'); }

// File tools
export function openFile(path: string) { return callBackend('/api/files/open', { path }); }
export function openInVscode(path: string) { return callBackend('/api/files/vscode', { path }); }
export function searchFiles(query: string, location?: string) { return callBackend('/api/files/search', { query, location }); }
export function findFile(filename: string) { return callBackend('/api/files/find', { filename }); }
export function getFileInfo(path: string) { return callBackend('/api/files/info', { path }); }
export function listDirectory(path?: string) { return callBackend('/api/files/list', { path }); }
// Browser tools
export function openUrl(url: string) { return callBackend('/api/browser/open', { url }); }
export function searchWeb(query: string) { return callBackend('/api/browser/search', { query: stripFiller(query) }); }

// Extra tools
export function clipboardRead() {
  // Try browser clipboard API first
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText().then(t => t || 'Clipboard is empty').catch(() => callBackend('/api/extra/clipboard-read'));
  }
  return callBackend('/api/extra/clipboard-read');
}
export function clipboardCopy(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => 'Copied to clipboard').catch(() => callBackend('/api/extra/clipboard-copy', { text }));
  }
  return callBackend('/api/extra/clipboard-copy', { text });
}
export function screenshot() { return callBackend('/api/extra/screenshot'); }
export function playYoutube(query: string) { return callBackend('/api/extra/youtube', { query: stripFiller(query) }); }

// PDF tools
export function readPdf(path: string) { return callBackend('/api/files/read-pdf', { path }); }

// WhatsApp tools (Baileys)
export function listWhatsAppChats(limit?: number) { return callBackend('/api/whatsapp/chats?limit=' + (limit || 10)); }
export function getWhatsAppMessages(chat: string, limit?: number) { return callBackend('/api/whatsapp/messages', { chat, limit: limit || 10 }); }
export function sendWhatsApp(to: string, message: string) { return callBackend('/api/whatsapp/send', { to, message }); }
export function sendWhatsAppNumber(phoneNumber: string, message: string) { return callBackend('/api/whatsapp/send-number', { phoneNumber, message }); }
export function getUnreadWhatsApp() { return callBackend('/api/whatsapp/unread'); }
export function whatsAppStatus() { return callBackend('/api/whatsapp/status'); }
export function getWhatsAppQR() { return callBackend('/api/whatsapp/qr-data'); }
export function clearWhatsAppSession() { return callBackend('/api/whatsapp/clear'); }
export function blockWhatsAppContact(contact: string) { return callBackend('/api/whatsapp/block', { contact }); }
export function unblockWhatsAppContact(contact: string) { return callBackend('/api/whatsapp/unblock', { contact }); }
export function deleteWhatsAppChat(contact: string) { return callBackend('/api/whatsapp/delete-chat', { contact }); }
export function archiveWhatsAppChat(contact: string) { return callBackend('/api/whatsapp/archive', { contact }); }
export function unarchiveWhatsAppChat(contact: string) { return callBackend('/api/whatsapp/unarchive', { contact }); }
export function muteWhatsAppChat(contact: string, duration?: string) { return callBackend('/api/whatsapp/mute', { contact, duration: duration || 'always' }); }
export function unmuteWhatsAppChat(contact: string) { return callBackend('/api/whatsapp/unmute', { contact }); }
export function pinWhatsAppChat(contact: string) { return callBackend('/api/whatsapp/pin', { contact }); }
export function unpinWhatsAppChat(contact: string) { return callBackend('/api/whatsapp/unpin', { contact }); }
export function markWhatsAppRead(contact: string) { return callBackend('/api/whatsapp/mark-read', { contact }); }
export function reportWhatsAppContact(contact: string) { return callBackend('/api/whatsapp/report', { contact }); }
