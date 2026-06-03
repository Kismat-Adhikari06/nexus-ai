let _synth: SpeechSynthesis | null = null;
let _currentUtterance: SpeechSynthesisUtterance | null = null;

function getSynth(): SpeechSynthesis {
  if (!_synth) _synth = window.speechSynthesis;
  return _synth;
}

export function speak(text: string): void {
  stopSpeaking();
  const synth = getSynth();
  const utterance = new SpeechSynthesisUtterance(text);

  // Try to find a good voice
  const voices = synth.getVoices();
  const preferredVoice = voices.find(v =>
    v.lang.startsWith('en') && v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Mark')
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  _currentUtterance = utterance;
  synth.speak(utterance);
}

export function speakSentence(text: string): void {
  speak(text);
}

export function stopSpeaking(): void {
  const synth = getSynth();
  synth.cancel();
  _currentUtterance = null;
}

export function isSpeaking(): boolean {
  return getSynth().speaking;
}
